import { NextResponse } from 'next/server'
import { checkApiAccess, getAuthorizedSession } from '@/lib/access-control'
import { dbConfigured, query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
export const maxDuration = 15

// Note: Assume tables are created via migrations.
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
    // ignore; selection will fail if schema invalid and surface error
  }
}

type ListRow = {
  id: number
  name: string
  filter_query: string | null
  created_at: string
  item_count: number
}

export async function GET() {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) return NextResponse.json({ items: [] })

  await ensureTables()

  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ items: [] })
  const userId = session.user.id

  const sql = `
    SELECT l.id, l.name, l.filter_query, l.created_at, COALESCE(c.cnt, 0) AS item_count
    FROM saved_lists l
    LEFT JOIN (
      SELECT list_id, COUNT(*)::int AS cnt
      FROM saved_list_items
      GROUP BY list_id
    ) c ON c.list_id = l.id
    WHERE l.user_id = $1
    ORDER BY l.created_at DESC
  `
  try {
    const res = await query<ListRow>(sql, [userId])
    const items = res.rows.map(r => ({
      id: r.id,
      name: r.name,
      filterQuery: r.filter_query,
      createdAt: r.created_at,
      itemCount: r.item_count,
    }))
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=120' } })
  } catch (e) {
    return NextResponse.json({ items: [] })
  }
}

export async function POST(req: Request) {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) return NextResponse.json({ ok: false }, { status: 503 })

  await ensureTables()

  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  const userId = session.user.id

  try {
    const body = await req.json().catch(() => ({})) as { name?: string; filterQuery?: string; orgNumbers?: string[] }
    const name = String(body?.name || '').trim()
    const filterQuery = String(body?.filterQuery || '').trim() || null
    const orgNumbers = Array.isArray(body?.orgNumbers) ? Array.from(new Set((body?.orgNumbers || []).map((s) => String(s || '').trim()).filter(Boolean))) : []
    if (!name) return NextResponse.json({ ok: false, error: 'Missing name' }, { status: 400 })

    // Insert list
    const insertSql = `INSERT INTO saved_lists (user_id, name, filter_query) VALUES ($1, $2, $3) RETURNING id`
    const insRes = await query<{ id: number }>(insertSql, [userId, name, filterQuery])
    const listId = insRes.rows[0]?.id
    if (!listId) return NextResponse.json({ ok: false }, { status: 500 })

    // Insert items (batch)
    if (orgNumbers.length > 0) {
      const values: string[] = []
      const params: (string | number)[] = []
      orgNumbers.forEach((org, idx) => {
        values.push(`($1, $${idx + 2})`)
        params.push(org)
      })
      const sql = `INSERT INTO saved_list_items (list_id, org_number) VALUES ${values.join(',')} ON CONFLICT DO NOTHING`
      await query(sql, [listId, ...params])
    }

    return NextResponse.json({ ok: true, id: listId })
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
