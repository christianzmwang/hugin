import { NextResponse } from 'next/server'
import { dbConfigured, query } from '@/lib/db'
import { checkApiAccess } from '@/lib/access-control'
import { apiCache } from '@/lib/api-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 10
export const preferredRegion = ['fra1','arn1','cdg1']

// Consolidated financial bounds (latest revenue & profit per business)
export async function GET() {
  const accessError = await checkApiAccess()
  if (accessError) return accessError
  if (!dbConfigured) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const cacheKey = { metric: 'financialBoundsV1' }
  const cached = apiCache.get<{ maxRevenue:number; minRevenue:number; maxProfit:number; minProfit:number }>(cacheKey)
  if (cached) {
    return NextResponse.json(cached, { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1800' } })
  }

  const sql = `
    WITH latest AS (
      SELECT DISTINCT ON (f."businessId")
        f."businessId", f.revenue, f.profit
      FROM "FinancialReport" f
      ORDER BY f."businessId", f."fiscalYear" DESC NULLS LAST
    )
    SELECT
      COALESCE(MAX(revenue),0)::bigint AS "maxRevenue",
      COALESCE(MIN(revenue),0)::bigint AS "minRevenue",
      COALESCE(MAX(profit),0)::bigint  AS "maxProfit",
      COALESCE(MIN(profit),0)::bigint  AS "minProfit"
    FROM latest
    WHERE revenue IS NOT NULL OR profit IS NOT NULL
  `

  try {
    const res = await query<{ maxRevenue:number; minRevenue:number; maxProfit:number; minProfit:number }>(sql)
    const row = res.rows?.[0] || { maxRevenue:0,minRevenue:0,maxProfit:0,minProfit:0 }
    apiCache.set(cacheKey, row, 15 * 60 * 1000)
    return NextResponse.json(row, { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1800' } })
  } catch {
    return NextResponse.json({ maxRevenue:0,minRevenue:0,maxProfit:0,minProfit:0 })
  }
}
