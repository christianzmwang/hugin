'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useWatchlist } from '@/app/watchlist/useWatchlist'
import { apiCache } from '@/lib/api-cache'
import { useDashboardMode } from '@/components/DashboardThemeProvider'
 

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { mode } = useDashboardMode()
  const light = mode === 'light'
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [recentBusinesses, setRecentBusinesses] = useState<
    {
      orgNumber: string
      businessName: string
      latestEventTitle: string | null
      latestEventDate: string | null
  url: string | null
  created_at?: string | null
    }[]
  >([])
  const { items: watchlistItems, isLoading: watchlistLoading, error: watchlistError, remove: removeWatchlistItem } = useWatchlist({ limit: 20 })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
    }
  }, [status, session, router])

  // Gate main app strictly by mainAccess flag
  useEffect(() => {
    if (!session) return
    const hasDbAccess = Boolean(session.user?.mainAccess)
    if (!hasDbAccess) {
  router.push('/noaccess')
    }
  }, [session, router])

  useEffect(() => {
    if (!session) return
    let cancelled = false

    // Use a small client cache to avoid refetching when returning
    const cacheKey = { k: 'dashboardNews', limit: 50 }
    const cached = apiCache.get<{
      orgNumber: string
      businessName: string
      latestEventTitle: string | null
      latestEventDate: string | null
      url: string | null
    }[]>(cacheKey)
    if (cached) {
      setRecentBusinesses(cached)
      setNewsLoading(false)
    } else {
      setNewsLoading(true)
    }
    setNewsError(null)

    if (cached && cached.length > 0) return () => { /* no fetch needed */ }

    ;(async () => {
      try {
        const res = await fetch(`/api/events?limit=50`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load events')
        const json: unknown = await res.json()
        const rows: unknown[] = Array.isArray(json)
          ? json
          : (typeof json === 'object' && json !== null && Array.isArray((json as Record<string, unknown>)['items'])
            ? ((json as Record<string, unknown>)['items'] as unknown[])
            : [])

        // Items are newest-first; keep first occurrence per org
        const seen = new Set<string>()
        const businesses: {
          orgNumber: string
          businessName: string
          latestEventTitle: string | null
          latestEventDate: string | null
          url: string | null
        }[] = []
        for (const it of rows) {
          if (!it || typeof it !== 'object') continue
          const rec = it as Record<string, unknown>
          const org: string | null = typeof rec['orgNumber'] === 'string'
            ? (rec['orgNumber'] as string)
            : (typeof rec['org_number'] === 'string' ? (rec['org_number'] as string) : null)
          if (!org || seen.has(org)) continue
          seen.add(org)
          businesses.push({
            orgNumber: org,
            businessName: typeof rec['businessName'] === 'string'
              ? (rec['businessName'] as string)
              : (typeof rec['business_name'] === 'string' ? (rec['business_name'] as string) : 'Unknown business'),
            latestEventTitle: typeof rec['title'] === 'string' ? (rec['title'] as string) : null,
            latestEventDate: typeof rec['date'] === 'string'
              ? (rec['date'] as string)
              : (typeof rec['created_at'] === 'string' ? (rec['created_at'] as string) : null),
            url: typeof rec['url'] === 'string' ? (rec['url'] as string) : null,
          })
          if (businesses.length >= 10) break
        }
        // Filter out any items whose date is in the future relative to "now"
        const now = Date.now()
        const filtered = businesses.filter(b => {
          const raw = b.latestEventDate
          if (!raw) return false
          const t = Date.parse(String(raw))
          return Number.isFinite(t) && t <= now
        })
        if (!cancelled) {
          setRecentBusinesses(filtered)
          apiCache.set(cacheKey, filtered, 2 * 60 * 1000) // cache for 2 minutes
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : 'Failed to load news'
          setNewsError(message)
        }
      } finally {
        if (!cancelled) setNewsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [session])

  // watchlist handled by useWatchlist

  // Stats section intentionally simplified; graphs removed pending setup

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <div className="text-lg text-gray-400">Loading...</div>
        </div>
      </div>
    )
  }

  if (!session) return null

  // Extra guard: if authenticated but no main access, prevent rendering while middleware redirects
  if (!session.user?.mainAccess) {
    return null
  }

  // Graph helpers removed

  return (
      <div
        className={`p-4 md:p-6 flex flex-col overflow-hidden transition-colors duration-300 ${light ? 'bg-white text-gray-900' : 'bg-black text-white'}`}
        style={{ height: 'calc(100dvh - 92px)' }}
      >
        {/* Upper half (exact 50%) */}
  <div className="basis-1/2 grow-0 shrink-0 min-h-0 flex flex-col overflow-hidden relative">
          <h2 className={`text-lg font-semibold mb-2 ${light ? 'text-gray-900' : ''}`}>Stats</h2>
          <div className="flex-1 flex items-center justify-center">
            <div className={`text-5xl md:text-7xl font-extrabold tracking-tight select-none ${light ? 'text-gray-800' : 'text-white/80'}`}>Needs Setup</div>
          </div>
        </div>

        {/* Lower half (exact 50%) */}
  <div className="basis-1/2 grow-0 shrink-0 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 relative -translate-y-2 md:-translate-y-3">
      <div className="flex flex-col min-h-0 h-full">
            <h2 className={`text-lg font-semibold mb-2 ${light ? 'text-gray-900' : ''}`}>News</h2>
  <div className={`mt-2 flex-1 overflow-y-auto overflow-x-hidden border backdrop-blur-sm overscroll-contain ${light ? 'border-gray-200 bg-gray-100' : 'border-white/5 bg-white/5'}` }>

              {newsLoading && (
                <div className={`text-sm ${light ? 'text-gray-600' : 'text-gray-400'}`}>Loading latest company events…</div>
              )}
              {!newsLoading && newsError && (
                <div className={`text-sm ${light ? 'text-red-600' : 'text-red-400'}`}>{newsError}</div>
              )}
              {!newsLoading && !newsError && recentBusinesses.length === 0 && (
                <div className={`text-sm ${light ? 'text-gray-600' : 'text-gray-400'}`}>No recent events.</div>
              )}
              {!newsLoading && !newsError && recentBusinesses.length > 0 && (
  <ul className={`divide-y ${light ? 'divide-gray-200' : 'divide-white/10'}`}>
                  {recentBusinesses.map((b) => (
                    <li
                      key={b.orgNumber}
          className={`py-2 px-2 flex items-start justify-between gap-4 cursor-pointer focus:outline-none focus:ring-1 ${light ? 'hover:bg-gray-200 focus:ring-gray-300' : 'hover:bg-white/10 focus:ring-white/30'}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/company?orgNumber=${encodeURIComponent(b.orgNumber)}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          router.push(`/company?orgNumber=${encodeURIComponent(b.orgNumber)}`)
                        }
                      }}
                      title={`Open ${b.businessName}`}
                    >
                      <div className="min-w-0">
                        <div className={`text-sm font-medium truncate ${light ? 'text-gray-900' : 'text-white'}`}>{b.businessName}</div>
                        {b.latestEventTitle && (
                          <div className={`text-xs truncate ${light ? 'text-gray-600' : 'text-gray-400'}`}>{b.latestEventTitle}</div>
                        )}
                      </div>
                      <div className={`text-xs whitespace-nowrap ${light ? 'text-gray-500' : 'text-gray-500'}`}>
                        {b.latestEventDate ? new Date(b.latestEventDate).toLocaleDateString() : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
          </div>
          </div>
          <div className="flex flex-col min-h-0 h-full">
            <h2 className={`text-lg font-semibold mb-2 ${light ? 'text-gray-900' : ''}`}>Watchlist</h2>
            <div className={`mt-2 flex-1 overflow-y-auto overflow-x-hidden border backdrop-blur-sm overscroll-contain ${light ? 'border-gray-200 bg-gray-100' : 'border-white/5 bg-white/5'}` }>
            {watchlistLoading && (
              <div className={`text-sm ${light ? 'text-gray-600' : 'text-gray-400'}`}>Loading watchlist…</div>
            )}
            {!watchlistLoading && watchlistError && (
              <div className={`text-sm ${light ? 'text-red-600' : 'text-red-400'}`}>{watchlistError}</div>
            )}
            {!watchlistLoading && !watchlistError && (!watchlistItems || watchlistItems.length === 0) && (
              <div className={`text-sm ${light ? 'text-gray-600' : 'text-gray-400'}`}>Your watchlist is empty.</div>
            )}
            {!watchlistLoading && !watchlistError && watchlistItems && watchlistItems.length > 0 && (
  <ul className={`divide-y ${light ? 'divide-gray-200' : 'divide-white/10'}`}>
                {watchlistItems.map((it) => (
                  <li
                    key={it.orgNumber}
  className={`py-2 px-2 flex items-center justify-between gap-4 cursor-pointer focus:outline-none focus:ring-1 ${light ? 'hover:bg-gray-200 focus:ring-gray-300' : 'hover:bg-white/10 focus:ring-white/30'}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/company?orgNumber=${encodeURIComponent(it.orgNumber)}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        router.push(`/company?orgNumber=${encodeURIComponent(it.orgNumber)}`)
                      }
                    }}
                    title={`Open ${it.name || 'Unnamed company'}`}
                  >
                    <div className="min-w-0">
                      <div className={`text-sm font-medium truncate ${light ? 'text-gray-900' : 'text-white'}`}>{it.name || 'Unnamed company'}</div>
                      <div className={`text-xs truncate ${light ? 'text-gray-600' : 'text-gray-400'}`}>{it.orgNumber}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className={`text-xs px-2 py-1 border ${light ? 'border-gray-300 hover:bg-gray-200' : 'border-white/20 hover:bg-white/10'}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeWatchlistItem(it.orgNumber)
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            </div>
          </div>
        </div>
      </div>
  )
}
