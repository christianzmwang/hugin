"use client"

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useWatchlist } from '@/app/watchlist/useWatchlist'
import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'

// Dynamic import to mirror Search page behaviour (avoids SSR mismatch, heavy code split)
type BusinessCardProps = {
  business: BusinessCardBusiness
  numberFormatter: Intl.NumberFormat
  selectedEventTypes: string[]
  eventWeights: Record<string, number>
  isWatched: boolean
  onToggle: () => void
  hideScore?: boolean
  actionLabel?: string
}
type BusinessCardModule = {
  BusinessCard?: ComponentType<BusinessCardProps>
  default: ComponentType<BusinessCardProps>
}
const BusinessCard = dynamic<BusinessCardProps>(
  () => import('@/components/search/BusinessCard').then((m: BusinessCardModule) => m.BusinessCard ?? m.default),
  { ssr: false }
)

interface BusinessCardBusiness {
  orgNumber: string
  name: string
  website: string | null
  employees: number | null
  addressStreet: string | null
  addressPostalCode: string | null
  addressCity: string | null
  ceo: string | null
  fiscalYear?: number | null
  revenue?: string | number | null
  profit?: string | number | null
  industryCode1?: string | null
  industryText1?: string | null
  sectorCode?: string | null
  sectorText?: string | null
  hasEvents?: boolean | null
  registeredAtBrreg?: string | null
}

const numberFormatter: Intl.NumberFormat = (() => {
  try { return new Intl.NumberFormat('nb-NO') } catch { try { return new Intl.NumberFormat('no') } catch { return new Intl.NumberFormat() } }
})()

