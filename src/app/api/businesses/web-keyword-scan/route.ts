import { NextResponse } from 'next/server'
import { checkApiAccess } from '@/lib/access-control'
import { dbConfigured, query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Utilities adapted from offline scan script (simplified)
function escapeRegExp(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`) }
function stripTagsFast(html: string): string {
  let s = html
  s = s.replace(/<!--[\s\S]*?-->/g, ' ')
  s = s.replace(/<(script|style|noscript|svg|canvas)[\s\S]*?<\/\1>/gi, ' ')
  s = s.replace(/<[^>]+>/g, ' ')
  s = s.replace(/&nbsp;/g, ' ')
  return s
}
function htmlToText(html: string): string {
  if (!html) return ''
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  let title = ''
  if (titleMatch) title = stripTagsFast(titleMatch[1]).replace(/\s+/g, ' ').trim()
  let body = stripTagsFast(html)
  body = body.replace(/\s+/g, ' ').trim()
  if (title && body && body.toLowerCase().indexOf(title.toLowerCase()) !== 0) {
    return title + ' | ' + body
  }
  return title || body
}
function tokenizeWords(s: string): string[] { return s.toLowerCase().match(/\b\w+\b/g) || [] }

export async function POST(req: Request) {
  const accessError = await checkApiAccess()
  if (accessError) return accessError
  if (!dbConfigured) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  let body: { orgNumbers?: string[]; keywords?: string[]; limit?: number; topRevenue?: number; exportCsv?: boolean } = {}
  try { body = await req.json() } catch {}
  let orgNumbers = (body.orgNumbers || []).map(s => String(s).trim()).filter(Boolean)
  const keywords = Array.from(new Set((body.keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean)))
  const topRevenue = body.topRevenue && Number.isFinite(body.topRevenue) ? Math.floor(body.topRevenue) : null
  const wantCsv = !!body.exportCsv
  // Allow using topRevenue without explicitly passing orgNumbers
  if (orgNumbers.length === 0 && topRevenue) {
    try {
      const { rows: revRows } = await query<{ orgNumber: string }>(
        `SELECT b."orgNumber"
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
         AND COALESCE(NULLIF(TRIM(b.website), ''), NULL) IS NOT NULL
         ORDER BY fr.revenue DESC NULLS LAST
         LIMIT $1`, [topRevenue]
      )
      orgNumbers = revRows.map(r => r.orgNumber).filter(Boolean)
    } catch (e) {
      console.error('[web-keyword-scan] topRevenue fetch failed', e)
    }
  }
  if (orgNumbers.length === 0) return NextResponse.json({ error: 'orgNumbers or topRevenue required' }, { status: 400 })
  if (keywords.length === 0) return NextResponse.json({ error: 'keywords required' }, { status: 400 })
  
  // Get the actual maximum number of companies with websites available
  let maxAvailable = 40000 // fallback
  try {
    const { rows: countRows } = await query<{ count: string }>(
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
    if (countRows[0]) {
      maxAvailable = parseInt(countRows[0].count)
    }
  } catch (e) {
    console.error('[web-keyword-scan] failed to get max available count', e)
  }
  
  const limitRaw = body.limit == null ? 500 : Number(body.limit)
  let limit: number | null
  if (!Number.isFinite(limitRaw)) {
    limit = 500
  } else if (limitRaw <= 0) {
    // 0 or negative => use all available
    limit = null
  } else {
    limit = Math.min(limitRaw, maxAvailable)
  }
  const slice = limit ? orgNumbers.slice(0, limit) : orgNumbers

  try {
    const { rows } = await query<{ orgNumber: string; name: string | null; website: string | null; revenue: number | null; webRawHtml: string | null; webHtmlKb: number | null; webStatus: number | null; webFinalUrl: string | null }>(
      `SELECT b."orgNumber", b."name", b."website", fr.revenue, w."webRawHtml", w."webHtmlKb", w."webStatus", w."webFinalUrl"
       FROM "Business" b
       JOIN "BusinessWebMeta" w ON w."businessId" = b.id
       LEFT JOIN LATERAL (
         SELECT f.revenue
         FROM "FinancialReport" f
         WHERE f."businessId" = b.id
         ORDER BY f."fiscalYear" DESC NULLS LAST
         LIMIT 1
       ) fr ON TRUE
       WHERE b."orgNumber" = ANY($1::text[])
       AND w."webRawHtml" IS NOT NULL`,
      [slice]
    )

    // Precompile patterns with word boundaries; if a keyword contains spaces fallback to simple indexOf for presence and count
    const singleWordPatterns: Record<string, RegExp> = {}
    for (const kw of keywords) {
      if (/\s/.test(kw)) continue
      singleWordPatterns[kw] = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'gi')
    }

  const items = rows.map(r => {
      const text = htmlToText(r.webRawHtml || '')
      const tokens = tokenizeWords(text)
      const total = tokens.length || 1
      const stats: Record<string, { present: boolean; count: number; density: number }> = {}
      for (const kw of keywords) {
        let count = 0
        if (singleWordPatterns[kw]) {
          const m = text.match(singleWordPatterns[kw])
          count = m ? m.length : 0
        } else {
          // Multi-word keyword: approximate count via splitting
          const lower = text.toLowerCase()
          const needle = kw.toLowerCase()
            // crude count of occurrences including overlaps
          let idx = 0
          while (true) {
            idx = lower.indexOf(needle, idx)
            if (idx === -1) break
            count++
            idx += needle.length
          }
        }
        stats[kw] = { present: count > 0, count, density: count / total }
      }
      return {
        orgNumber: r.orgNumber,
        name: r.name,
        website: r.website,
        revenue: r.revenue,
        webHtmlKb: r.webHtmlKb,
        webStatus: r.webStatus,
        webFinalUrl: r.webFinalUrl,
        stats
      }
    })

    if (wantCsv) {
      const header = ['orgNumber','name','revenue','website','webStatus','webHtmlKb','webFinalUrl', ...keywords.flatMap(k => [`present_${k}`,`count_${k}`,`density_${k}`])]
      const lines = [header.join(',')]
      for (const it of items) {
        const cols: (string|number)[] = [it.orgNumber, (it as any).name || '', (it as any).revenue ?? '', (it as any).website || '', it.webStatus ?? '', it.webHtmlKb ?? '', it.webFinalUrl || '']
        for (const kw of keywords) {
          const st = (it as any).stats[kw]
            cols.push(st?.present ? 1 : 0)
          cols.push(st?.count || 0)
          cols.push(st ? Number((st.density*100).toFixed(4)) : 0)
        }
        lines.push(cols.join(','))
      }
      return new NextResponse(lines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="web_keyword_scan.csv"'
        }
      })
    }
    return NextResponse.json({ keywords, items })
  } catch (e) {
    console.error('[web-keyword-scan] failed', e)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}
