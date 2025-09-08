import { NextResponse } from 'next/server'
import { checkApiAccess, getAuthorizedSession } from '@/lib/access-control'
import { dbConfigured, query, type SqlParam } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
export const maxDuration = 60

function ssePayload(event: string, data: unknown) {
  const enc = new TextEncoder()
  const lines = [`event: ${event}`, `data: ${JSON.stringify(data)}`, '', ''].join('\n')
  return enc.encode(lines)
}

export async function GET(req: Request) {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

  if (!dbConfigured) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const url = new URL(req.url)
  const name = (url.searchParams.get('name') || '').trim()
  const fqRaw = (url.searchParams.get('fq') || '').trim() // filterQuery without leading '?'
  const filterQuery = fqRaw ? `?${fqRaw}` : ''

  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      try {
        // Create list row
        const ins = await query<{ id: number }>(
          `INSERT INTO saved_lists (user_id, name, filter_query) VALUES ($1, $2, $3) RETURNING id`,
          [userId, name, filterQuery || null]
        )
        const listId = ins.rows[0]?.id
        if (!listId) throw new Error('Failed to create list')
        controller.enqueue(ssePayload('created', { id: listId }))

        // Build query conditions (similar to POST /api/lists)
        const sp = new URLSearchParams(fqRaw)
  // Collect SQL parameters (supports text, numbers, booleans, arrays) using shared SqlParam type
  const params: SqlParam[] = []
        let joins = ''
        let where = 'WHERE (b."registeredInForetaksregisteret" = true OR b."orgFormCode" IN (\'AS\',\'ASA\',\'ENK\',\'ANS\',\'DA\',\'NUF\',\'SA\',\'SAS\',\'A/S\',\'A/S/ASA\'))'

        // Industries
        const industries = sp.getAll('industries').map(s => s.trim()).filter(Boolean)
        if (industries.length > 0) {
          const codeParams: string[] = []
          const textParams: string[] = []
          for (const v of industries) {
            const looksLikeCode = /^(\d{2}(\.\d{1,2})?|[A-Z](\d|\.)|[A-Z])$/.test(v)
            if (looksLikeCode) { codeParams.push(`${v}%`); textParams.push(`%${v}%`) }
            else { textParams.push(`%${v}%`) }
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
          if (all.length > 0) where += ` AND ((${all.join(') OR (')}))`
        }

        // Areas
        const areas = sp.getAll('areas').map(s => s.trim()).filter(Boolean)
        if (areas.length > 0) {
          const cityStart = params.length
          const city = areas.map((_, i) => `b."addressCity" ILIKE $${cityStart + i + 1}`).join(' OR ')
          params.push(...areas.map(v => `%${v}%`))
          const postalStart = params.length
          const postal = areas.map((_, i) => `b."addressPostalCode" ILIKE $${postalStart + i + 1}`).join(' OR ')
          params.push(...areas.map(v => `%${v}%`))
          where += ` AND ((${city}) OR (${postal}))`
        }

        // Org form codes
        const orgFormCodes = sp.getAll('orgFormCode').map(s => s.trim()).filter(Boolean)
        if (orgFormCodes.length > 0) {
          params.push(orgFormCodes)
          where += ` AND b."orgFormCode" = ANY($${params.length}::text[])`
        }

        // Revenue / Profit
        const revMin = sp.get('revenueMin'); const revMax = sp.get('revenueMax')
        const hasRevMin = revMin != null && revMin !== '' && !Number.isNaN(Number(revMin))
        const hasRevMax = revMax != null && revMax !== '' && !Number.isNaN(Number(revMax))
        if (hasRevMin || hasRevMax) {
          joins += ` LEFT JOIN LATERAL (\n          SELECT f."fiscalYear", f.revenue, f.profit\n          FROM "FinancialReport" f\n          WHERE f."businessId" = b.id\n          ORDER BY f."fiscalYear" DESC NULLS LAST\n          LIMIT 1\n        ) fLatest ON TRUE`
          if (hasRevMin && hasRevMax) {
            params.push(parseInt(revMin!, 10), parseInt(revMax!, 10))
            where += ` AND fLatest.revenue >= $${params.length - 1} AND fLatest.revenue <= $${params.length}`
          } else if (hasRevMin) {
            params.push(parseInt(revMin!, 10))
            where += ` AND fLatest.revenue >= $${params.length}`
          } else if (hasRevMax) {
            params.push(parseInt(revMax!, 10))
            where += ` AND fLatest.revenue <= $${params.length}`
          }
        }
        const pMin = sp.get('profitMin'); const pMax = sp.get('profitMax')
        const hasPMin = pMin != null && pMin !== '' && !Number.isNaN(Number(pMin))
        const hasPMax = pMax != null && pMax !== '' && !Number.isNaN(Number(pMax))
        if (hasPMin || hasPMax) {
          if (!joins.includes('fLatest')) {
            joins += ` LEFT JOIN LATERAL (\n          SELECT f."fiscalYear", f.revenue, f.profit\n          FROM "FinancialReport" f\n          WHERE f."businessId" = b.id\n          ORDER BY f."fiscalYear" DESC NULLS LAST\n          LIMIT 1\n        ) fLatest ON TRUE`
          }
          if (hasPMin && hasPMax) {
            params.push(parseInt(pMin!, 10), parseInt(pMax!, 10))
            where += ` AND fLatest.profit >= $${params.length - 1} AND fLatest.profit <= $${params.length}`
          } else if (hasPMin) {
            params.push(parseInt(pMin!, 10))
            where += ` AND fLatest.profit >= $${params.length}`
          } else if (hasPMax) {
            params.push(parseInt(pMax!, 10))
            where += ` AND fLatest.profit <= $${params.length}`
          }
        }

        // Events
        const evFilter = (sp.get('events') || '').trim().toLowerCase()
        const withEvents = evFilter === 'with'
        const withoutEvents = evFilter === 'without'
        const eventTypesCsv = (sp.get('eventTypes') || '').trim()
        const eventTypes = eventTypesCsv ? eventTypesCsv.split(',').map(s => s.trim()).filter(Boolean) : []
        if (withoutEvents) {
          where += ` AND NOT EXISTS (SELECT 1 FROM public.events_public e WHERE e.org_number = b."orgNumber")`
        } else if (withEvents || eventTypes.length > 0) {
          if (eventTypes.length > 0) {
            params.push(eventTypes)
            where += ` AND EXISTS (SELECT 1 FROM public.events_public e WHERE e.org_number = b."orgNumber" AND e.event_type = ANY($${params.length}::text[]))`
          } else {
            where += ` AND EXISTS (SELECT 1 FROM public.events_public e WHERE e.org_number = b."orgNumber")`
          }
        }

        // Website tech
        const wantsShopify = sp.has('webCmsShopify')
        const wantsWoo = sp.has('webEcomWoocommerce')
        if (wantsShopify || wantsWoo) {
          joins += ' LEFT JOIN "BusinessWebMeta" w ON w."businessId" = b.id'
          const parts: string[] = []
          if (wantsShopify) parts.push('COALESCE(w."webCmsShopify", false) = true')
          if (wantsWoo) parts.push('COALESCE(w."webEcomWoocommerce", false) = true')
          where += ` AND ${parts.join(' AND ')}`
        }

        // Registration date
        const registeredFrom = (sp.get('registeredFrom') || '').trim()
        const registeredTo = (sp.get('registeredTo') || '').trim()
        if (registeredFrom) { params.push(registeredFrom); where += ` AND b."registeredAtBrreg" >= $${params.length}` }
        if (registeredTo) { params.push(registeredTo + 'T23:59:59.999Z'); where += ` AND b."registeredAtBrreg" <= $${params.length}` }

        // Text search
        const qText = (sp.get('q') || '').trim()
        if (qText) {
          params.push(`%${qText}%`, `%${qText}%`)
          where += ` AND (b.name ILIKE $${params.length - 1} OR b."orgNumber" ILIKE $${params.length})`
        }

        // Fetch candidate org numbers
        const selectSql = `SELECT b."orgNumber" AS org_number FROM "Business" b ${joins} ${where}`
  const rows = await query<{ org_number: string }>(selectSql, params)
        const orgs = rows.rows.map(r => String(r.org_number || '').trim()).filter(Boolean)
        const total = orgs.length
        controller.enqueue(ssePayload('progress', { total, inserted: 0 }))

        if (total === 0) {
          controller.enqueue(ssePayload('done', { inserted: 0, total, id: listId }))
          controller.close()
          return
        }

        // Insert in batches
        const batchSize = 500
        let inserted = 0
        for (let i = 0; i < orgs.length; i += batchSize) {
          const slice = orgs.slice(i, i + batchSize)
          const values = slice.map((_, idx) => `($1, $${idx + 2})`).join(',')
          const paramsIns: SqlParam[] = [listId, ...slice]
          await query(`INSERT INTO saved_list_items (list_id, org_number) VALUES ${values} ON CONFLICT DO NOTHING`, paramsIns)
          inserted += slice.length
          controller.enqueue(ssePayload('progress', { total, inserted }))
        }

        controller.enqueue(ssePayload('done', { inserted, total, id: listId }))
        controller.close()
      } catch (e) {
        try { controller.enqueue(ssePayload('error', { message: (e as Error)?.message || 'Failed to save list' })) } catch {}
        controller.close()
      }
    },
    cancel: () => {}
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

