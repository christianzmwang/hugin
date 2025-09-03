import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { dbConfigured } from '@/lib/db'
import { checkApiAccess } from '@/lib/access-control'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 10
export const preferredRegion = ['fra1', 'arn1', 'cdg1']

export async function GET(req: Request) {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) {
    return NextResponse.json({ items: [] })
  }

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()

  try {
    if (!q) {
      // Return top cities by frequency when no query provided
      const sql = `
        SELECT b."addressCity" AS city, COUNT(*) AS cnt
        FROM "Business" b
        WHERE b."addressCity" IS NOT NULL AND b."addressCity" <> ''
        GROUP BY b."addressCity"
        ORDER BY cnt DESC
        LIMIT 100
      `
      const res = await query<{ city: string; cnt: number }>(sql)
      const items = (res.rows || [])
        .map((r) => (r.city || '').trim())
        .filter(Boolean)
      return NextResponse.json({ items })
    }

    // Return distinct matching cities or postal codes
    const sql = `
      SELECT DISTINCT b."addressCity" AS city, b."addressPostalCode" AS postal
      FROM "Business" b
      WHERE (b."addressCity" ILIKE $1 OR b."addressPostalCode" ILIKE $1)
      LIMIT 100
    `
    const like = `%${q}%`
    const res = await query<{ city: string | null; postal: string | null }>(sql, [like])
    const set = new Set<string>()
    for (const row of res.rows || []) {
      const city = (row.city || '').trim()
      const postal = (row.postal || '').trim()
      if (city) set.add(city)
      if (postal) set.add(postal)
      if (set.size >= 100) break
    }
    return NextResponse.json({ items: Array.from(set) })
  } catch {
    return NextResponse.json({ items: [] })
  }
}


