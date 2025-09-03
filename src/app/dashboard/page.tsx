'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useWatchlist } from '@/app/watchlist/useWatchlist'
 

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [recentBusinesses, setRecentBusinesses] = useState<
    {
      orgNumber: string
      businessName: string
      latestEventTitle: string | null
      latestEventDate: string | null
      url: string | null
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
    ;(async () => {
      try {
        setNewsLoading(true)
        setNewsError(null)
        const res = await fetch(`/api/events?limit=60`, { cache: 'no-store' })
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
        if (!cancelled) setRecentBusinesses(businesses)
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

  const weeks = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => `W${i + 1}`)
  }, [])

  const mockStats = useMemo(() => {
    // Static mock data to avoid React hook issues
    const highIntent = [80, 85, 78, 82, 89, 91, 87, 93, 88, 95, 92, 97]
    const newHighIntent = [8, 12, 6, 9, 15, 11, 7, 13, 10, 14, 9, 16]
    const closeRate = [0.32, 0.28, 0.35, 0.31, 0.29, 0.33, 0.36, 0.30, 0.34, 0.32, 0.37, 0.35]

    return { highIntent, newHighIntent, closeRate }
  }, [])

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

  function Sparkline({
    data,
    color,
    xLabels,
    yFormatter,
    height = 100,
  }: {
    data: number[]
    color: string
    xLabels?: string[]
    yFormatter?: (v: number) => string
    height?: number
  }) {
    const width = 100
    const margin = { top: 8, right: -30, bottom: 10, left: -35 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom
    const tickFontSize = 6
    const max = Math.max(...data)
    const min = Math.min(...data)
    const xStep = innerWidth / Math.max(1, data.length - 1)
    const toY = (v: number) => {
      if (max === min) return margin.top + innerHeight / 2
      const t = (v - min) / (max - min)
      return margin.top + (1 - t) * innerHeight
    }
    const toX = (i: number) => margin.left + i * xStep
    const path = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ')

    const yTicks = [min, (min + max) / 2, max]
    const xTickIdx = [0, Math.floor((data.length - 1) / 2), data.length - 1]

    const formatY = (v: number) => (yFormatter ? yFormatter(v) : `${Math.round(v)}`)

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <line x1={margin.left} y1={margin.top + innerHeight} x2={width - margin.right} y2={margin.top + innerHeight} stroke="#374151" strokeWidth={1} />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerHeight} stroke="#374151" strokeWidth={1} />

        {yTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line x1={margin.left - 4} y1={toY(t)} x2={margin.left} y2={toY(t)} stroke="#4b5563" strokeWidth={1} />
            <text x={margin.left - 6} y={toY(t)} textAnchor="end" dominantBaseline="middle" className="fill-gray-400" style={{ fontSize: tickFontSize }}>{formatY(t)}</text>
          </g>
        ))}

        {xLabels && xLabels.length === data.length && xTickIdx.map((idx, i) => (
          <g key={`x-${i}`}>
            <line x1={toX(idx)} y1={margin.top + innerHeight} x2={toX(idx)} y2={margin.top + innerHeight + 4} stroke="#4b5563" strokeWidth={1} />
            <text x={toX(idx)} y={margin.top + innerHeight + 10} textAnchor="middle" className="fill-gray-400" style={{ fontSize: tickFontSize }}>{xLabels[idx]}</text>
          </g>
        ))}

        {/* axis titles removed per design */}

        <path d={path} fill="none" stroke={color} strokeWidth={2} />
      </svg>
    )
  }

  const delta = (arr: number[]) => (arr.length >= 2 ? arr[arr.length - 1] - arr[arr.length - 2] : 0)
  const formatPct = (v: number) => `${Math.round(v * 100)}%`

  return (
      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="md:col-span-2 flex flex-col">
          <h2 className="text-lg font-semibold mb-2">Stats</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="p-3 h-full flex flex-col overflow-hidden">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-sm text-gray-400">High Intent Companies</div>
                  <div className="text-xl font-semibold">{mockStats.highIntent.at(-1)}</div>
                </div>
                <div className={
                  `text-xs ${delta(mockStats.highIntent) >= 0 ? 'text-green-400' : 'text-red-400'}`
                }>
                  {delta(mockStats.highIntent) >= 0 ? '+' : ''}{delta(mockStats.highIntent)} WoW
                </div>
              </div>
              <div className="mt-2 min-h-0 h-[10rem] md:h-[13rem] overflow-hidden w-full">
                <Sparkline data={mockStats.highIntent} color="#22c55e" xLabels={weeks} />
              </div>
            </div>

            <div className="p-3 h-full flex flex-col overflow-hidden">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-sm text-gray-400">Close Rate</div>
                  <div className="text-xl font-semibold">{formatPct(mockStats.closeRate.at(-1) || 0)}</div>
                </div>
                <div className={
                  `text-xs ${delta(mockStats.closeRate.map(v => v * 100)) >= 0 ? 'text-green-400' : 'text-red-400'}`
                }>
                  {delta(mockStats.closeRate.map(v => v * 100)) >= 0 ? '+' : ''}
                  {Math.round(delta(mockStats.closeRate))}% WoW
                </div>
              </div>
              <div className="mt-2 min-h-0 h-[10rem] md:h-[13rem] overflow-hidden w-full">
                <Sparkline data={mockStats.closeRate.map(v => v * 100)} color="#60a5fa" xLabels={weeks} yFormatter={(v) => `${Math.round(v)}%`} />
              </div>
            </div>

            <div className="p-3 h-full flex flex-col overflow-hidden">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-sm text-gray-400">New High Intent</div>
                  <div className="text-xl font-semibold">{mockStats.newHighIntent.at(-1)}</div>
                </div>
                <div className={
                  `text-xs ${delta(mockStats.newHighIntent) >= 0 ? 'text-green-400' : 'text-red-400'}`
                }>
                  {delta(mockStats.newHighIntent) >= 0 ? '+' : ''}{delta(mockStats.newHighIntent)} WoW
                </div>
              </div>
              <div className="mt-2 min-h-0 h-[10rem] md:h-[13rem] overflow-hidden w-full">
                <Sparkline data={mockStats.newHighIntent} color="#f59e0b" xLabels={weeks} />
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex flex-col">
          <h2 className="text-lg font-semibold mb-2">News</h2>
          <div className="mt-2 max-h-[34vh] overflow-y-auto pr-1">

              {newsLoading && (
                <div className="text-sm text-gray-400">Loading latest company events…</div>
              )}
              {!newsLoading && newsError && (
                <div className="text-sm text-red-400">{newsError}</div>
              )}
              {!newsLoading && !newsError && recentBusinesses.length === 0 && (
                <div className="text-sm text-gray-400">No recent events.</div>
              )}
              {!newsLoading && !newsError && recentBusinesses.length > 0 && (
                <ul className="divide-y divide-white/10">
                  {recentBusinesses.map((b) => (
                    <li key={b.orgNumber} className="py-2 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">{b.businessName}</div>
                        {b.latestEventTitle && (
                          <div className="text-xs text-gray-400 truncate">{b.latestEventTitle}</div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        {b.latestEventDate ? new Date(b.latestEventDate).toLocaleDateString() : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </div>

        <div className="min-h-0 flex flex-col">
          <h2 className="text-lg font-semibold mb-2">Watchlist</h2>
          <div className="mt-2 max-h-[34vh] overflow-y-auto pr-1">
            {watchlistLoading && (
              <div className="text-sm text-gray-400">Loading watchlist…</div>
            )}
            {!watchlistLoading && watchlistError && (
              <div className="text-sm text-red-400">{watchlistError}</div>
            )}
            {!watchlistLoading && !watchlistError && (!watchlistItems || watchlistItems.length === 0) && (
              <div className="text-sm text-gray-400">Your watchlist is empty.</div>
            )}
            {!watchlistLoading && !watchlistError && watchlistItems && watchlistItems.length > 0 && (
              <ul className="divide-y divide-white/10">
                {watchlistItems.map((it) => (
                  <li key={it.orgNumber} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{it.name || 'Unnamed company'}</div>
                      <div className="text-xs text-gray-400 truncate">{it.orgNumber}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a className="text-xs px-2 py-1 border border-white/20 hover:bg-white/10" href={`/company?orgNumber=${encodeURIComponent(it.orgNumber)}`}>Open</a>
                      <button className="text-xs px-2 py-1 border border-white/20 hover:bg-white/10" onClick={() => removeWatchlistItem(it.orgNumber)}>Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
  )
}


