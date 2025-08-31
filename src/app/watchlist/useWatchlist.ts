'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { apiCache } from '@/lib/api-cache'

type WatchlistItem = { orgNumber: string; name: string | null }

const inflight = new Map<string, AbortController>()

export function useWatchlist(options?: { limit?: number }) {
  const limit = options?.limit && Number.isFinite(options.limit) ? Math.max(1, Math.min(200, Math.floor(options.limit))) : null

  const key = useMemo(() => {
    return JSON.stringify({ k: 'watchlist', limit })
  }, [limit])

  const [items, setItems] = useState<WatchlistItem[]>(() => {
    const cached = apiCache.get<WatchlistItem[]>({ k: 'watchlist', limit })
    return cached || []
  })
  const [isLoading, setIsLoading] = useState<boolean>(() => !apiCache.get<WatchlistItem[]>({ k: 'watchlist', limit }))
  const [error, setError] = useState<string | null>(null)

  const lastLoadRef = useRef<number>(0)

  useEffect(() => {
    const cacheKey = { k: 'watchlist', limit }
    const cached = apiCache.get<WatchlistItem[]>(cacheKey)
    if (cached) {
      setItems(cached)
      setIsLoading(false)
      return
    }

    inflight.get(key)?.abort()
    const ctl = new AbortController()
    inflight.set(key, ctl)

    setIsLoading(true)
    setError(null)

    const sp = new URLSearchParams()
    if (limit) sp.set('limit', String(limit))
    const url = `/api/watchlist${sp.toString() ? `?${sp.toString()}` : ''}`

    fetch(url, { signal: ctl.signal, cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (ctl.signal.aborted) return
        const arr = Array.isArray(json) ? json : json.items || []
        setItems(arr)
        apiCache.set(cacheKey, arr, 60 * 1000) // 1 minute TTL
        lastLoadRef.current = Date.now()
      })
      .catch((e: unknown) => {
        if (ctl.signal.aborted) return
        const message = e instanceof Error ? e.message : 'Failed to load watchlist'
        setError(message)
      })
      .finally(() => {
        if (inflight.get(key) === ctl) inflight.delete(key)
        setIsLoading(false)
      })

    return () => {
      ctl.abort()
      if (inflight.get(key) === ctl) inflight.delete(key)
    }
  }, [key, limit])

  const remove = async (orgNumber: string) => {
    // Optimistic update
    setItems((prev) => prev.filter((it) => it.orgNumber !== orgNumber))
    apiCache.set({ k: 'watchlist', limit }, items.filter((it) => it.orgNumber !== orgNumber), 60 * 1000)
    try {
      await fetch('/api/watchlist?orgNumber=' + encodeURIComponent(orgNumber), { method: 'DELETE' })
      // Invalidate wider caches
      apiCache.invalidatePattern({ k: 'watchlist' })
    } catch {
      // Rollback only if needed; for now, refetch soon via invalidation
    }
  }

  const add = async (orgNumber: string) => {
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgNumber }),
      })
      if (!res.ok) throw new Error('Failed to add to watchlist')
      apiCache.invalidatePattern({ k: 'watchlist' })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to add to watchlist'
      setError(message)
    }
  }

  return { items, isLoading, error, remove, add }
}