export default function WatchlistPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { items, isLoading: wlLoading, error: wlError, remove } = useWatchlist()

  // Local cache keys and TTL (10 minutes)
  const CACHE_KEY = 'watchlistBusinesses'
  const CACHE_TS_KEY = 'watchlistBusinessesTs'
  const CACHE_ORGS_KEY = 'watchlistBusinessesOrgs'
  const CACHE_TTL_MS = 10 * 60 * 1000

  // Seed from local cache to avoid reload flash on reentry
  const [businesses, setBusinesses] = useState<BusinessCardBusiness[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed as BusinessCardBusiness[]
      }
    } catch {}
    return []
  })
  const [hasFreshCache, setHasFreshCache] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const ts = Number(localStorage.getItem(CACHE_TS_KEY) || '')
      return Number.isFinite(ts) && Date.now() - ts < CACHE_TTL_MS
    } catch { return false }
  })
  const [detailsLoading, setDetailsLoading] = useState(false)

  // Access guard (mirror search / company page pattern)
  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/auth/signin'); return }
    const hasDbAccess = Boolean(session.user?.mainAccess)
    if (!hasDbAccess) { router.push('/noaccess'); return }
  }, [status, session, router])

  // Helper to persist cache
  const saveCache = (biz: BusinessCardBusiness[], orgs: string[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(biz))
      localStorage.setItem(CACHE_ORGS_KEY, JSON.stringify(orgs))
      localStorage.setItem(CACHE_TS_KEY, String(Date.now()))
      setHasFreshCache(true)
    } catch {}
  }

  // Fetch full business detail for each watchlist orgNumber
  useEffect(() => {
    if (!items || items.length === 0) {
      setBusinesses([])
      // Clear cache when list empty
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify([]))
        localStorage.setItem(CACHE_ORGS_KEY, JSON.stringify([]))
        localStorage.setItem(CACHE_TS_KEY, String(Date.now()))
        setHasFreshCache(true)
      } catch {}
      return
    }
    let cancelled = false
    const load = async () => {
      const orgs = items.map(it => it.orgNumber).filter(Boolean)
      // If cache is fresh and orgs match, use it and skip network
      try {
        const ts = Number(localStorage.getItem(CACHE_TS_KEY) || '')
        const cachedOrgsRaw = localStorage.getItem(CACHE_ORGS_KEY)
        const fresh = Number.isFinite(ts) && Date.now() - ts < CACHE_TTL_MS
        const cachedOrgs = cachedOrgsRaw ? JSON.parse(cachedOrgsRaw) as string[] : []
        if (fresh && Array.isArray(cachedOrgs) && cachedOrgs.length === orgs.length && cachedOrgs.every((o, i) => o === orgs[i])) {
          setHasFreshCache(true)
          setDetailsLoading(false)
          return
        }
      } catch {}

      setDetailsLoading(true)
      try {
        const results: BusinessCardBusiness[] = []
        // Fetch in small parallel batches to avoid request burst (5 at a time)
        const orgs = items.map(it => it.orgNumber).filter(Boolean)
        const batchSize = 5
        for (let i = 0; i < orgs.length; i += batchSize) {
          const slice = orgs.slice(i, i + batchSize)
          const promises = slice.map(async (org) => {
            try {
              const res = await fetch(`/api/businesses?orgNumber=${encodeURIComponent(org)}&limit=1`, { cache: 'no-store' })
              if (!res.ok) return null
              const json = await res.json()
              const arr = Array.isArray(json) ? json : (json.items || [])
              const raw = arr[0]
              if (!raw) return null
              return {
                orgNumber: String(raw.orgNumber || raw.org_number || ''),
                name: String(raw.name || ''),
                website: raw.website ?? null,
                employees: raw.employees ?? null,
                addressStreet: raw.addressStreet ?? null,
                addressPostalCode: raw.addressPostalCode ?? null,
                addressCity: raw.addressCity ?? null,
                ceo: raw.ceo ?? null,
                fiscalYear: raw.fiscalYear ?? null,
                revenue: raw.revenue ?? null,
                profit: raw.profit ?? null,
                industryCode1: raw.industryCode1 ?? null,
                industryText1: raw.industryText1 ?? null,
                sectorCode: raw.sectorCode ?? null,
                sectorText: raw.sectorText ?? null,
                hasEvents: raw.hasEvents ?? null,
                registeredAtBrreg: raw.registeredAtBrreg ?? null,
              } as BusinessCardBusiness
            } catch { return null }
          })
          const batch = await Promise.all(promises)
          if (cancelled) return
          for (const b of batch) if (b && b.orgNumber) results.push(b)
        }
        if (!cancelled) {
          // Maintain original watchlist ordering
            const order = new Map(orgs.map((o, idx) => [o, idx]))
            results.sort((a, b) => (order.get(a.orgNumber)! - order.get(b.orgNumber)!))
            setBusinesses(results)
            saveCache(results, orgs)
        }
      } finally {
        if (!cancelled) setDetailsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [items])

  const loading = status === 'loading' || detailsLoading || (wlLoading && !hasFreshCache)
  const error = wlError

  // Optimistic local removal updates cache so reentry is instant
  const handleRemove = (org: string) => {
    setBusinesses(prev => {
      const next = prev.filter(b => b.orgNumber !== org)
      try {
        const prevOrgsRaw = localStorage.getItem(CACHE_ORGS_KEY)
        const prevOrgs = prevOrgsRaw ? JSON.parse(prevOrgsRaw) as string[] : []
        const nextOrgs = prevOrgs.filter(o => o !== org)
        saveCache(next, nextOrgs)
      } catch {}
      return next
    })
    // Fire and forget server removal
    try { void remove(org) } catch {}
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <div className="text-lg text-gray-400">Loading companies…</div>
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
  <div className="min-h-screen bg-black text-white pb-0">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Watchlist</h1>
        <div className="text-xs text-gray-400">{businesses.length} companies</div>
      </div>
      <div className="p-6">
        {error && (
          <div className="mb-6 text-sm text-red-400">{error}</div>
        )}
        {businesses.length === 0 && !error && (
          <div className="text-sm text-gray-400">Your watchlist is empty.</div>
        )}
        {businesses.length > 0 && (
          <div className="divide-y divide-white/10">
            {businesses.map(b => (
              <div key={b.orgNumber} className="relative">
                <BusinessCard
                  business={b}
                  numberFormatter={numberFormatter}
                  selectedEventTypes={[]} // no filtering UI on watchlist yet
                  eventWeights={{}} // neutral weights
                  isWatched={true}
                  onToggle={() => handleRemove(b.orgNumber)}
                  hideScore={true}
                  actionLabel="Remove"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
