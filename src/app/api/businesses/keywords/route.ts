import { NextResponse } from 'next/server'
import { checkApiAccess } from '@/lib/access-control'
import { dbConfigured, query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

/*
  Returns keyword scan statistics stored in BusinessWebMeta.
  Dynamically discovers columns that start with:
    - kw_present_
    - kw_count_
    - kw_density_
  Query params:
    orgNumber (required)
*/
export async function GET(req: Request) {
  const accessError = await checkApiAccess()
  if (accessError) return accessError
  if (!dbConfigured) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })
  const { searchParams } = new URL(req.url)
  const orgNumber = (searchParams.get('orgNumber') || '').trim()
  if (!orgNumber) return NextResponse.json({ error: 'Missing orgNumber' }, { status: 400 })

  try {
    // Discover keyword columns once per request (cheap enough) - could cache if needed
    const colSql = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'BusinessWebMeta'
        AND (
          column_name LIKE 'kw_present_%' OR
          column_name LIKE 'kw_count_%' OR
          column_name LIKE 'kw_density_%'
        )
      ORDER BY column_name
    `
    const { rows: colRows } = await query<{ column_name: string }>(colSql)
    const cols = colRows.map(r => `w."${r.column_name}"`).join(', ')
    if (cols.length === 0) {
      return NextResponse.json({ orgNumber, items: [], keywords: [], stats: {} })
    }
    const sql = `
      SELECT ${cols}
      FROM "BusinessWebMeta" w
      JOIN "Business" b ON b.id = w."businessId"
      WHERE b."orgNumber" = $1
      LIMIT 1
    `
    const { rows } = await query<Record<string, unknown>>(sql, [orgNumber])
    if (rows.length === 0) return NextResponse.json({ orgNumber, items: [], keywords: [], stats: {} })
    const row = rows[0]
    // Group by base keyword from column naming safeCol logic
    // Columns look like kw_present_<kw>, kw_count_<kw>, kw_density_<kw>
    const stats: Record<string, { present?: number; count?: number; density?: number }> = {}
    for (const [k, v] of Object.entries(row)) {
      if (!k.startsWith('kw_')) continue
      const parts = k.split('_') // e.g., ['kw','present','freight'] or more segments
      if (parts.length < 3) continue
      const type = parts[1] // present|count|density
      const kw = parts.slice(2).join('_')
      stats[kw] = stats[kw] || {}
      if (type === 'present') stats[kw].present = typeof v === 'number' ? v : v == null ? 0 : Number(v)
      else if (type === 'count') stats[kw].count = typeof v === 'number' ? v : v == null ? 0 : Number(v)
      else if (type === 'density') stats[kw].density = typeof v === 'number' ? v : v == null ? 0 : Number(v)
    }
    const keywords = Object.keys(stats)
    return NextResponse.json({ orgNumber, keywords, stats })
  } catch (e) {
    console.error('[keywords] failed', e)
    return NextResponse.json({ error: 'Failed to load keyword stats' }, { status: 500 })
  }
}
