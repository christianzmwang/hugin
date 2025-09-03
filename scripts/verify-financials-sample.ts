import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

const envLocalPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath })
} else {
  dotenv.config()
}

import { query, dbConfigured, type SqlParam } from '@/lib/db'

function parseArgs(argv: string[]) {
  const flags: Record<string, string | boolean> = {}
  for (const a of argv.slice(2)) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      flags[k] = v === undefined ? true : v
    }
  }
  return flags
}

async function main() {
  if (!dbConfigured) throw new Error('Database not configured')
  const flags = parseArgs(process.argv)
  const limit = Math.max(1, Number(flags['limit'] || 5))
  const org = (flags['org'] as string) || ''

  let orgs: string[] = []
  if (org) {
    orgs = [org]
  } else {
    const sql = `
      SELECT b."orgNumber" as org, COUNT(*)::int as n
      FROM "FinancialReport" f
      JOIN "Business" b ON b.id = f."businessId"
      GROUP BY b."orgNumber"
      HAVING COUNT(*) > 1
      ORDER BY n DESC
      LIMIT $1
    `
    const { rows } = await query<{ org: string; n: number }>(sql, [limit as unknown as SqlParam])
    orgs = rows.map((r) => r.org)
  }

  for (const o of orgs) {
    const header = `\n== Org ${o} ==`
    console.log(header)
    const fsql = `
      SELECT f."fiscalYear", f.revenue, f.profit, f."totalAssets", f.equity
      FROM "FinancialReport" f
      JOIN "Business" b ON b.id = f."businessId"
      WHERE b."orgNumber" = $1
      ORDER BY f."fiscalYear" DESC NULLS LAST
    `
    const { rows: frows } = await query<{ fiscalYear: number; revenue: number | null; profit: number | null; totalAssets: number | null; equity: number | null }>(fsql, [o])
    console.log(`years: ${frows.map((r) => r.fiscalYear).join(', ')}`)
    const preview = frows.slice(0, 3).map((r) => ({ year: r.fiscalYear, revenue: r.revenue, profit: r.profit }))
    console.log(`sample: ${JSON.stringify(preview)}`)
  }
}

main().catch((e) => {
  console.error('[verify] failed', e)
  process.exitCode = 1
})


