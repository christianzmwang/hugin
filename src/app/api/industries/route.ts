import { NextResponse } from 'next/server'
import { dbConfigured } from '@/lib/db'
import { checkApiAccess } from '@/lib/access-control'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
import { query } from '@/lib/db'
import { apiCache } from '@/lib/api-cache'

export async function GET(req: Request) {
  // Check authentication and authorization first
  const accessError = await checkApiAccess()
  if (accessError) {
    return accessError
  }

  if (!dbConfigured) {
    return NextResponse.json([], { status: 503 })
  }
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()

  // Create cache key
  const cacheKey = { endpoint: 'industries', query: q || 'all' }

  // Check cache first (5 minute TTL for industry data)
  const cached =
    apiCache.get<{ code: string; text: string; count: number }[]>(cacheKey)
  if (cached) {
    return NextResponse.json(cached)
  }

  let sql: string
  let params: (string | null)[]

  if (!q) {
    // Use precomputed/filter matrix for fast industry listing
    sql = `
      SELECT DISTINCT
        m.industry_code1 AS code,
        m.industry_text1 AS text,
        1 AS count
      FROM public.business_filter_matrix m
      WHERE m.industry_code1 IS NOT NULL AND m.industry_text1 IS NOT NULL
      ORDER BY m.industry_code1 ASC
    `
    params = []
  } else {
    // Search query - target specific matches only
    sql = `
      SELECT DISTINCT
        m.industry_code1 AS code,
        m.industry_text1 AS text,
        1 AS count,
        CASE
          WHEN m.industry_code1 ILIKE $1 OR m.industry_text1 ILIKE $1 THEN 0
          ELSE 1
        END AS relevance
      FROM public.business_filter_matrix m
      WHERE m.industry_code1 IS NOT NULL 
        AND m.industry_text1 IS NOT NULL
        AND (m.industry_code1 ILIKE $2 OR m.industry_text1 ILIKE $2)
      ORDER BY relevance ASC, m.industry_code1 ASC
      LIMIT 50
    `
    params = [`${q}%`, `%${q}%`]
  }

  const start = Date.now()
  const { rows } = await query(sql, params)
  console.log(
    `[industries] Query took ${Date.now() - start}ms for query: "${q || 'all'}"`,
  )

  // Cache results for 5 minutes
  apiCache.set(cacheKey, rows, 5 * 60 * 1000)

  return NextResponse.json(rows, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
  })
}
