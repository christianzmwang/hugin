import { NextResponse } from 'next/server'
import { checkApiAccess, getAuthorizedSession } from '@/lib/access-control'
import { dbConfigured, query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1','arn1','cdg1']
export const maxDuration = 15

async function ensureTables() {
  if (!dbConfigured) return
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS saved_notifications (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        filter_query TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_saved_notifications_user ON saved_notifications (user_id, created_at DESC);
    `)
  } catch {
    // ignore
  }
}

type NotificationRow = { id: number; name: string; filter_query: string | null; created_at: string }

export async function GET() {
  const accessError = await checkApiAccess();
  if (accessError) return accessError
  if (!dbConfigured) return NextResponse.json({ items: [] })
  await ensureTables()
  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ items: [] })
  const userId = session.user.id
  try {
    const res = await query<NotificationRow>(`SELECT id, name, filter_query, created_at FROM saved_notifications WHERE user_id = $1 ORDER BY created_at DESC`, [userId])
    const items = res.rows.map(r => ({ id: r.id, name: r.name, filterQuery: r.filter_query, createdAt: r.created_at }))
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=120' } })
  } catch {
    return NextResponse.json({ items: [] })
  }
}

export async function POST(req: Request) {
  const accessError = await checkApiAccess();
  if (accessError) return accessError
  if (!dbConfigured) return NextResponse.json({ ok: false }, { status: 503 })
  await ensureTables()
  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  const userId = session.user.id
  try {
    const body = await req.json().catch(() => ({})) as { name?: string; filterQuery?: string }
    const name = String(body?.name || '').trim()
    const filterQuery = String(body?.filterQuery || '').trim() || null
    if (!name) return NextResponse.json({ ok: false, error: 'Missing name' }, { status: 400 })
    const ins = await query<{ id: number }>(`INSERT INTO saved_notifications (user_id, name, filter_query) VALUES ($1,$2,$3) RETURNING id`, [userId, name, filterQuery])
    const id = ins.rows[0]?.id
    if (!id) return NextResponse.json({ ok: false }, { status: 500 })
    return NextResponse.json({ ok: true, id })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
