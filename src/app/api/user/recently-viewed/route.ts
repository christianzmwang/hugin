import { NextResponse } from 'next/server'
import { checkApiAccess } from '@/lib/access-control'
import { dbConfigured, query } from '@/lib/db'
import { getAuthorizedSession } from '@/lib/access-control'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
export const maxDuration = 15

export async function GET(req: Request) {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) return NextResponse.json({ items: [] }, { status: 200 })

  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ items: [] }, { status: 200 })
  const userId = session.user.id

  try {
    const { searchParams } = new URL(req.url)
    const limitParam = Number(searchParams.get('limit') || '')
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(100, Math.max(1, Math.floor(limitParam))) : 20

    // Join for current name, fallback to stored
    const sql = `
      SELECT rv.org_number,
             COALESCE(m.name, rv.name) AS name
      FROM recently_viewed_companies rv
      LEFT JOIN public.business_filter_matrix m ON m.org_number = rv.org_number
      WHERE rv.user_id = $1
      ORDER BY rv.created_at DESC
      LIMIT $2
    `
    const res = await query<{ org_number: string; name: string | null }>(sql, [userId, limit])
    const items = (res.rows || []).map(r => ({ orgNumber: r.org_number, name: r.name || '' }))
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 })
  }
}

export async function POST(req: Request) {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) return NextResponse.json({ ok: false }, { status: 503 })

  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  const userId = session.user.id

  try {
    const body = (await req.json().catch(() => ({}))) as { orgNumber?: string; name?: string; max?: number }
    const orgNumber = String(body?.orgNumber || '').trim()
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 300) : null
    if (!orgNumber) return NextResponse.json({ ok: false, error: 'Missing orgNumber' }, { status: 400 })

    // Upsert and bump timestamp
    await query(
      `INSERT INTO recently_viewed_companies (user_id, org_number, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, org_number)
       DO UPDATE SET created_at = NOW(), name = COALESCE(EXCLUDED.name, recently_viewed_companies.name)`,
      [userId, orgNumber, name]
    )

    // Enforce cap per user (default 20)
    const cap = Number.isFinite(body?.max) && (body!.max as number) > 0 ? Math.min(200, Math.floor(body!.max as number)) : 20
    await query(
      `DELETE FROM recently_viewed_companies
       WHERE user_id = $1
         AND id NOT IN (
           SELECT id FROM recently_viewed_companies
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2
         )`,
      [userId, cap]
    )

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
