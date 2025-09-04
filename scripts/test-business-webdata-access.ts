#!/usr/bin/env ts-node
import { query } from '@/lib/db'

async function main() {
  const diagnostics: Record<string, any> = { generatedAt: new Date().toISOString() }
  try {
    const businessCols = [
      'id','orgNumber','name','website','createdAt','updatedAt','industryCode1','industryText1','employees'
    ]
    const webCols = [
      'webFinalUrl','webStatus','webElapsedMs','webIp','webTlsValid','webPrimaryCms','webCmsWordpress','webHasEmailText','webHtmlKb'
    ]

    // Probe counts
    const bCount = await query<{ total:number }>('SELECT COUNT(*)::int as total FROM "Business"')
    diagnostics.businessCount = bCount.rows[0].total

    // Sample a few businesses
    const sample = await query<{ id:number; orgNumber:string }>('SELECT id, "orgNumber" FROM "Business" ORDER BY "updatedAt" DESC LIMIT 5')
    diagnostics.sampleOrgNumbers = sample.rows.map(r=>r.orgNumber)

    // Test select only business columns (should work)
    const bSelect = await query<any>(`SELECT ${businessCols.map(c=>`b."${c}"`).join(', ')} FROM "Business" b ORDER BY b."updatedAt" DESC LIMIT 3`)
    diagnostics.businessColumnsPresent = Object.keys(bSelect.rows[0]||{})

    // Attempt to read web columns still on Business (expect 0 or error if removed)
    let legacyWebSuccess = true
    try {
      const legacy = await query<any>('SELECT "webFinalUrl" FROM "Business" LIMIT 1')
      diagnostics.legacyWebColumnExists = legacy.rows.length === 1
    } catch (e:any) {
      legacyWebSuccess = false
      diagnostics.legacyWebColumnError = e.message
    }

    // Try joined table in several naming variants
    const variants = [
      'businesswebdata', 'business_web_data', 'business_webdata', 'BusinessWebData', '"BusinessWebMeta"'
    ]
    const variantResults: any[] = []
    for (const v of variants) {
      try {
        const sql = `SELECT w."webFinalUrl" FROM ${v} w ORDER BY w."updatedAt" DESC LIMIT 1`
        const r = await query<any>(sql)
        variantResults.push({ table: v, ok: true, row: r.rows[0] })
      } catch (e:any) {
        variantResults.push({ table: v, ok: false, error: e.message })
      }
    }
    diagnostics.webTableVariants = variantResults

    // Try join using each variant
    const joinVariantResults: any[] = []
    for (const v of variants) {
      try {
        const sql = `SELECT b."orgNumber", w."webFinalUrl" FROM "Business" b LEFT JOIN ${v} w ON w."businessId" = b.id ORDER BY b."updatedAt" DESC LIMIT 3`
        const r = await query<any>(sql)
        joinVariantResults.push({ table: v, ok: true, sample: r.rows })
      } catch (e:any) {
        joinVariantResults.push({ table: v, ok: false, error: e.message })
      }
    }
    diagnostics.joinVariants = joinVariantResults

    // Attempt to detect actual table via information_schema
    try {
      const info = await query<any>(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE '%business%web%data%' ORDER BY table_name`)
      diagnostics.informationSchemaMatches = info.rows
    } catch (e:any) {
      diagnostics.informationSchemaError = e.message
    }

    console.log(JSON.stringify({ ok: true, diagnostics }, null, 2))
  } catch (e:any) {
    console.error(JSON.stringify({ ok: false, error: e.message, stack: e.stack }, null, 2))
    process.exit(1)
  }
}

main()
