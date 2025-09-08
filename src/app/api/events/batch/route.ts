import { NextResponse } from 'next/server'
import { dbConfigured, query } from '@/lib/db'
import { checkApiAccess } from '@/lib/access-control'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1','arn1','cdg1']
export const maxDuration = 15

// Returns recent events for multiple orgNumbers in a single call
export async function GET(req: Request) {
  const accessError = await checkApiAccess()
  if (accessError) return accessError
  if (!dbConfigured) return NextResponse.json({ items: [] })

  const { searchParams } = new URL(req.url)
  const orgNumbers = (searchParams.get('orgNumbers') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (orgNumbers.length === 0) {
    return NextResponse.json({ items: [] })
  }

  // Limit to visible page size * small factor to prevent abuse
  if (orgNumbers.length > 400) {
    return NextResponse.json({ error: 'Too many orgNumbers' }, { status: 400 })
  }

  const limitPerOrg = Math.max(1, Math.min(5, parseInt(searchParams.get('per') || '2', 10) || 2))
  const eventTypesCsv = (searchParams.get('eventTypes') || '').trim()
  const eventTypes = eventTypesCsv ? eventTypesCsv.split(',').map(s => s.trim()).filter(Boolean) : []

  // Pull small slice per company using window function rank partitioned by org_number
  const sql = `
    WITH ranked AS (
      SELECT e.*, m.name AS business_name,
             ROW_NUMBER() OVER (PARTITION BY e.org_number ORDER BY e.date DESC NULLS LAST, e.created_at DESC) AS rnk
      FROM public.events_public e
      LEFT JOIN public.business_filter_matrix m ON m.org_number = e.org_number
      WHERE e.org_number = ANY($1::text[])
        AND (e.date IS NULL OR e.date <= NOW()::date)
        ${eventTypes.length > 0 ? 'AND e.event_type = ANY($2::text[])' : ''}
    )
    SELECT * FROM ranked WHERE rnk <= $3
  `

  const params: any[] = [orgNumbers]
  if (eventTypes.length > 0) params.push(eventTypes)
  params.push(limitPerOrg)

  try {
    const res = await query<any>(sql, params)
    const rows = res.rows || []
    const items = rows.map(r => ({
      id: r.id,
      title: r.source_title || r.event_type || null,
      description: r.explanation,
      url: r.source_url,
      source: r.event_type,
      date: r.date,
      created_at: r.created_at,
      score: r.score,
      orgNumber: r.org_number,
      businessName: r.business_name || null,
    }))
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ items: [] })
  }
}
