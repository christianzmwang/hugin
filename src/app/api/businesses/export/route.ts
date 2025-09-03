import { NextResponse } from 'next/server'
import { dbConfigured, query } from '@/lib/db'
import { checkApiAccess } from '@/lib/access-control'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
export const maxDuration = 60

type Row = {
  id: number
  orgNumber: string
  name: string | null
  website: string | null
  employees: number | null
  addressStreet: string | null
  addressPostalCode: string | null
  addressCity: string | null
  industryCode1: string | null
  industryText1: string | null
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export async function GET(): Promise<Response> {
  // Check authentication and authorization first
  const accessError = await checkApiAccess()
  if (accessError) {
    return accessError
  }

  if (!dbConfigured) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const encoder = new TextEncoder()
  const header = [
    'orgNumber',
    'name',
    'website',
    'employees',
    'addressStreet',
    'addressPostalCode',
    'addressCity',
    'industryCode1',
    'industryText1',
  ].join(',') + '\n'

  const batchSize = 2000
  let lastId = 0

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      controller.enqueue(encoder.encode(header))
      try {
        // Keyset pagination by id for stable, memory-safe streaming
        while (true) {
          const sql = `
            SELECT
              b.id,
              b."orgNumber" as "orgNumber",
              b.name,
              b.website,
              b.employees,
              b."addressStreet",
              b."addressPostalCode",
              b."addressCity",
              b."industryCode1",
              b."industryText1"
            FROM "Business" b
            WHERE b.id > $1
              AND COALESCE(NULLIF(TRIM(b.website), ''), NULL) IS NOT NULL
              AND (
                b."registeredInForetaksregisteret" = true
                OR b."orgFormCode" IN ('AS','ASA','ENK','ANS','DA','NUF','SA','SAS','A/S','A/S/ASA')
              )
            ORDER BY b.id ASC
            LIMIT $2
          `
          const { rows } = await query<Row>(sql, [lastId, batchSize])
          if (!rows || rows.length === 0) break

          const chunk = rows
            .map((r) =>
              [
                csvEscape(r.orgNumber),
                csvEscape(r.name),
                csvEscape(r.website),
                csvEscape(r.employees),
                csvEscape(r.addressStreet),
                csvEscape(r.addressPostalCode),
                csvEscape(r.addressCity),
                csvEscape(r.industryCode1),
                csvEscape(r.industryText1),
              ].join(',') + '\n',
            )
            .join('')

          controller.enqueue(encoder.encode(chunk))
          lastId = rows[rows.length - 1]!.id
        }
      } catch (error) {
        // Surface an error line in the CSV for visibility, then close
        const errLine = '# error generating CSV: ' + (error as Error).message + '\n'
        controller.enqueue(encoder.encode(errLine))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="businesses_with_websites.csv"',
      'Cache-Control': 'no-store',
    },
  })
}


