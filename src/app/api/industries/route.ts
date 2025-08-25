import { NextResponse } from 'next/server'
import { dbConfigured } from '@/lib/db'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
import { query } from '@/lib/db'
import { apiCache } from '@/lib/api-cache'

export async function GET(req: Request) {
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
    // No search query - return ALL industries for client-side filtering
    sql = `
      SELECT DISTINCT
        "industryCode1" as code,
        "industryText1" as text,
        1 as count
      FROM "Business" 
      WHERE "industryCode1" IS NOT NULL 
        AND "industryText1" IS NOT NULL
        AND (COALESCE("registeredInForetaksregisteret", false) = true 
             OR "orgFormCode" IN ('AS','ASA','ENK','ANS','DA','NUF','SA','SAS','A/S','A/S/ASA'))
      ORDER BY "industryCode1" ASC
    `
    params = []
  } else {
    // Search query - target specific matches only
    sql = `
      SELECT DISTINCT
        "industryCode1" as code,
        "industryText1" as text,
        1 as count,
        CASE
          WHEN "industryCode1" ILIKE $1 OR "industryText1" ILIKE $1 THEN 0
          ELSE 1
        END as relevance
      FROM "Business" 
      WHERE "industryCode1" IS NOT NULL 
        AND "industryText1" IS NOT NULL
        AND (COALESCE("registeredInForetaksregisteret", false) = true 
             OR "orgFormCode" IN ('AS','ASA','ENK','ANS','DA','NUF','SA','SAS','A/S','A/S/ASA'))
        AND ("industryCode1" ILIKE $2 OR "industryText1" ILIKE $2)
      ORDER BY relevance ASC, "industryCode1" ASC
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

  return NextResponse.json(rows)
}
