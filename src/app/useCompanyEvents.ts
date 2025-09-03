import { useEffect, useState } from 'react'
import { fetchCompanyEvents, type PublicEvent } from './events.api'

export function useCompanyEvents(supabase: unknown, orgnr: string, limit = 50) {
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const rows = await fetchCompanyEvents(supabase, orgnr, limit)
        if (!cancelled) setEvents(rows)
      } catch (e) {
        if (!cancelled) setError(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, orgnr, limit])

  return { events, loading, error }
}
