import { NextResponse } from 'next/server'
import { checkApiAccess } from '@/lib/access-control'
import { dbConfigured, query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for large scans

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
  
  let body: { orgNumbers?: string[]; keywords?: string[]; limit?: number; topRevenue?: number } = {}
  try { body = await req.json() } catch {}
  
  let orgNumbers = (body.orgNumbers || []).map(s => String(s).trim()).filter(Boolean)
  const keywords = Array.from(new Set((body.keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean)))
  const topRevenue = body.topRevenue && Number.isFinite(body.topRevenue) ? Math.floor(body.topRevenue) : null
  
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
      console.error('[web-keyword-scan-stream] topRevenue fetch failed', e)
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
    console.error('[web-keyword-scan-stream] failed to get max available count', e)
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

  const encoder = new TextEncoder()
  const batchSize = 50 // Smaller batches for more frequent updates
  
  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      try {
        // Send initial metadata
        const metadata = { type: 'metadata', keywords, totalOrgNumbers: slice.length, maxAvailable }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`))
        
        // Precompile patterns with word boundaries
        const singleWordPatterns: Record<string, RegExp> = {}
        for (const kw of keywords) {
          if (/\s/.test(kw)) continue
          singleWordPatterns[kw] = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'gi')
        }
        
        let processedCount = 0
        let totalFound = 0
        
        // Process org numbers in batches
        for (let i = 0; i < slice.length; i += batchSize) {
          const batch = slice.slice(i, i + batchSize)
          
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
              [batch]
            )
            
            // Process the batch
            const batchResults = rows.map(r => {
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
            
            totalFound += batchResults.length
            processedCount += batch.length
            
            // Send progress update
            const progress = {
              type: 'progress',
              processed: processedCount,
              total: slice.length,
              percentage: Math.round((processedCount / slice.length) * 100),
              batchResults: batchResults,
              totalFound: totalFound
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`))
            
          } catch (batchError) {
            // Log batch error but continue processing
            const errorLog = {
              type: 'warning',
              message: `Error processing batch ${i}-${i + batchSize}: ${(batchError as Error).message}`
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorLog)}\n\n`))
            processedCount += batch.length
          }
          
          // Small delay to prevent overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 5))
        }
        
        // Send completion
        const completion = {
          type: 'complete',
          totalResults: totalFound,
          totalProcessed: processedCount,
          message: 'Scan completed successfully'
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(completion)}\n\n`))
        
      } catch (error) {
        const errorMessage = {
          type: 'error',
          message: (error as Error).message || 'Scan failed'
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`))
      } finally {
        controller.close()
      }
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}
