"use client"
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatEventDate, formatDateEU } from './dateFormats'
import { useDashboardMode } from '@/components/DashboardThemeProvider'

export interface BusinessCardBusiness {
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

export interface EventItem {
  id?: string | number
  title?: string | null
  description?: string | null
  date?: string | null
  url?: string | null
  source?: string | null
  score?: number | null
}

export const BusinessCard = memo(function BusinessCard({
  business,
  numberFormatter,
  selectedEventTypes,
  eventWeights,
  isWatched,
  onToggle,
  hideScore,
  actionLabel,
}: {
  business: BusinessCardBusiness
  numberFormatter: Intl.NumberFormat
  selectedEventTypes: string[]
  eventWeights: Record<string, number>
  isWatched: boolean
  onToggle: () => void
  hideScore?: boolean
  actionLabel?: string
}) {
  const router = useRouter()
  const { mode } = useDashboardMode()
  const light = mode === 'light'
  const fmt = (v: number | string | null | undefined) => (v == null ? '—' : numberFormatter.format(Number(v)))
  const [events, setEvents] = useState<EventItem[] | null>(null)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<unknown>(null)
  const [showAllEvents, setShowAllEvents] = useState(false)
  const [expandedTitleKeys, setExpandedTitleKeys] = useState<Set<string>>(new Set())
  const [expandedDescKeys, setExpandedDescKeys] = useState<Set<string>>(new Set())
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setIsInView(true)
          obs.unobserve(entry.target)
        }
      }
    }, { root: null, rootMargin: '200px', threshold: 0.01 })
    obs.observe(el)
    return () => { try { obs.disconnect() } catch {} }
  }, [])

  const getEventKey = (ev: EventItem, idx: number) => String((ev.id ?? `${business.orgNumber}-${idx}`) as string | number)

  useEffect(() => {
    if (!business.hasEvents || !isInView) return
    let cancelled = false
    const load = async () => {
      setEventsLoading(true)
      setEventsError(null)
      try {
        const params = new URLSearchParams()
        params.set('orgNumber', business.orgNumber)
        params.set('limit', '50')
        if (selectedEventTypes.length > 0) params.set('eventTypes', selectedEventTypes.join(','))
        const res = await fetch('/api/events?' + params.toString())
        const json = await res.json()
        const itemsUnknown = Array.isArray(json) ? json : json.items || []
        const items = itemsUnknown as EventItem[]
        const filtered = selectedEventTypes.length > 0
          ? items.filter((it) => !!(it && it.source) && selectedEventTypes.includes(String(it.source)))
          : items
        if (!cancelled) setEvents(filtered)
      } catch (e) {
        if (!cancelled) { setEventsError(e); setEvents([]) }
      } finally { if (!cancelled) setEventsLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [business.orgNumber, business.hasEvents, selectedEventTypes, isInView])

  const companyScore = useMemo(() => {
    if (selectedEventTypes.length === 0 || !Array.isArray(events) || events.length === 0) return 0
    return events.reduce((acc, ev) => {
      const src = typeof ev.source === 'string' ? ev.source : ev?.source == null ? '' : String(ev.source)
      if (!src || !selectedEventTypes.includes(src)) return acc
      const weight = eventWeights[src] ?? 0
      return weight === 0 ? acc : acc + weight
    }, 0)
  }, [events, eventWeights, selectedEventTypes])

  return (
  <div
    ref={cardRef}
    className={`py-6 transition-colors duration-200 -mx-4 px-4 cursor-pointer first:border-t ${light ? 'hover:bg-red-50 first:border-gray-200' : 'hover:bg-red-600/10 first:border-white/10'}`}
      onClick={(e) => {
        const el = e.target as Element | null
        if (el?.closest('a,button,input,textarea,select,[role="button"],[role="link"]')) return
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        e.stopPropagation()
        router.push(`/company?orgNumber=${encodeURIComponent(business.orgNumber)}`)
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
      <h3 className={`text-xl font-semibold mb-2 ${light ? 'text-gray-900' : ''}`}>{business.name}</h3>
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 text-sm ${light ? 'text-gray-700' : 'text-gray-300'}`}>    
            <div>
              <div className="mb-2"><span className="font-medium">Org:</span> {business.orgNumber}</div>
              {business.registeredAtBrreg && (
                <div className="mb-2"><span className="font-medium">Registreringsdato:</span> {formatDateEU(business.registeredAtBrreg)}</div>
              )}
              <div className="mb-2"><span className="font-medium">CEO:</span> {business.ceo || '—'}</div>
              <div className="mb-2"><span className="font-medium">Employees:</span> {business.employees ?? '—'}</div>
              <div className="mb-2"><span className="font-medium">Revenue:</span> {business.revenue == null ? '—' : `${fmt(business.revenue)}${business.fiscalYear ? ` (FY ${business.fiscalYear})` : ''}`}</div>
            </div>
            <div>
              <div className="mb-2"><span className="font-medium">Address:</span> {[business.addressStreet, business.addressPostalCode, business.addressCity].filter(Boolean).join(', ') || '—'}</div>
        <div className="mb-2"><span className="font-medium">Website:</span> {business.website ? (<a className={`${light ? 'text-sky-600 hover:text-sky-500' : 'text-sky-400 hover:text-sky-300'} underline`} href={business.website.startsWith('http') ? business.website : `https://${business.website}`} target="_blank" rel="noreferrer">{business.website}</a>) : '—'}</div>
              <div className="mb-2"><span className="font-medium">Industry:</span> {business.industryCode1 ? `${business.industryCode1} ${business.industryText1 || ''}`.trim() : '—'}</div>
              <div className="mb-2"><span className="font-medium">Sector:</span> {business.sectorCode ? `${business.sectorCode} ${business.sectorText || ''}`.trim() : '—'}</div>
            </div>
          </div>
        </div>
        <div className="ml-6 flex flex-col items-end gap-3">
          {hideScore ? null : (() => {
            if (!business.hasEvents) return <div className="h-px w-12 bg-white/20" aria-hidden="true" />
            const hasSelected = selectedEventTypes.length > 0
            const hasAnyEvents = Array.isArray(events) && events.length > 0
            const canShow = hasSelected && hasAnyEvents && !eventsLoading
            if (!canShow) return <div className="h-px w-12 bg-white/20" aria-hidden="true" />
            const color = companyScore > 0 ? 'text-green-400' : companyScore < 0 ? 'text-red-400' : 'text-gray-300'
            return <span className={`${color} text-sm font-medium`} title="Weighted score from selected event types">{numberFormatter.format(companyScore)}</span>
          })()}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle() }}
            className={`w-24 inline-flex justify-center text-xs px-2 py-1 border focus:outline-none focus:ring-1 transition-colors
              ${actionLabel === 'Remove'
                ? (light
                  ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100 hover:border-red-400 focus:ring-red-400/40'
                  : 'border-white/20 text-white/90 bg-black hover:bg-red-600/20 hover:border-red-600/60 focus:ring-red-600/40')
                : (light
                  ? 'border-gray-300 text-gray-800 bg-white hover:border-red-400 hover:bg-red-50 focus:ring-red-400/40'
                  : 'border-white/20 text-white/90 bg-black hover:border-red-600/60 hover:bg-black focus:ring-red-600/40')}`}
            aria-pressed={isWatched}
            title={actionLabel ? actionLabel : (isWatched ? 'Remove from watchlist' : 'Add to watchlist')}
          >
            {actionLabel ? actionLabel : (isWatched ? 'Watching' : 'Watch')}
          </button>
        </div>
      </div>

      <div className="mt-4">
        <h4 className={`text-lg font-semibold mb-3 ${light ? 'text-gray-900' : ''}`}>Latest events</h4>
        {!business.hasEvents ? (
          <div className={`text-sm ${light ? 'text-gray-500' : 'text-gray-400'}`}>No events available</div>
        ) : (
          <>
            {eventsLoading && <div className={`text-sm ${light ? 'text-gray-500' : 'text-gray-400'}`}>Loading events…</div>}
            {!eventsLoading && !!eventsError && <div className={`text-sm ${light ? 'text-red-600' : 'text-red-400'}`}>Failed to load events</div>}
            {!eventsLoading && (events?.length ?? 0) === 0 && <div className={`text-sm ${light ? 'text-gray-500' : 'text-gray-400'}`}>No recent events</div>}
            <ul className="space-y-2">
              {(showAllEvents ? events : events?.slice(0, 1))?.map((ev, idx) => (
                <li key={String(ev?.id ?? idx)} className={`text-sm ${light ? 'text-gray-700' : 'text-gray-200'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="font-medium" style={{ whiteSpace: 'pre-wrap' }}>
                        {(() => {
                          const fullTitle = ev?.title || 'Untitled event'
                          const key = getEventKey(ev || {}, idx)
                          const isExpanded = expandedTitleKeys.has(key)
                          const limit = 80
                          const needs = fullTitle.length > limit
                          if (!needs) return fullTitle
                          if (isExpanded) {
                            return <>{fullTitle} <button className={`${light ? 'text-sky-600 hover:text-sky-500' : 'text-sky-400 hover:text-sky-300'} underline text-xs`} onClick={() => setExpandedTitleKeys(prev => { const next = new Set(prev); next.delete(key); return next })}>Less</button></>
                          }
                          return <>{fullTitle.slice(0, limit)}… <button className={`${light ? 'text-sky-600 hover:text-sky-500' : 'text-sky-400 hover:text-sky-300'} underline text-xs`} onClick={() => setExpandedTitleKeys(prev => new Set(prev).add(key))}>More</button></>
                        })()}
                      </div>
                      {ev?.description && (
                        <div className={`${light ? 'text-gray-500' : 'text-gray-400'} mt-1`} style={{ whiteSpace: 'pre-wrap' }}>
                          {(() => {
                            const full = ev.description as string
                            const key = getEventKey(ev, idx)
                            const isExpanded = expandedDescKeys.has(key)
                            const limit = 160
                            const needs = full.length > limit
                            if (!needs) return full
                            if (isExpanded) {
                              return <>{full} <button className={`${light ? 'text-sky-600 hover:text-sky-500' : 'text-sky-400 hover:text-sky-300'} underline`} onClick={() => setExpandedDescKeys(prev => { const next = new Set(prev); next.delete(key); return next })}>Less</button></>
                            }
                            return <>{full.slice(0, limit)}… <button className={`${light ? 'text-sky-600 hover:text-sky-500' : 'text-sky-400 hover:text-sky-300'} underline`} onClick={() => setExpandedDescKeys(prev => new Set(prev).add(key))}>More</button></>
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-auto">
                      <div className={`text-xs whitespace-nowrap ${light ? 'text-gray-500' : 'text-gray-400'}`}>{formatEventDate(ev?.date)}</div>
                      {ev?.source && (
                        <div className="mt-1 flex justify-end">
                          {(() => {
                            const s = String(ev.source)
                            const t = s.replace(/_/g, ' ')
                            const label = t.charAt(0).toUpperCase() + t.slice(1)
                            const weight = eventWeights[s] ?? 0
                            const badgeColor = weight > 0
                              ? (light ? 'border-green-500 bg-green-50 text-green-700 hover:bg-green-100' : 'border-green-500 bg-green-500/20 text-green-200 hover:bg-green-500/30')
                              : weight < 0
                                ? (light ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100' : 'border-red-500 bg-red-500/20 text-red-200 hover:bg-red-500/30')
                                : (light ? 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200' : 'border-white/30 bg-white/5 text-gray-200 hover:bg-white/10')
                            return <span className={`inline-block px-2 py-1 text-[11px] leading-none border ${badgeColor}`} title={label}>{label}</span>
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const href = typeof ev?.url === 'string' ? ev.url : ''
                    if (!href || !/^https?:\/\//i.test(href)) return null
                    return <a href={href} target="_blank" rel="noreferrer" className={`text-xs underline ${light ? 'text-sky-600 hover:text-sky-500' : 'text-sky-400 hover:text-sky-300'}`}>Source</a>
                  })()}
                </li>
              ))}
            </ul>
            {!!events && events.length > 1 && (
              <div className="mt-2">
                {!showAllEvents ? (
                  <button className={`text-xs underline ${light ? 'text-sky-600 hover:text-sky-500' : 'text-sky-400 hover:text-sky-300'}`} onClick={() => setShowAllEvents(true)}>Show {events.length - 1} more</button>
                ) : (
                  <button className={`text-xs underline ${light ? 'text-sky-600 hover:text-sky-500' : 'text-sky-400 hover:text-sky-300'}`} onClick={() => { setShowAllEvents(false); setExpandedTitleKeys(new Set()); setExpandedDescKeys(new Set()) }}>Show less</button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
})

BusinessCard.displayName = 'BusinessCard'

// Provide a default export for more resilient dynamic importing across Next/TS module boundary changes.
export default BusinessCard
