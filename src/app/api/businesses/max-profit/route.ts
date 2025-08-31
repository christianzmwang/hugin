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

  const cacheKey = { metric: 'maxLatestProfit' }
  const cached = apiCache.get<{ maxProfit: number }>(cacheKey)
  if (cached) {
    return NextResponse.json(cached)
  }

  // Find the maximum profit across businesses using their latest financial report
  const sql = `
    SELECT COALESCE(MAX(fLatest.profit), 0)::bigint AS "maxProfit"
    FROM "Business" b
    LEFT JOIN LATERAL (
      SELECT f.profit
      FROM "FinancialReport" f
      WHERE f."businessId" = b.id
      ORDER BY f."fiscalYear" DESC NULLS LAST
      LIMIT 1
    ) fLatest ON TRUE
    WHERE fLatest.profit IS NOT NULL
  `

  try {
    const res = await query<{ maxProfit: number }>(sql)
    const maxProfit = res.rows?.[0]?.maxProfit ?? 0
    const payload = { maxProfit }
    apiCache.set(cacheKey, payload, 5 * 60 * 1000) // cache 5 minutes
    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json({ maxProfit: 0 }, { status: 200 })
  }
}
