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

    // Join with Business table to get orgNumber and name
    const sql = `
      SELECT b."orgNumber" as org_number,
             b.name
      FROM "RecentlyViewedBusiness" rv
      LEFT JOIN "Business" b ON b.id = rv."businessId"
      WHERE rv."userId" = $1
      ORDER BY rv."viewedAt" DESC
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
    if (!orgNumber) return NextResponse.json({ ok: false, error: 'Missing orgNumber' }, { status: 400 })

    // First, find the business ID from the orgNumber
    const businessResult = await query<{ id: string }>(
      `SELECT id FROM "Business" WHERE "orgNumber" = $1 LIMIT 1`,
      [orgNumber]
    )
    
    if (businessResult.rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 })
    }
    
    const businessId = businessResult.rows[0].id

    // Upsert and bump timestamp
    await query(
      `INSERT INTO "RecentlyViewedBusiness" (id, "userId", "businessId", "viewedAt")
       VALUES (gen_random_uuid(), $1, $2, NOW())
       ON CONFLICT ("userId", "businessId")
       DO UPDATE SET "viewedAt" = NOW()`,
      [userId, businessId]
    )

    // Enforce cap per user (default 20)
    const cap = Number.isFinite(body?.max) && (body!.max as number) > 0 ? Math.min(200, Math.floor(body!.max as number)) : 20
    await query(
      `DELETE FROM "RecentlyViewedBusiness"
       WHERE "userId" = $1
         AND id NOT IN (
           SELECT id FROM "RecentlyViewedBusiness"
           WHERE "userId" = $1
           ORDER BY "viewedAt" DESC
           LIMIT $2
         )`,
      [userId, cap]
    )

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
