import { NextResponse } from 'next/server'
import { dbConfigured } from '@/lib/db'
import { checkApiAccess } from '@/lib/access-control'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
import { query, type SqlParam } from '@/lib/db'

import { apiCache } from '@/lib/api-cache'

export async function GET(req: Request) {
  // Check authentication and authorization first
  const accessError = await checkApiAccess()
  if (accessError) {
    return accessError
  }

  if (!dbConfigured) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 },
    )
  }
  const { searchParams } = new URL(req.url)
  const source = 'general'
  const offset = Math.max(
    0,
    parseInt(searchParams.get('offset') || '0', 10) || 0,
  )
  const skipCount = ['1', 'true'].includes(
    (searchParams.get('skipCount') || '').toLowerCase(),
  )
  const countOnly = ['1', 'true'].includes(
    (searchParams.get('countOnly') || '').toLowerCase(),
  )
  const singleIndustry = searchParams.get('industry')?.trim() || ''
  const q = (searchParams.get('q') || '').trim()
  const orgFormCodes = searchParams
    .getAll('orgFormCode')
    .map((s) => s.trim())
    .filter(Boolean)
  const industries = [
    ...searchParams
      .getAll('industries')
      .map((s) => s.trim())
      .filter(Boolean),
    singleIndustry || undefined,
  ].filter(Boolean) as string[]

  // Area filtering (city or postal code)
  const areas = searchParams
    .getAll('areas')
    .map((s) => s.trim())
    .filter(Boolean) as string[]

  // Revenue filtering
  // New flexible filtering via revenueMin/revenueMax takes precedence over revenueRange buckets
  const revenueRange = searchParams.get('revenueRange')?.trim()
  const revenueMinRaw = searchParams.get('revenueMin')?.trim()
  const revenueMaxRaw = searchParams.get('revenueMax')?.trim()
  const hasRevenueMin = revenueMinRaw != null && revenueMinRaw !== '' && !Number.isNaN(Number(revenueMinRaw))
  const hasRevenueMax = revenueMaxRaw != null && revenueMaxRaw !== '' && !Number.isNaN(Number(revenueMaxRaw))
  // Allow negative lower bounds; only coerce to integers
  const revenueMinVal = hasRevenueMin ? parseInt(revenueMinRaw as string, 10) : null
  const revenueMaxVal = hasRevenueMax ? parseInt(revenueMaxRaw as string, 10) : null

  let revenueClause = ''
  const revenueParams: number[] = []
  let revenueMinIdx: number | null = null
  let revenueMaxIdx: number | null = null

  if (hasRevenueMin || hasRevenueMax) {
    // Flexible range: inclusive bounds
    if (hasRevenueMin && hasRevenueMax) {
      revenueClause = 'AND f.revenue >= $REVENUE_MIN AND f.revenue <= $REVENUE_MAX'
      revenueParams.push(revenueMinVal as number, revenueMaxVal as number)
    } else if (hasRevenueMin) {
      revenueClause = 'AND f.revenue >= $REVENUE_MIN'
      revenueParams.push(revenueMinVal as number)
    } else if (hasRevenueMax) {
      revenueClause = 'AND f.revenue <= $REVENUE_MAX'
      revenueParams.push(revenueMaxVal as number)
    }
  } else if (revenueRange) {
    // Backwards-compatible buckets
    switch (revenueRange) {
      case '0-1M':
        revenueClause =
          'AND f.revenue >= $REVENUE_MIN AND f.revenue < $REVENUE_MAX'
        revenueParams.push(0, 1000000)
        break
      case '1M-10M':
        revenueClause =
          'AND f.revenue >= $REVENUE_MIN AND f.revenue < $REVENUE_MAX'
        revenueParams.push(1000000, 10000000)
        break
      case '10M-100M':
        revenueClause =
          'AND f.revenue >= $REVENUE_MIN AND f.revenue < $REVENUE_MAX'
        revenueParams.push(10000000, 100000000)
        break
      case '100M+':
        revenueClause = 'AND f.revenue >= $REVENUE_MIN'
        revenueParams.push(100000000)
        break
    }
  }

  // Profit filtering
  const profitMinRaw = searchParams.get('profitMin')?.trim()
  const profitMaxRaw = searchParams.get('profitMax')?.trim()
  const hasProfitMin = profitMinRaw != null && profitMinRaw !== '' && !Number.isNaN(Number(profitMinRaw))
  const hasProfitMax = profitMaxRaw != null && profitMaxRaw !== '' && !Number.isNaN(Number(profitMaxRaw))
  // Allow negative lower bounds; only coerce to integers
  const profitMinVal = hasProfitMin ? parseInt(profitMinRaw as string, 10) : null
  const profitMaxVal = hasProfitMax ? parseInt(profitMaxRaw as string, 10) : null

  let profitClause = ''
  const profitParams: number[] = []
  let profitMinIdx: number | null = null
  let profitMaxIdx: number | null = null

  if (hasProfitMin || hasProfitMax) {
    // Flexible range: inclusive bounds
    if (hasProfitMin && hasProfitMax) {
      profitClause = 'AND f.profit >= $PROFIT_MIN AND f.profit <= $PROFIT_MAX'
      profitParams.push(profitMinVal as number, profitMaxVal as number)
    } else if (hasProfitMin) {
      profitClause = 'AND f.profit >= $PROFIT_MIN'
      profitParams.push(profitMinVal as number)
    } else if (hasProfitMax) {
      profitClause = 'AND f.profit <= $PROFIT_MAX'
      profitParams.push(profitMaxVal as number)
    }
  }

  // Removed recommendation and score filtering

  // Events filtering: events=with|without
  const eventsFilter = searchParams.get('events')?.trim().toLowerCase()
  const withEvents = eventsFilter === 'with'
  const withoutEvents = eventsFilter === 'without'
  // Advanced event type filtering and weighting
  const eventTypesCsv = (searchParams.get('eventTypes') || '').trim()
  const eventTypes = eventTypesCsv
    ? eventTypesCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  // eventWeights is a JSON string mapping type -> weight between -10 and 10
  let eventWeights: Record<string, number> = {}
  const eventWeightsRaw = searchParams.get('eventWeights')
  if (eventWeightsRaw) {
    try {
      const parsed = JSON.parse(eventWeightsRaw)
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          const num = Number(v)
          if (!Number.isNaN(num)) {
            // clamp to [-10, 10]
            eventWeights[k] = Math.max(-10, Math.min(10, num))
          }
        }
      }
    } catch {
      // ignore malformed input
      eventWeights = {}
    }
  }

  // Sorting
  const sortBy = searchParams.get('sortBy')?.trim() || 'updatedAt'
  const allowedSorts = [
    'updatedAt',
    'name',
    'revenue',
    'employees',
    // new: score sorting
    'scoreAsc',
    'scoreDesc',
  ]
  let validSortBy = allowedSorts.includes(sortBy) ? sortBy : 'updatedAt'
  
  // Disable score sorting when no event types are selected
  if ((validSortBy === 'scoreAsc' || validSortBy === 'scoreDesc') && eventTypes.length === 0) {
    console.log(`[businesses] Score sorting disabled - no event types selected, falling back to updatedAt`)
    validSortBy = 'updatedAt'
  }

  // Debug: Log all requests with their parameters
  const sortByParam = searchParams.get('sortBy')?.trim() || 'updatedAt'
  console.log(
    `[businesses] REQUEST: source=${source}, sortBy=${sortByParam}, validSortBy=${validSortBy}, eventsFilter=${eventsFilter}, eventTypes=${JSON.stringify(eventTypes)}, URL=${req.url}`,
  )

  const isCsvSource = false

  // Create cache key from request parameters
  const cacheParams = {
    source,
    offset,
    skipCount,
    countOnly,
    industries: industries.sort(), // Sort for consistent cache keys
    revenueRange,
    profitMin: profitMinRaw,
    profitMax: profitMaxRaw,
    eventsFilter: eventsFilter || '',
  eventTypes: eventTypes,
  eventWeights,
    sortBy: validSortBy,
    q,
    areas: areas.sort(),
    orgFormCodes: orgFormCodes.sort(),
  }

  // Check cache first
  const shouldCache = true
  if (shouldCache) {
    const cached = apiCache.get<{
      items: Record<string, unknown>[]
      total: number
    }>(cacheParams)
    if (cached) {
      console.log(`[businesses] CACHE HIT for sortBy=${validSortBy}`)
      return NextResponse.json(cached)
    } else {
      console.log(`[businesses] CACHE MISS for sortBy=${validSortBy}`)
    }
  }

  const hasIndustries = industries.length > 0
  const industryParams = industries.map((v) => `%${v}%`)
  const hasAreas = areas.length > 0
  const areaParams = areas.map((v) => `%${v}%`)
  const perColumnClause = (col: string) =>
    industries.length > 0
      ? industries.map((_, i) => `${col} ILIKE $${i + 1}`).join(' OR ')
      : ''
  const industryClause = hasIndustries
    ? `AND ((${perColumnClause('b."industryCode1"')} ) OR (${perColumnClause('b."industryText1"')}) OR (${perColumnClause('b."industryCode2"')}) OR (${perColumnClause('b."industryText2"')}) OR (${perColumnClause('b."industryCode3"')}) OR (${perColumnClause('b."industryText3"')}))`
    : ''

  // Build area clause using parameter indexes after industries
  const areaClause = hasAreas
    ? (() => {
        const base = industryParams.length
        const city = areas.map((_, i) => `b."addressCity" ILIKE $${base + i + 1}`).join(' OR ')
        const postal = areas.map((_, i) => `b."addressPostalCode" ILIKE $${base + i + 1}`).join(' OR ')
        return `AND ((${city}) OR (${postal}))`
      })()
    : ''

  // Combine all params - industries first, then areas, then revenue, then profit (we'll append event params below)
  const params: SqlParam[] = [...industryParams, ...areaParams]
  // Reserve parameter indexes for revenue and push actual values in order
  if (revenueClause) {
    const startIdx = params.length + 1
    if (revenueParams.length === 2) {
      revenueMinIdx = startIdx
      revenueMaxIdx = startIdx + 1
      params.push(revenueParams[0], revenueParams[1])
    } else if (revenueParams.length === 1) {
      // Determine which side is present by inspecting clause string
      if (/\$REVENUE_MIN/.test(revenueClause)) {
        revenueMinIdx = startIdx
      }
      if (/\$REVENUE_MAX/.test(revenueClause)) {
        revenueMaxIdx = startIdx
      }
      params.push(revenueParams[0])
    }
  }

  // Reserve parameter indexes for profit and push actual values in order
  if (profitClause) {
    const startIdx = params.length + 1
    if (profitParams.length === 2) {
      profitMinIdx = startIdx
      profitMaxIdx = startIdx + 1
      params.push(profitParams[0], profitParams[1])
    } else if (profitParams.length === 1) {
      // Determine which side is present by inspecting clause string
      if (/\$PROFIT_MIN/.test(profitClause)) {
        profitMinIdx = startIdx
      }
      if (/\$PROFIT_MAX/.test(profitClause)) {
        profitMaxIdx = startIdx
      }
      params.push(profitParams[0])
    }
  }

  // Optional company type (org form) filter - support multiple values
  let orgFormIdx: number | null = null
  if (orgFormCodes.length > 0) {
    orgFormIdx = params.length + 1
    params.push(orgFormCodes)
  }

  // Optional text search by company name or organization number
  let searchClause = ''
  let nameIdx: number | null = null
  let orgIdx: number | null = null
  let namePrefixIdx: number | null = null
  if (q) {
    nameIdx = params.length + 1
    orgIdx = params.length + 2
    params.push(`%${q}%`, `%${q}%`)
    // Add starts-with pattern for better ranking
    namePrefixIdx = params.length + 1
    params.push(`${q}%`)
    searchClause = `AND (b.name ILIKE $${nameIdx} OR b."orgNumber" ILIKE $${orgIdx})`
  }

  // Update clause placeholders with actual parameter positions
  if (revenueClause) {
    revenueClause = revenueClause
      .replace('$REVENUE_MIN', revenueMinIdx ? `$${revenueMinIdx}` : '$REVENUE_MIN')
      .replace('$REVENUE_MAX', revenueMaxIdx ? `$${revenueMaxIdx}` : '$REVENUE_MAX')
  }

  if (profitClause) {
    profitClause = profitClause
      .replace('$PROFIT_MIN', profitMinIdx ? `$${profitMinIdx}` : '$PROFIT_MIN')
      .replace('$PROFIT_MAX', profitMaxIdx ? `$${profitMaxIdx}` : '$PROFIT_MAX')
  }

  // Optimized query structure
  const baseWhere = `
		WHERE (b."registeredInForetaksregisteret" = true OR b."orgFormCode" IN ('AS','ASA','ENK','ANS','DA','NUF','SA','SAS','A/S','A/S/ASA'))
		${industryClause}
		${areaClause}
    ${orgFormIdx ? `AND b."orgFormCode" = ANY($${orgFormIdx}::text[])` : ''}
		${searchClause}
	`

  // Compute parameter indexes for optional event filters/weights
  const eventTypesIdx = eventTypes.length > 0 ? params.length + 1 : null
  if (eventTypesIdx) {
    params.push(eventTypes)
    console.log(`[businesses] Adding eventTypes filter: ${JSON.stringify(eventTypes)} at index ${eventTypesIdx}`)
    console.log(`[businesses] Full params array: ${JSON.stringify(params)}`)
  }
  const hasWeights = Object.keys(eventWeights).length > 0
  const weightsIdx = hasWeights ? params.length + 1 : null
  if (weightsIdx) params.push(JSON.stringify(eventWeights))

  // Always join the latest financials so revenue is available for display and sorting
  const itemsSql = `
    SELECT
      b."orgNumber",
      b.name,
      b.website,
      b.employees,
      b."addressStreet",
      b."addressPostalCode",
      b."addressCity",
      ${
        isCsvSource
          ? 'NULL'
          : `(SELECT c."fullName" 
       FROM "CEO" c 
       WHERE c."businessId" = b.id 
       ORDER BY c."fromDate" DESC NULLS LAST 
       LIMIT 1)`
      } as "ceo",
      b."industryCode1",
      b."industryText1",
      b."industryCode2",
      b."industryText2",
      b."industryCode3",
      b."industryText3",
      b."vatRegistered",
      b."vatRegisteredDate",
      b."sectorCode",
      b."sectorText",
      b."orgFormCode",
      b."orgFormText",
      b."registeredInForetaksregisteret",
      b."isBankrupt",
      b."isUnderLiquidation",
      b."isUnderCompulsory",
      b."createdAt",
      b."updatedAt",
			fLatest."fiscalYear" as "fiscalYear",
      fLatest.revenue as revenue,
      fLatest.profit as profit,
      fLatest."totalAssets" as "totalAssets",
      fLatest.equity as equity,
			fLatest."employeesAvg" as "employeesAvg",
      fLatest."operatingIncome" as "operatingIncome",
      fLatest."operatingResult" as "operatingResult",
      fLatest."profitBeforeTax" as "profitBeforeTax",
      fLatest.valuta as valuta,
      fLatest."fraDato" as "fraDato",
      fLatest."tilDato" as "tilDato",
      fLatest."sumDriftsinntekter" as "sumDriftsinntekter",
      fLatest.driftsresultat as driftsresultat,
      fLatest.aarsresultat as aarsresultat,
      fLatest."sumEiendeler" as "sumEiendeler",
      fLatest."sumEgenkapital" as "sumEgenkapital",
      fLatest."sumGjeld" as "sumGjeld",
      /* Raw and weighted event scores for sorting */
      evRaw."eventScore",
      ${hasWeights ? 'evScore."eventWeightedScore"' : 'NULL::int as "eventWeightedScore"'},
			EXISTS (SELECT 1 FROM public.events_public e WHERE e.org_number = b."orgNumber") as "hasEvents",
      /* Website analysis data */
      b."webFinalUrl",
      b."webStatus",
      b."webElapsedMs",
      b."webIp",
      b."webTlsValid",
      b."webTlsNotBefore",
      b."webTlsNotAfter",
      b."webTlsDaysToExpiry",
      b."webTlsIssuer",
      b."webPrimaryCms",
      b."webCmsWordpress",
      b."webCmsDrupal",
      b."webCmsJoomla",
      b."webCmsTypo3",
      b."webCmsShopify",
      b."webCmsWix",
      b."webCmsSquarespace",
      b."webCmsWebflow",
      b."webCmsGhost",
      b."webCmsDuda",
      b."webCmsCraft",
      b."webEcomWoocommerce",
      b."webEcomMagento",
      b."webPayStripe",
      b."webPayPaypal",
      b."webPayKlarna",
      b."webAnalyticsGa4",
      b."webAnalyticsGtm",
      b."webAnalyticsUa",
      b."webAnalyticsFbPixel",
      b."webAnalyticsLinkedin",
      b."webAnalyticsHotjar",
      b."webAnalyticsHubspot",
      b."webJsReact",
      b."webJsVue",
      b."webJsAngular",
      b."webJsNextjs",
      b."webJsNuxt",
      b."webJsSvelte",
      b."webHasEmailText",
      b."webHasPhoneText",
      b."webHtmlKb",
      b."webHtmlKbOver500",
      b."webHeaderServer",
      b."webHeaderXPoweredBy",
      b."webSecurityHsts",
      b."webSecurityCsp",
      b."webCookiesPresent",
      b."webCdnHint",
      b."webServerHint",
      b."webRiskFlags",
      b."webErrors",
      b."webCmsWordpressHtml",
      b."webRiskPlaceholderKw",
      b."webRiskParkedKw",
      b."webRiskSuspendedKw"
		FROM "Business" b
    LEFT JOIN LATERAL (
      SELECT 
        f."fiscalYear", 
        f.revenue, 
        f.profit, 
        f."totalAssets", 
        f.equity, 
        f."employeesAvg",
        f."operatingIncome",
        f."operatingResult", 
        f."profitBeforeTax",
        f.valuta,
        f."fraDato",
        f."tilDato",
        f."sumDriftsinntekter",
        f.driftsresultat,
        f.aarsresultat,
        f."sumEiendeler",
        f."sumEgenkapital",
        f."sumGjeld"
      FROM "FinancialReport" f
      WHERE f."businessId" = b.id
      ORDER BY f."fiscalYear" DESC NULLS LAST
      LIMIT 1
    ) fLatest ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(evr.score), 0) AS "eventScore"
      FROM public.events_public evr
      WHERE evr.org_number = b."orgNumber"
      ${eventTypesIdx ? `AND evr.event_type = ANY($${eventTypesIdx}::text[])` : ''}
      -- Debug: eventTypesIdx=${eventTypesIdx}, eventTypes=${JSON.stringify(eventTypes)}
    ) evRaw ON TRUE
    ${hasWeights ? `LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(
        COALESCE(NULLIF(($${weightsIdx}::jsonb ->> ev.event_type), '')::int, 0)
        * COALESCE(ev.score, 0)
      ), 0) AS "eventWeightedScore"
      FROM public.events_public ev
      WHERE ev.org_number = b."orgNumber"
      ${eventTypesIdx ? `AND ev.event_type = ANY($${eventTypesIdx}::text[])` : ''}
    ) evScore ON TRUE` : ''}
    ${baseWhere}
    ${revenueClause ? revenueClause.replace(/\bf\./g, 'fLatest.') : ''}
    ${profitClause ? profitClause.replace(/\bf\./g, 'fLatest.') : ''}
    ${(() => {
      const conditions = []
      
      // Event existence filtering
      if (withoutEvents) {
        conditions.push('NOT EXISTS (SELECT 1 FROM public.events_public e WHERE e.org_number = b."orgNumber")')
      } else if (withEvents || eventTypesIdx) {
        // If "with events" is selected OR specific event types are selected, only show companies with events
        if (eventTypesIdx) {
          // Only companies with the specific event types
          conditions.push(`EXISTS (SELECT 1 FROM public.events_public e WHERE e.org_number = b."orgNumber" AND e.event_type = ANY($${eventTypesIdx}::text[]))`)
        } else {
          // Only companies with any events
          conditions.push('EXISTS (SELECT 1 FROM public.events_public e WHERE e.org_number = b."orgNumber")')
        }
      }
      
      return conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''
    })()}
    ORDER BY ${(() => {
      if (q && nameIdx && orgIdx && namePrefixIdx) {
        return `CASE 
          WHEN b."orgNumber" ILIKE $${orgIdx} THEN 0
          WHEN b.name ILIKE $${namePrefixIdx} THEN 1
          WHEN b.name ILIKE $${nameIdx} THEN 2
          ELSE 3 END, b.name ASC`
      }
      switch (validSortBy) {
        case 'name':
          return 'b.name ASC'
        case 'revenue':
          return 'fLatest.revenue DESC NULLS LAST'
        case 'employees':
          return 'b.employees DESC NULLS LAST'
        case 'scoreAsc':
          // Always prefer weighted score when event types are selected, as that's what frontend displays
          return `${hasWeights && eventTypes.length > 0 ? 'evScore."eventWeightedScore" ASC NULLS FIRST' : 'evRaw."eventScore" ASC NULLS FIRST'}`
        case 'scoreDesc':
          return `${hasWeights && eventTypes.length > 0 ? 'evScore."eventWeightedScore" DESC NULLS LAST' : 'evRaw."eventWeightedScore" DESC NULLS LAST'}`
        default:
          return 'b."updatedAt" DESC'
      }
    })()}
    LIMIT 100 OFFSET ${offset}
  `

  const countSql = `
    SELECT COUNT(*)::int as total
    FROM "Business" b
    LEFT JOIN LATERAL (
      SELECT f."fiscalYear", f.revenue
      FROM "FinancialReport" f
      WHERE f."businessId" = b.id
      ORDER BY f."fiscalYear" DESC NULLS LAST
      LIMIT 1
    ) fLatest ON TRUE
    ${baseWhere}
    ${revenueClause ? revenueClause.replace(/\bf\./g, 'fLatest.') : ''}
    ${profitClause ? profitClause.replace(/\bf\./g, 'fLatest.') : ''}
    ${(() => {
      const conditions = []
      
      // Event existence filtering
      if (withoutEvents) {
        conditions.push('NOT EXISTS (SELECT 1 FROM public.events_public e WHERE e.org_number = b."orgNumber")')
      } else if (withEvents || eventTypesIdx) {
        // If "with events" is selected OR specific event types are selected, only show companies with events
        if (eventTypesIdx) {
          // Only companies with the specific event types
          conditions.push(`EXISTS (SELECT 1 FROM public.events_public e WHERE e.org_number = b."orgNumber" AND e.event_type = ANY($${eventTypesIdx}::text[]))`)
        } else {
          // Only companies with any events
          conditions.push('EXISTS (SELECT 1 FROM public.events_public e WHERE e.org_number = b."orgNumber")')
        }
      }
      
      return conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''
    })()}
  `
  let itemsRes: { rows: Record<string, unknown>[] } = { rows: [] }
  let total = 0
  let grandTotal = 0

  if (countOnly) {
    const start = Date.now()
    try {
      const countRes = await query<{ total: number }>(countSql, params)
      console.log(`[businesses] Count query took ${Date.now() - start}ms`)
      total = countRes.rows?.[0]?.total ?? 0
    } catch (error) {
      console.error(`[businesses] Count query failed:`, error)
      console.error(`[businesses] Count query was:`, countSql)
      console.error(`[businesses] Params:`, params)
      throw error
    }
    // Also fetch the unfiltered grand total (with lightweight caching via apiCache)
    try {
      const gtCacheKey = { metric: 'grandTotalBusinesses' }
      const cachedGT = apiCache.get<{ total: number }>(gtCacheKey)
      if (cachedGT) {
        grandTotal = cachedGT.total
      } else {
        const gtRes = await query<{ total: number }>(
          'SELECT COUNT(*)::int as total FROM "Business"',
        )
        grandTotal = gtRes.rows?.[0]?.total ?? 0
        apiCache.set(gtCacheKey, { total: grandTotal }, 2 * 60 * 1000) // cache 2 minutes
      }
    } catch (error) {
      console.error('[businesses] Grand total query failed:', error)
    }
  } else {
    // Normal item fetch always needed
    const start = Date.now()

    try {
      itemsRes = await query(itemsSql, params)
      console.log(
        `[businesses] Items query took ${Date.now() - start}ms (revenue: ${!!revenueClause}) - ${itemsRes.rows.length} rows returned for sortBy=${validSortBy}, source=${source}`,
      )
    } catch (error) {
      console.error(`[businesses] Items query failed:`, error)
      console.error(`[businesses] Query was:`, itemsSql)
      console.error(`[businesses] Params:`, params)
      throw error
    }
    if (!skipCount) {
      const countStart = Date.now()
      try {
        const countRes = await query<{ total: number }>(countSql, params)
        console.log(
          `[businesses] Count query took ${Date.now() - countStart}ms`,
        )
        total = countRes.rows?.[0]?.total ?? 0
      } catch (error) {
        console.error(`[businesses] Count query failed:`, error)
        console.error(`[businesses] Count query was:`, countSql)
        console.error(`[businesses] Params:`, params)
        throw error
      }
    }

    // Fetch unfiltered grand total once per request (from cache if available)
    try {
      const gtCacheKey = { metric: 'grandTotalBusinesses' }
      const cachedGT = apiCache.get<{ total: number }>(gtCacheKey)
      if (cachedGT) {
        grandTotal = cachedGT.total
      } else {
        const gtRes = await query<{ total: number }>(
          'SELECT COUNT(*)::int as total FROM "Business"',
        )
        grandTotal = gtRes.rows?.[0]?.total ?? 0
        apiCache.set(gtCacheKey, { total: grandTotal }, 2 * 60 * 1000)
      }
    } catch (error) {
      console.error('[businesses] Grand total query failed:', error)
    }
  }

  const filteredItems = itemsRes.rows as Array<Record<string, unknown>>

  if (countOnly) {
    const countResponse = { items: [], total, grandTotal }

    // Cache count-only responses
    if (shouldCache) {
      apiCache.set(cacheParams, countResponse, 30 * 1000) // 30s cache for counts
    }

    return NextResponse.json(countResponse)
  }

  const response = { items: filteredItems, total, grandTotal }

  // Cache the response for future requests
  if (shouldCache) {
    apiCache.set(cacheParams, response, 2 * 60 * 1000) // 2min cache
  }

  return NextResponse.json(response)
}

