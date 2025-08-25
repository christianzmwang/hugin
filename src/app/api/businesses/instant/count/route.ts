import { NextResponse } from 'next/server'
import { dbConfigured, query, type SqlParam } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
export const maxDuration = 15

export async function GET(req: Request) {
  const start = Date.now()
  if (!dbConfigured) {
    return NextResponse.json(
      { total: 0, tookMs: 0 },
      { status: 200, headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } },
    )
  }

  const sp = new URL(req.url).searchParams
  const industryCode = (sp.get('industryCode') || '').trim() || null
  const sectorCode = (sp.get('sectorCode') || '').trim() || null
  const orgFormCode = (sp.get('orgFormCode') || '').trim() || null
  const city = (sp.get('city') || '').trim() || null
  const revenueBucket = (sp.get('revenueBucket') || '').trim() || null
  const employeeBucket = (sp.get('employeeBucket') || '').trim() || null
  const vatRegistered = sp.get('vatRegistered')
  const vatRegisteredBool =
    vatRegistered == null || vatRegistered === ''
      ? null
      : ['1', 'true', 'yes'].includes(vatRegistered.toLowerCase())
  const search = (sp.get('search') || '').trim() || null
  const explain = sp.get('explain') === 'true'

  // Call the DB function get_filter_counts with exact param order
  const sql = explain
    ? `EXPLAIN (ANALYZE, BUFFERS, TIMING) SELECT get_filter_counts($1,$2,$3,$4,$5,$6,$7,$8)`
    : `SELECT get_filter_counts($1,$2,$3,$4,$5,$6,$7,$8) AS total`
  const params: SqlParam[] = [
    industryCode,
    sectorCode,
    orgFormCode,
    city,
    revenueBucket,
    employeeBucket,
    vatRegisteredBool,
    search,
  ]

  try {
    const res = await query<Record<string, unknown>>(sql, params)
    if (explain) {
      const plan = res.rows.map((r: Record<string, unknown>) => r['QUERY PLAN'] || Object.values(r)[0]).join('\n')
      const tookMs = Date.now() - start
      console.log(`[businesses] instant count explain took ${tookMs}ms`)
      return NextResponse.json(
        { explain: plan, tookMs },
        { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } },
      )
    }
    const total = Number(res.rows?.[0]?.total ?? 0)
    const tookMs = Date.now() - start
    console.log(`[businesses] instant count took ${tookMs}ms -> ${total}`)
    return NextResponse.json(
      { total, tookMs },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } },
    )
  } catch (e) {
    console.error('[businesses] instant count error', e)
    return NextResponse.json(
      { total: 0, tookMs: Date.now() - start },
      { status: 200, headers: { 'Cache-Control': 's-maxage=15' } },
    )
  }
}
