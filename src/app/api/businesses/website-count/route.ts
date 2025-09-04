import { NextResponse } from 'next/server'
import { checkApiAccess } from '@/lib/access-control'
import { dbConfigured, query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const accessError = await checkApiAccess()
  if (accessError) return accessError
  if (!dbConfigured) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  try {
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM "Business" b
       JOIN "BusinessWebMeta" w ON w."businessId" = b.id
       JOIN LATERAL (
         SELECT f.revenue
         FROM "FinancialReport" f
         WHERE f."businessId" = b.id
         ORDER BY f."fiscalYear" DESC NULLS LAST
         LIMIT 1
       ) fr ON TRUE
       WHERE fr.revenue IS NOT NULL
       AND w."webRawHtml" IS NOT NULL
       AND COALESCE(NULLIF(TRIM(b.website), ''), NULL) IS NOT NULL`
    )

    const maxAvailable = rows[0] ? parseInt(rows[0].count) : 0

    return NextResponse.json({ maxAvailable })
  } catch (e) {
    console.error('[website-count] failed', e)
    return NextResponse.json({ error: 'Failed to get website count' }, { status: 500 })
  }
}
