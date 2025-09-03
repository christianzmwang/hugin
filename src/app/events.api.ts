// Lightweight client-side API wrapper for events
// Uses the public API route; if a Supabase browser client exists, you can swap to it later.

export type PublicEvent = {
  id: string
  org_number: string
  business_id: string | null
  event_type: string | null
  impact_magnitude: string | null
  certainty: number | null
  date: string | null // ISO date or null
  location: string | null
  explanation: string | null
  source_url: string | null
  source_title: string | null
  score: number | null
  created_at: string // ISO timestamp
}

export async function fetchCompanyEvents(
  _supabase: unknown,
  orgnr: string,
  limit = 50,
): Promise<PublicEvent[]> {
  // For now, call our Next.js API which hits RPC/view securely server-side.
  const params = new URLSearchParams({ orgNumber: orgnr, limit: String(limit) })
  const res = await fetch(`/api/events?${params.toString()}`)
  if (!res.ok) return []
  const json = (await res.json()) as { items?: unknown[] } | unknown[]
  const items = Array.isArray(json) ? json : json.items || []

  // The API returns a UI-mapped shape; we keep minimal mapping here to PublicEvent keys when possible.
  // If keys are missing, pass through as best-effort. This keeps churn low while moving to the new backend.
  return items as unknown as PublicEvent[]
}
