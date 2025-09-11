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
    // ignore schema creation errors; subsequent queries will surface real issues
  }
}

// DELETE /api/lists/:id/items  { orgNumbers: string[] }
export async function DELETE(req: Request, context: unknown) {
  const { params } = (context as { params: { id: string } }) || { params: { id: '' } }
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503 })
  await ensureTables()

  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const id = Number(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: 'Bad list id' }, { status: 400 })

  let body: unknown = {}
  try { body = await req.json().catch(() => ({})) } catch { /* noop */ }
  const orgNumbersRaw = Array.isArray((body as { orgNumbers?: unknown }).orgNumbers)
    ? (body as { orgNumbers?: unknown[] }).orgNumbers!
    : []
  const orgNumbers = Array.from(
    new Set(
      orgNumbersRaw
        .map(v => (typeof v === 'string' ? v.trim() : String(v ?? '').trim()))
        .filter(v => Boolean(v))
    )
  )
  if (orgNumbers.length === 0) return NextResponse.json({ ok: false, error: 'No org numbers provided' }, { status: 400 })

  try {
    // Verify ownership of list first (cheap index lookup)
    const ownRes = await query<{ id: number }>(`SELECT id FROM saved_lists WHERE id = $1 AND user_id = $2`, [id, userId])
    if (ownRes.rows.length === 0) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })

    // Bulk delete using ANY
    const delRes = await query<{ org_number: string }>(
      `DELETE FROM saved_list_items WHERE list_id = $1 AND org_number = ANY($2::text[]) RETURNING org_number`,
      [id, orgNumbers as string[]]
    )
    return NextResponse.json({ ok: true, removed: delRes.rows.map(r => r.org_number) })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to delete items' }, { status: 500 })
  }
}
