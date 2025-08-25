import { NextResponse } from 'next/server'
import { dbConfigured, query } from '@/lib/db'
import { apiCache } from '@/lib/api-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
export const maxDuration = 15

export async function GET() {
  if (!dbConfigured) {
    return NextResponse.json({ items: [] })
  }
  const cacheKey = { metric: 'distinctEventTypes' }
  const cached = apiCache.get<{ items: string[] }>(cacheKey)
  if (cached) return NextResponse.json(cached)
  try {
    const res = await query<{ event_type: string }>(
      `SELECT DISTINCT event_type
       FROM public.events_public
       WHERE event_type IS NOT NULL AND event_type <> ''
       ORDER BY event_type ASC
       LIMIT 500`,
    )
    const items = (res.rows || []).map((r) => r.event_type)
    const payload = { items }
    apiCache.set(cacheKey, payload, 10 * 60 * 1000) // 10 min
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ items: [] })
  }
}
