import { NextResponse } from 'next/server'
import { dbConfigured, query, type SqlParam } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
export const maxDuration = 15

type SortBy = 'revenue' | 'employees' | 'name'
type Order = 'asc' | 'desc'

function decodeCursor(cur: string | null): { m: number | null; id: number } | null {
  if (!cur) return null
  try {
    const json = Buffer.from(cur, 'base64').toString('utf8')
    const v = JSON.parse(json)
    if (typeof v === 'object' && v) {
      const m = v.m
      const id = v.id
      return { m: m === null || m === undefined ? null : Number(m), id: Number(id) }
    }
  } catch {}
  return null
}

function encodeCursor(m: number | null, id: number): string {
  const payload = { m, id }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

export async function GET(req: Request) {
  if (!dbConfigured) {
    return NextResponse.json(
      { items: [], cursor: { next: null }, tookMs: 0 },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  }
  const start = Date.now()
  const url = new URL(req.url)
  const sp = url.searchParams

  const sortBy = (sp.get('sortBy') as SortBy) || 'revenue'
  const order = (sp.get('order') as Order) || (sortBy === 'name' ? 'asc' : 'desc')
  const limit = Math.max(1, Math.min(200, parseInt(sp.get('limit') || '100', 10) || 100))
  const cursor = sp.get('cursor')
  const explain = sp.get('explain') === 'true'

  // Filters per contract
  const industryCode = (sp.get('industryCode') || '').trim() || null
  const sectorCode = (sp.get('sectorCode') || '').trim() || null
  const orgFormCode = (sp.get('orgFormCode') || '').trim() || null
  const city = (sp.get('city') || '').trim() || null
  const revenueBucket = (sp.get('revenueBucket') || '').trim() || null
  const employeeBucket = (sp.get('employeeBucket') || '').trim() || null
  const vatRegistered = sp.get('vatRegistered')
  const vatRegisteredBool =
    vatRegistered == null || vatRegistered === ''
      ? null
      : ['1', 'true', 'yes'].includes(vatRegistered.toLowerCase())
  const search = (sp.get('search') || '').trim() || null
  const events = (sp.get('events') || '').trim().toLowerCase() as 'with' | 'without' | ''

  // WHERE builder
  const where: string[] = []
  const params: SqlParam[] = []

  // Industry: accept either code or text for convenience; prefer code match
  if (industryCode) {
    const looksLikeCode = /[0-9]{2}(\.[0-9]{1,2})?/.test(industryCode) || /^(\d|[A-Z])/.test(industryCode)
    if (looksLikeCode) {
      params.push(industryCode)
      where.push(`m.industry_code1 = $${params.length}`)
    } else {
      params.push(`%${industryCode}%`)
      where.push(`m.industry_text1 ILIKE $${params.length}`)
    }
  }
  if (sectorCode) {
    params.push(sectorCode)
    where.push(`m.sector_code = $${params.length}`)
  }
  if (orgFormCode) {
    params.push(orgFormCode)
    where.push(`m.org_form_code = $${params.length}`)
  }
  if (city) {
    params.push(city)
    where.push(`m.address_city ILIKE $${params.length}`)
  }
  if (revenueBucket) {
    params.push(revenueBucket)
    where.push(`m.revenue_bucket = $${params.length}`)
  }
  if (employeeBucket) {
    params.push(employeeBucket)
    where.push(`m.employee_bucket = $${params.length}`)
  }
  if (vatRegisteredBool !== null) {
    params.push(vatRegisteredBool)
    where.push(`m.vat_registered = $${params.length}`)
  }
  if (events === 'with') {
    where.push(`m.has_events = true`)
  } else if (events === 'without') {
    where.push(`m.has_events = false`)
  }
  if (search) {
    // tsquery match; optionally allow trigram when length >= 3
    params.push(search)
    const qIdx = params.length
    const hasTri = search.length >= 3
    where.push(
      hasTri
        ? `(m.search_vector @@ plainto_tsquery('norwegian', $${qIdx}) OR m.name % $${qIdx})`
        : `m.search_vector @@ plainto_tsquery('norwegian', $${qIdx})`,
    )
  }

  // Keyset pagination for revenue/employees; name uses OFFSET fallback (not provided in this route)
  const cur = decodeCursor(cursor)
  let keysetWhere = ''
  if ((sortBy === 'revenue' || sortBy === 'employees') && cur) {
    const metricCol = sortBy === 'revenue' ? 'm.revenue' : 'm.employees'
    // NULLS LAST semantics: only paginate within non-null metrics; nulls are only on first page after non-nulls are exhausted
    if (cur.m == null) {
      // Cursor into null partition, paginate by id only within nulls
      params.push(cur.id)
      keysetWhere = order === 'desc' ? `(${metricCol} IS NULL AND m.id < $${params.length})` : `(${metricCol} IS NULL AND m.id > $${params.length})`
    } else {
      params.push(cur.m, cur.id)
      const a = `$${params.length - 1}`
      const b = `$${params.length}`
      keysetWhere =
        order === 'desc'
          ? `(((${metricCol}) IS NOT NULL AND ${metricCol} < ${a}) OR (${metricCol} = ${a} AND m.id < ${b}))`
          : `(((${metricCol}) IS NOT NULL AND ${metricCol} > ${a}) OR (${metricCol} = ${a} AND m.id > ${b}))`
    }
  }

  const whereSql = where.length > 0 || keysetWhere ? `WHERE ${[...where, keysetWhere].filter(Boolean).join(' AND ')}` : ''

  // Sorting and tie-breaker
  let orderSql = ''
  switch (sortBy) {
    case 'name':
      // Attempt Norwegian collation if available; fall back silently
      orderSql = `ORDER BY m.name ASC, m.id ASC`
      break
    case 'employees':
      orderSql = `ORDER BY m.employees ${order.toUpperCase()} NULLS LAST, m.id ${order.toUpperCase()}`
      break
    case 'revenue':
    default:
      orderSql = `ORDER BY m.revenue ${order.toUpperCase()} NULLS LAST, m.id ${order.toUpperCase()}`
      break
  }

  const selectSql = `
    SELECT
      m.id,
      m.org_number,
      m.name,
      m.industry_text1,
      m.revenue,
      m.employees,
      m.address_city,
      m.revenue_bucket,
  m.employee_bucket,
  m.has_events
    FROM public.business_filter_matrix m
    ${whereSql}
    ${orderSql}
    LIMIT ${limit}
  `

  const explainSql = explain ? `EXPLAIN (ANALYZE, BUFFERS, TIMING) ${selectSql}` : null

  try {
    const res = await query<Record<string, unknown>>(explain ? (explainSql as string) : selectSql, params)
    if (explain) {
      // Return plan for diagnostics in dev
      const plan = res.rows.map((r: Record<string, unknown>) => r['QUERY PLAN'] || Object.values(r)[0]).join('\n')
      const tookMs = Date.now() - start
      console.log(`[businesses] instant explain took ${tookMs}ms`)
      return NextResponse.json({ explain: plan, tookMs }, {
        headers: {
          'Cache-Control': 's-maxage=15',
        },
      })
    }

    const rows = res.rows as Array<{
      id: number
      org_number: string
      name: string | null
      industry_text1: string | null
      revenue: number | null
      employees: number | null
      address_city: string | null
      revenue_bucket: string | null
      employee_bucket: string | null
    }>

    // Compute next cursor
    let next: string | null = null
    if (rows.length === limit) {
      const last = rows[rows.length - 1]
      let metric: number | null = null
      if (sortBy === 'revenue') metric = last.revenue ?? null
      if (sortBy === 'employees') metric = last.employees ?? null
      if (sortBy === 'name') metric = null
      if (sortBy === 'name') {
        // For name sort, recommend using offset-based pagination in the client; next stays null
        next = null
      } else {
        next = encodeCursor(metric, last.id)
      }
    }

    const tookMs = Date.now() - start
    console.log(
      `[businesses] instant list took ${tookMs}ms (sortBy=${sortBy}, order=${order}, limit=${limit}) -> ${rows.length} rows`,
    )
    return NextResponse.json(
      { items: rows, cursor: { next }, tookMs },
      {
        headers: {
          'Cache-Control': 's-maxage=15',
        },
      },
    )
  } catch (e) {
    console.error('[businesses] instant list error', e)
    return NextResponse.json(
      { items: [], cursor: { next: null }, tookMs: Date.now() - start },
      { status: 200, headers: { 'Cache-Control': 's-maxage=5' } },
    )
  }
}
