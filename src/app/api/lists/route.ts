import { NextResponse } from 'next/server'
import { checkApiAccess, getAuthorizedSession } from '@/lib/access-control'
import { dbConfigured, query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
export const maxDuration = 15

// Note: Assume tables are created via migrations.
async function ensureTables() {
  if (!dbConfigured) return
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS saved_lists (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        filter_query TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_saved_lists_user ON saved_lists (user_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS saved_list_items (
        list_id BIGINT NOT NULL REFERENCES saved_lists(id) ON DELETE CASCADE,
        org_number TEXT NOT NULL,
        PRIMARY KEY (list_id, org_number)
      );
      CREATE INDEX IF NOT EXISTS idx_saved_list_items_list ON saved_list_items (list_id);
      CREATE INDEX IF NOT EXISTS idx_saved_list_items_org ON saved_list_items (org_number);
    `)
  } catch {
    // ignore; selection will fail if schema invalid and surface error
  }
}

type ListRow = {
  id: number
  name: string
  filter_query: string | null
  created_at: string
  item_count: number
}

export async function GET() {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) return NextResponse.json({ items: [] })

  await ensureTables()

  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ items: [] })
  const userId = session.user.id

  const sql = `
    SELECT l.id, l.name, l.filter_query, l.created_at, COALESCE(c.cnt, 0) AS item_count
    FROM saved_lists l
    LEFT JOIN (
      SELECT list_id, COUNT(*)::int AS cnt
      FROM saved_list_items
      GROUP BY list_id
    ) c ON c.list_id = l.id
    WHERE l.user_id = $1
    ORDER BY l.created_at DESC
  `
  try {
    const res = await query<ListRow>(sql, [userId])
    const items = res.rows.map(r => ({
      id: r.id,
      name: r.name,
      filterQuery: r.filter_query,
      createdAt: r.created_at,
      itemCount: r.item_count,
    }))
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=120' } })
  } catch (e) {
    return NextResponse.json({ items: [] })
  }
}

export async function POST(req: Request) {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) return NextResponse.json({ ok: false }, { status: 503 })

  await ensureTables()

  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  const userId = session.user.id

  try {
    const body = await req.json().catch(() => ({})) as { name?: string; filterQuery?: string; orgNumbers?: string[] }
    const name = String(body?.name || '').trim()
    const filterQuery = String(body?.filterQuery || '').trim() || null
    const orgNumbers = Array.isArray(body?.orgNumbers) ? Array.from(new Set((body?.orgNumbers || []).map((s) => String(s || '').trim()).filter(Boolean))) : []
    if (!name) return NextResponse.json({ ok: false, error: 'Missing name' }, { status: 400 })

    // Insert list
    const insertSql = `INSERT INTO saved_lists (user_id, name, filter_query) VALUES ($1, $2, $3) RETURNING id`
    const insRes = await query<{ id: number }>(insertSql, [userId, name, filterQuery])
    const listId = insRes.rows[0]?.id
    if (!listId) return NextResponse.json({ ok: false }, { status: 500 })

    // Insert items
    // 1) If filterQuery is provided, populate items server-side using the same eligibility as search
    if (filterQuery) {
      const sp = new URLSearchParams(filterQuery.replace(/^\?/, ''))

      // Build filters similar to /api/businesses
      const params: (string | number | boolean | string[])[] = [listId]
      let sqlWhere = ''

      // Industries (code or text; multiple allowed)
      const industries = sp.getAll('industries').map(s => s.trim()).filter(Boolean)
      if (industries.length > 0) {
        const codeParams: string[] = []
        const textParams: string[] = []
        for (const v of industries) {
          const looksLikeCode = /^(\d{2}(\.\d{1,2})?|[A-Z](\d|\.)|[A-Z])$/.test(v)
          if (looksLikeCode) {
            codeParams.push(`${v}%`)
            textParams.push(`%${v}%`)
          } else {
            textParams.push(`%${v}%`)
          }
        }
        const codeConds = [
          ...codeParams.map((_, i) => `b."industryCode1" ILIKE $${params.length + i + 1}`),
          ...codeParams.map((_, i) => `b."industryCode2" ILIKE $${params.length + codeParams.length + i + 1}`),
          ...codeParams.map((_, i) => `b."industryCode3" ILIKE $${params.length + codeParams.length * 2 + i + 1}`),
        ]
        params.push(...codeParams, ...codeParams, ...codeParams)
        const textStart = params.length
        const textConds = [
          ...textParams.map((_, i) => `b."industryText1" ILIKE $${textStart + i + 1}`),
          ...textParams.map((_, i) => `b."industryText2" ILIKE $${textStart + textParams.length + i + 1}`),
          ...textParams.map((_, i) => `b."industryText3" ILIKE $${textStart + textParams.length * 2 + i + 1}`),
        ]
        params.push(...textParams, ...textParams, ...textParams)
        const all = [...codeConds, ...textConds].filter(Boolean)
        if (all.length > 0) sqlWhere += ` AND ((${all.join(') OR (')}))`
      }

      // Areas (city or postal code)
      const areas = sp.getAll('areas').map(s => s.trim()).filter(Boolean)
      if (areas.length > 0) {
        const cityStart = params.length
        const city = areas.map((_, i) => `b."addressCity" ILIKE $${cityStart + i + 1}`).join(' OR ')
        params.push(...areas.map(v => `%${v}%`))
        const postalStart = params.length
        const postal = areas.map((_, i) => `b."addressPostalCode" ILIKE $${postalStart + i + 1}`).join(' OR ')
        params.push(...areas.map(v => `%${v}%`))
        sqlWhere += ` AND ((${city}) OR (${postal}))`
      }

      // Org form codes (multiple)
      const orgFormCodes = sp.getAll('orgFormCode').map(s => s.trim()).filter(Boolean)
      let orgFormClause = ''
      if (orgFormCodes.length > 0) {
        params.push(orgFormCodes)
        orgFormClause = ` AND b."orgFormCode" = ANY($${params.length}::text[])`
      }

      // Revenue / Profit
      const revMin = sp.get('revenueMin'); const revMax = sp.get('revenueMax')
      const hasRevMin = revMin != null && revMin !== '' && !Number.isNaN(Number(revMin))
      const hasRevMax = revMax != null && revMax !== '' && !Number.isNaN(Number(revMax))
      let revenueClause = ''
      if (hasRevMin && hasRevMax) {
        params.push(parseInt(revMin!, 10), parseInt(revMax!, 10))
        revenueClause = ` AND fLatest.revenue >= $${params.length - 1} AND fLatest.revenue <= $${params.length}`
      } else if (hasRevMin) {
        params.push(parseInt(revMin!, 10))
        revenueClause = ` AND fLatest.revenue >= $${params.length}`
      } else if (hasRevMax) {
        params.push(parseInt(revMax!, 10))
        revenueClause = ` AND fLatest.revenue <= $${params.length}`
      }
      const pMin = sp.get('profitMin'); const pMax = sp.get('profitMax')
      const hasPMin = pMin != null && pMin !== '' && !Number.isNaN(Number(pMin))
      const hasPMax = pMax != null && pMax !== '' && !Number.isNaN(Number(pMax))
      let profitClause = ''
      if (hasPMin && hasPMax) {
        params.push(parseInt(pMin!, 10), parseInt(pMax!, 10))
        profitClause = ` AND fLatest.profit >= $${params.length - 1} AND fLatest.profit <= $${params.length}`
      } else if (hasPMin) {
        params.push(parseInt(pMin!, 10))
        profitClause = ` AND fLatest.profit >= $${params.length}`
      } else if (hasPMax) {
        params.push(parseInt(pMax!, 10))
        profitClause = ` AND fLatest.profit <= $${params.length}`
      }

      // Events presence and specific types
      const evFilter = (sp.get('events') || '').trim().toLowerCase()
      const withEvents = evFilter === 'with'
      const withoutEvents = evFilter === 'without'
      const eventTypesCsv = (sp.get('eventTypes') || '').trim()
      const eventTypes = eventTypesCsv ? eventTypesCsv.split(',').map(s => s.trim()).filter(Boolean) : []
      let eventsWhere = ''
      if (withoutEvents) {
        eventsWhere = ` AND NOT EXISTS (SELECT 1 FROM public.events_public e WHERE e.org_number = b."orgNumber")`
      } else if (withEvents || eventTypes.length > 0) {
        if (eventTypes.length > 0) {
          params.push(eventTypes)
          eventsWhere = ` AND EXISTS (SELECT 1 FROM public.events_public e WHERE e.org_number = b."orgNumber" AND e.event_type = ANY($${params.length}::text[]))`
        } else {
          eventsWhere = ` AND EXISTS (SELECT 1 FROM public.events_public e WHERE e.org_number = b."orgNumber")`
        }
      }

      // Website tech filters
      const wantsShopify = sp.has('webCmsShopify')
      const wantsWoo = sp.has('webEcomWoocommerce')
      const webWhere = wantsShopify || wantsWoo ? ` AND ${[
        wantsShopify ? 'COALESCE(w."webCmsShopify", false) = true' : null,
        wantsWoo ? 'COALESCE(w."webEcomWoocommerce", false) = true' : null,
      ].filter(Boolean).join(' AND ')}` : ''

      // Registration date
      const registeredFrom = (sp.get('registeredFrom') || '').trim()
      const registeredTo = (sp.get('registeredTo') || '').trim()
      let regWhere = ''
      if (registeredFrom) { params.push(registeredFrom); regWhere += ` AND b."registeredAtBrreg" >= $${params.length}` }
      if (registeredTo) { params.push(registeredTo + 'T23:59:59.999Z'); regWhere += ` AND b."registeredAtBrreg" <= $${params.length}` }

      // Text search (simple)
      const q = (sp.get('q') || '').trim()
      let searchWhere = ''
      if (q) {
        params.push(`%${q}%`, `%${q}%`)
        searchWhere = ` AND (b.name ILIKE $${params.length - 1} OR b."orgNumber" ILIKE $${params.length})`
      }

      const needsFinancialJoin = Boolean(revenueClause || profitClause)
      const needsWebJoin = Boolean(wantsShopify || wantsWoo)

      const insertSql = `
        INSERT INTO saved_list_items (list_id, org_number)
        SELECT $1 as list_id, b."orgNumber" as org_number
        FROM "Business" b
        ${needsWebJoin ? 'LEFT JOIN "BusinessWebMeta" w ON w."businessId" = b.id' : ''}
        ${needsFinancialJoin ? `LEFT JOIN LATERAL (
          SELECT f."fiscalYear", f.revenue, f.profit
          FROM "FinancialReport" f
          WHERE f."businessId" = b.id
          ORDER BY f."fiscalYear" DESC NULLS LAST
          LIMIT 1
        ) fLatest ON TRUE` : ''}
        WHERE (b."registeredInForetaksregisteret" = true OR b."orgFormCode" IN ('AS','ASA','ENK','ANS','DA','NUF','SA','SAS','A/S','A/S/ASA'))
        ${orgFormClause}
        ${sqlWhere}
        ${revenueClause}
        ${profitClause}
        ${eventsWhere}
        ${searchWhere}
        ${webWhere}
        ${regWhere}
        ON CONFLICT DO NOTHING
      `
      await query(insertSql, params)
    } else if (orgNumbers.length > 0) {
      // 2) Fallback: insert provided orgNumbers batch
      const values: string[] = []
      const params: (string | number)[] = []
      orgNumbers.forEach((org, idx) => {
        values.push(`($1, $${idx + 2})`)
        params.push(org)
      })
      const sql = `INSERT INTO saved_list_items (list_id, org_number) VALUES ${values.join(',')} ON CONFLICT DO NOTHING`
      await query(sql, [listId, ...params])
    }

    return NextResponse.json({ ok: true, id: listId })
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
