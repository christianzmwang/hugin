import { NextResponse } from 'next/server'
import { dbConfigured, query } from '@/lib/db'
import { checkApiAccess } from '@/lib/access-control'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
export const maxDuration = 15

// Shape returned to the client (kept stable for minimal UI churn)
type EventItem = {
  id: string | number
  title: string | null
  description: string | null
  url: string | null
  source: string | null
  date: string | null
  // Raw score for this event from the database (can be null)
  score: number | null
  // Added for dashboard News section
  orgNumber: string | null
  businessName: string | null
}

// Shape from public.events_public / RPC (snake_case)
type PublicEvent = {
  id: string
  org_number: string
  business_id: string | null
  event_type: string | null
  impact_magnitude: string | null
  certainty: number | null
  date: string | null
  location: string | null
  explanation: string | null
  source_url: string | null
  source_title: string | null
  score: number | null
  created_at: string
}

type PublicEventWithName = PublicEvent & { business_name?: string | null }

function mapToClientItem(row: PublicEventWithName): EventItem {
  return {
    id: row.id,
    // Prefer a human title if available; fall back to event_type
    title: row.source_title || row.event_type || null,
    description: row.explanation,
    url: row.source_url,
    source: row.event_type,
  date: row.date,
  score: row.score,
  orgNumber: row.org_number || null,
  businessName: row.business_name || null,
  }
}

export async function GET(req: Request) {
  // Check authentication and authorization first
  const accessError = await checkApiAccess()
  if (accessError) {
    return accessError
  }

  if (!dbConfigured) {
    return NextResponse.json({ items: [] })
  }
  const { searchParams } = new URL(req.url)
  const orgNumber = (searchParams.get('orgNumber') || '').trim()
  const eventTypesCsv = (searchParams.get('eventTypes') || '').trim()
  const eventTypes = eventTypesCsv
    ? eventTypesCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  const limit = Math.max(
    1,
    Math.min(50, parseInt(searchParams.get('limit') || '50', 10) || 50),
  )

  try {
    // If orgNumber provided, use RPC first, then view fallback
    if (orgNumber) {
      // Apply event type filtering in the SQL query for better performance
      let baseQuery = `SELECT e.*, m.name AS business_name
				 FROM public.events_public e
				 LEFT JOIN public.business_filter_matrix m ON m.org_number = e.org_number
				 WHERE e.org_number = $1`
              const queryParams: (string | number | string[])[] = [orgNumber]
      
      if (eventTypes.length > 0) {
        baseQuery += ` AND event_type = ANY($2::text[])`
        queryParams.push(eventTypes)
        baseQuery += ` ORDER BY date DESC NULLS LAST, created_at DESC LIMIT $3`
        queryParams.push(limit)
      } else {
        baseQuery += ` ORDER BY date DESC NULLS LAST, created_at DESC LIMIT $2`
        queryParams.push(limit)
      }
      
      const result = await query<PublicEventWithName>(baseQuery, queryParams)
      const rows = result.rows

      const items: EventItem[] = (rows || []).map(mapToClientItem)
      return NextResponse.json({ items })
    }

    // Without orgNumber: latest events overall from the view
    const view = await query<PublicEventWithName>(
      `SELECT e.*, m.name AS business_name
			 FROM public.events_public e
			 LEFT JOIN public.business_filter_matrix m ON m.org_number = e.org_number
			 ORDER BY e.date DESC NULLS LAST, e.created_at DESC
			 LIMIT $1`,
      [limit],
    )
    let rows = view.rows
    if (eventTypes.length > 0 && rows && rows.length > 0) {
      rows = rows.filter((r) => !!r.event_type && eventTypes.includes(r.event_type))
    }
    const items: EventItem[] = (rows || []).map(mapToClientItem)
    return NextResponse.json({ items })
  } catch {
    // On any error, return empty list to preserve stability
    return NextResponse.json({ items: [] })
  }
}
