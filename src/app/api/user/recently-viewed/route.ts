import { NextResponse } from 'next/server'
import { checkApiAccess, getAuthorizedSession } from '@/lib/access-control'
import { dbConfigured, query, hasErrorCode } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
export const maxDuration = 15

export async function GET(req: Request) {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) return NextResponse.json({ items: [] }, { status: 200 })

  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ items: [] }, { status: 200 })
  const userId = session.user.id

  try {
    const { searchParams } = new URL(req.url)
    const limitParam = Number(searchParams.get('limit') || '')
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(100, Math.max(1, Math.floor(limitParam))) : 20

    // Detect which storage table exists. Prefer the new recently_viewed_companies migration if present.
    let useNewTable = false
    try {
      const existsRes = await query<{ exists: boolean }>(`SELECT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'recently_viewed_companies'
      ) as exists`)
      useNewTable = Boolean(existsRes.rows?.[0]?.exists)
  } catch {
      // Ignore detection errors; will fallback to legacy table
    }

    if (useNewTable) {
      try {
        const res = await query<{ org_number: string; name: string | null }>(
          `SELECT org_number, name
           FROM recently_viewed_companies
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [userId, limit]
        )
        const items = (res.rows || []).map(r => ({ orgNumber: r.org_number, name: r.name || '' }))
        return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
      } catch {
        // Fall through to legacy table logic
        // continue on error
      }
    }

    // Legacy table (Prisma-style) fallback
    try {
      const sql = `
        SELECT b."orgNumber" as org_number,
               b.name,
               rv."viewedAt" as ts
        FROM "RecentlyViewedBusiness" rv
        LEFT JOIN "Business" b ON b.id = rv."businessId"
        WHERE rv."userId" = $1
        ORDER BY rv."viewedAt" DESC
        LIMIT $2
      `
      const res = await query<{ org_number: string; name: string | null }>(sql, [userId, limit])
      const items = (res.rows || []).map(r => ({ orgNumber: r.org_number, name: r.name || '' }))
      return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
      return NextResponse.json({ items: [] }, { status: 200 })
    }
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 })
  }
}

export async function POST(req: Request) {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) return NextResponse.json({ ok: false }, { status: 503 })

  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  const userId = session.user.id

  try {
    const body = (await req.json().catch(() => ({}))) as { orgNumber?: string; name?: string; max?: number }
    const orgNumber = String(body?.orgNumber || '').trim()
    const name = (body?.name || '').trim()
    if (!orgNumber) return NextResponse.json({ ok: false, error: 'Missing orgNumber' }, { status: 400 })

    // Detect new table presence
    let useNewTable = false
    try {
      const existsRes = await query<{ exists: boolean }>(`SELECT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'recently_viewed_companies'
      ) as exists`)
      useNewTable = Boolean(existsRes.rows?.[0]?.exists)
    } catch {}

    const cap = Number.isFinite(body?.max) && (body!.max as number) > 0 ? Math.min(200, Math.floor(body!.max as number)) : 20

    if (useNewTable) {
      // New simple schema (no Business FK required)
      try {
        await query(
          `INSERT INTO recently_viewed_companies (user_id, org_number, name, created_at)
           VALUES ($1, $2, NULLIF($3, ''), NOW())
           ON CONFLICT (user_id, org_number)
           DO UPDATE SET created_at = NOW(), name = COALESCE(NULLIF($3,''), recently_viewed_companies.name)`,
          [userId, orgNumber, name]
        )
        await query(
          `DELETE FROM recently_viewed_companies
           WHERE user_id = $1
             AND org_number NOT IN (
               SELECT org_number FROM recently_viewed_companies
               WHERE user_id = $1
               ORDER BY created_at DESC
               LIMIT $2
             )`,
          [userId, cap]
        )
        return NextResponse.json({ ok: true })
      } catch (e) {
        // Fall back to legacy path on error
        if (hasErrorCode(e)) {
          // continue
        }
      }
    }

    // Legacy path: requires Business lookup
    try {
      const businessResult = await query<{ id: string }>(
        `SELECT id FROM "Business" WHERE "orgNumber" = $1 LIMIT 1`,
        [orgNumber]
      )
      if (businessResult.rows.length === 0) {
        return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 })
      }
      const businessId = businessResult.rows[0].id
      await query(
        `INSERT INTO "RecentlyViewedBusiness" (id, "userId", "businessId", "viewedAt")
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT ("userId", "businessId")
         DO UPDATE SET "viewedAt" = NOW()`,
        [userId, businessId]
      )
      await query(
        `DELETE FROM "RecentlyViewedBusiness"
         WHERE "userId" = $1
           AND id NOT IN (
             SELECT id FROM "RecentlyViewedBusiness"
             WHERE "userId" = $1
             ORDER BY "viewedAt" DESC
             LIMIT $2
           )`,
        [userId, cap]
      )
      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ ok: false }, { status: 500 })
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
