import { NextResponse } from 'next/server'
import { checkApiAccess } from '@/lib/access-control'
import { dbConfigured, query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
export const maxDuration = 15

async function ensureTable() {
  if (!dbConfigured) return
  await query(
    `CREATE TABLE IF NOT EXISTS watchlist (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      org_number TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, org_number)
    );`
  )
  await query(`CREATE INDEX IF NOT EXISTS watchlist_user_idx ON watchlist(user_id);`)
  await query(`CREATE INDEX IF NOT EXISTS watchlist_org_idx ON watchlist(org_number);`)
}



import { getAuthorizedSession } from '@/lib/access-control'

export async function GET(req: Request) {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) return NextResponse.json({ items: [] })

  await ensureTable()

  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ items: [] })
  const userId = session.user.id

  try {
    const { searchParams } = new URL(req.url)
    const limitParam = Number(searchParams.get('limit') || '')
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(200, Math.max(1, Math.floor(limitParam))) : null

    let sql = `SELECT w.org_number, m.name
       FROM watchlist w
       LEFT JOIN public.business_filter_matrix m ON m.org_number = w.org_number
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`
    const params: Array<string | number> = [userId]
    if (limit) {
      sql += ` LIMIT $2`
      params.push(limit)
    }

    const res = await query<{ org_number: string; name: string | null }>(sql, params)
    const items = (res.rows || []).map((r) => ({ orgNumber: r.org_number, name: r.name || null }))
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ items: [] })
  }
}

export async function POST(req: Request) {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) return NextResponse.json({ ok: false }, { status: 503 })

  await ensureTable()

  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  const userId = session.user.id

  try {
    const body = await req.json().catch(() => ({})) as { orgNumber?: string }
    const orgNumber = String(body?.orgNumber || '').trim()
    if (!orgNumber) return NextResponse.json({ ok: false, error: 'Missing orgNumber' }, { status: 400 })

    await query(
      `INSERT INTO watchlist (user_id, org_number)
       VALUES ($1, $2)
       ON CONFLICT (user_id, org_number) DO NOTHING`,
      [userId, orgNumber],
    )
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) return NextResponse.json({ ok: false }, { status: 503 })

  await ensureTable()

  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  const userId = session.user.id

  try {
    const { searchParams } = new URL(req.url)
    const orgNumber = String(searchParams.get('orgNumber') || '').trim()
    if (!orgNumber) return NextResponse.json({ ok: false, error: 'Missing orgNumber' }, { status: 400 })

    await query(`DELETE FROM watchlist WHERE user_id = $1 AND org_number = $2`, [userId, orgNumber])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}


