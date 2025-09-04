import { NextResponse } from 'next/server'
import { dbConfigured, query } from '@/lib/db'
import { checkApiAccess } from '@/lib/access-control'
import { apiCache } from '@/lib/api-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 10
export const preferredRegion = ['fra1', 'arn1', 'cdg1']

export async function GET() {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const cacheKey = { metric: 'maxLatestRevenue' }
  const cached = apiCache.get<{ maxRevenue: number }>(cacheKey)
  if (cached) {
    return NextResponse.json(cached)
  }

  // Find the maximum revenue across businesses using their latest financial report
  const sql = `
    SELECT COALESCE(MAX(fLatest.revenue), 0)::bigint AS "maxRevenue"
    FROM "Business" b
    LEFT JOIN LATERAL (
      SELECT f.revenue
      FROM "FinancialReport" f
      WHERE f."businessId" = b.id
      ORDER BY f."fiscalYear" DESC NULLS LAST
      LIMIT 1
    ) fLatest ON TRUE
    WHERE fLatest.revenue IS NOT NULL
  `

  try {
    const res = await query<{ maxRevenue: number }>(sql)
    const maxRevenue = res.rows?.[0]?.maxRevenue ?? 0
    const payload = { maxRevenue }
    apiCache.set(cacheKey, payload, 15 * 60 * 1000) // cache 15 minutes
  return NextResponse.json(payload, { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1800' } })
  } catch {
    return NextResponse.json({ maxRevenue: 0 }, { status: 200 })
  }
}


