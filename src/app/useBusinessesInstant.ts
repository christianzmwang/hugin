/*
Client hook to fetch /api/businesses/instant and /instant/count with:
- Keys include all params
- Debounce done by caller; we support aborting in-flight per key
- Parallel first-load (list + count)
- Keyset pagination for revenue/employees, OFFSET discouraged for name (not implemented here)
*/
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type SortBy = 'revenue' | 'employees' | 'name' | 'none' | 'score'

type Params = {
  sortBy: SortBy
  order: 'asc' | 'desc'
  limit: number
  cursor: string | null
  industryCode?: string
  sectorCode?: string
  orgFormCode?: string
  city?: string
  revenueBucket?: string
  employeeBucket?: string
  vatRegistered?: boolean
  search?: string
  events?: 'with' | 'without'
  eventTypes?: string[]
  eventWeights?: Record<string, number>
}

function buildQuery(p: Params) {
  const sp = new URLSearchParams()
  if (p.sortBy === 'name') {
    sp.set('sortBy', 'name')
    sp.set('order', 'asc')
  } else if (p.sortBy === 'employees') {
    sp.set('sortBy', 'employees')
    sp.set('order', p.order)
  } else {
    sp.set('sortBy', 'revenue')
    sp.set('order', p.order)
  }
  sp.set('limit', String(Math.max(1, Math.min(200, p.limit || 100))))
  if (p.cursor) sp.set('cursor', p.cursor)
  if (p.industryCode) sp.set('industryCode', p.industryCode)
  if (p.sectorCode) sp.set('sectorCode', p.sectorCode)
  if (p.orgFormCode) sp.set('orgFormCode', p.orgFormCode)
  if (p.city) sp.set('city', p.city)
  if (p.revenueBucket) sp.set('revenueBucket', p.revenueBucket)
  if (p.employeeBucket) sp.set('employeeBucket', p.employeeBucket)
  if (typeof p.vatRegistered === 'boolean') sp.set('vatRegistered', p.vatRegistered ? 'true' : 'false')
  if (p.search) sp.set('search', p.search)
  if (p.events) sp.set('events', p.events)
  return sp
}

const inflight = new Map<string, AbortController>()

export function useBusinessesInstant(p: Params) {
  const key = useMemo(() => {
    // key excludes cursor for count (count only on first page)
    const k = {
      k: 'biz/instant',
      sortBy: p.sortBy,
      order: p.order,
      limit: p.limit,
      industryCode: p.industryCode || null,
      sectorCode: p.sectorCode || null,
      orgFormCode: p.orgFormCode || null,
      city: p.city || null,
      revenueBucket: p.revenueBucket || null,
      employeeBucket: p.employeeBucket || null,
      vatRegistered: typeof p.vatRegistered === 'boolean' ? p.vatRegistered : null,
      search: p.search || null,
    }
    return JSON.stringify(k)
  }, [p.sortBy, p.order, p.limit, p.industryCode || null, p.sectorCode || null, p.orgFormCode || null, p.city || null, p.revenueBucket || null, p.employeeBucket || null, typeof p.vatRegistered === 'boolean' ? p.vatRegistered : null, p.search || null])

  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [listTookMs, setListTook] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [countTookMs, setCountTook] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  const cursorRef = useRef<string | null>(null)
  cursorRef.current = p.cursor

  useEffect(() => {
    const listParams = buildQuery(p)
    const listUrl = `/api/businesses/instant?${listParams.toString()}`

    // Abort previous for same key
    inflight.get(key)?.abort()
    const ctl = new AbortController()
    inflight.set(key, ctl)

    const firstPage = !p.cursor
    if (firstPage) setIsLoading(true)
    else setIsUpdating(true)

    async function run() {
      try {
        const listPromise = fetch(listUrl, { signal: ctl.signal }).then((r) => r.json())

        let countPromise: Promise<{ total?: number; tookMs?: number }> | null = null
        if (!p.cursor) {
          const sp = buildQuery(p)
          // remove list-specific fields for count
          sp.delete('sortBy'); sp.delete('order'); sp.delete('limit'); sp.delete('cursor')
          const countUrl = `/api/businesses/instant/count?${sp.toString()}`
          countPromise = fetch(countUrl, { signal: ctl.signal }).then((r) => r.json())
        }
        // Resolve list first for faster TTI
        const listRes = await listPromise
        if (ctl.signal.aborted) return
        const items = Array.isArray(listRes?.items) ? listRes.items : []
        setItems(items)
        setNextCursor(listRes?.cursor?.next ?? null)
        setListTook(typeof listRes?.tookMs === 'number' ? listRes.tookMs : null)

        // Count in background
        if (countPromise) {
          countPromise
            .then((countRes) => {
              if (ctl.signal.aborted) return
              setTotal(typeof countRes?.total === 'number' ? countRes.total : null)
              setCountTook(typeof countRes?.tookMs === 'number' ? countRes.tookMs : null)
            })
            .catch(() => {
              /* keep previous total */
            })
        }
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
        setItems([])
        if (!p.cursor) setTotal((t) => t ?? null)
      } finally {
        if (!p.cursor) setIsLoading(false)
        setIsUpdating(false)
        if (inflight.get(key) === ctl) inflight.delete(key)
      }
    }

    run()
    return () => {
      ctl.abort()
      if (inflight.get(key) === ctl) inflight.delete(key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, p.cursor])

  return {
    items,
    cursor: nextCursor,
    listTookMs,
    total: total ?? 0,
    countTookMs,
    isLoading,
    isUpdating,
  }
}
