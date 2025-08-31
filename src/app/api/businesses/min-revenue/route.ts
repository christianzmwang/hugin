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

  const cacheKey = { metric: 'minLatestRevenue' }
  const cached = apiCache.get<{ minRevenue: number }>(cacheKey)
  if (cached) {
    return NextResponse.json(cached)
  }

  const sql = `
    SELECT COALESCE(MIN(fLatest.revenue), 0)::bigint AS "minRevenue"
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
    const res = await query<{ minRevenue: number }>(sql)
    const minRevenue = res.rows?.[0]?.minRevenue ?? 0
    const payload = { minRevenue }
    apiCache.set(cacheKey, payload, 5 * 60 * 1000)
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ minRevenue: 0 }, { status: 200 })
  }
}


