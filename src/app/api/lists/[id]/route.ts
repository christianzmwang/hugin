import { NextResponse } from 'next/server'
import { checkApiAccess, getAuthorizedSession } from '@/lib/access-control'
import { dbConfigured, query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
export const maxDuration = 15

async function ensureTables() {
  if (!dbConfigured) return
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS saved_lists (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        filter_query TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_saved_lists_user ON saved_lists (user_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS saved_list_items (
        list_id BIGINT NOT NULL REFERENCES saved_lists(id) ON DELETE CASCADE,
        org_number TEXT NOT NULL,
        PRIMARY KEY (list_id, org_number)
      );
      CREATE INDEX IF NOT EXISTS idx_saved_list_items_list ON saved_list_items (list_id);
      CREATE INDEX IF NOT EXISTS idx_saved_list_items_org ON saved_list_items (org_number);
    `)
  } catch {
    // ignore
  }
}

// Note: leave second arg untyped to avoid Next.js analyzer type rejection.
export async function GET(_req: Request, ctx: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { params } = (ctx || {}) as { params: { id: string } }
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) return NextResponse.json({ item: null })

  await ensureTables()

  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ item: null }, { status: 401 })
  const userId = session.user.id
  const id = Number(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ item: null }, { status: 400 })

  try {
    const listRes = await query<{ id: number; name: string; filter_query: string | null; created_at: string }>(
      `SELECT id, name, filter_query, created_at FROM saved_lists WHERE id = $1 AND user_id = $2`,
      [id, userId]
    )
    const list = listRes.rows[0]
    if (!list) return NextResponse.json({ item: null }, { status: 404 })

    const itemsRes = await query<{ org_number: string; name: string | null }>(
      `SELECT i.org_number, m.name
       FROM saved_list_items i
       LEFT JOIN public.business_filter_matrix m ON m.org_number = i.org_number
       WHERE i.list_id = $1
       ORDER BY m.name NULLS LAST, i.org_number`,
      [id]
    )

    return NextResponse.json({
      item: {
        id: list.id,
        name: list.name,
        filterQuery: list.filter_query,
        createdAt: list.created_at,
        items: itemsRes.rows.map(r => ({ orgNumber: r.org_number, name: r.name || null })),
      },
    })
  } catch {
    return NextResponse.json({ item: null }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { params } = (ctx || {}) as { params: { id: string } }
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) return NextResponse.json({ ok: false }, { status: 503 })

  await ensureTables()

  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  const userId = session.user.id
  const id = Number(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false }, { status: 400 })

  try {
  const delRes = await query<{ id: number }>(`DELETE FROM saved_lists WHERE id = $1 AND user_id = $2 RETURNING id`, [id, userId])
  if (delRes.rows.length === 0) return NextResponse.json({ ok: false }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ ok: false }, { status: 500 }) }
}
