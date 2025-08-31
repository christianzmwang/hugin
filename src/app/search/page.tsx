'use client'

import { useEffect, useMemo, useRef, useState, memo } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ALLOWED_USERS } from '@/lib/constants'

const numberFormatter: Intl.NumberFormat = (() => {
  try {
    return new Intl.NumberFormat('nb-NO')
  } catch {
    try {
      return new Intl.NumberFormat('no')
    } catch {
      return new Intl.NumberFormat()
    }
  }
})()

function useDebounce<T>(value: T, delay = 100) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function formatEventDate(dateValue: unknown): string {
  if (dateValue == null) return ''

  try {
    if (typeof dateValue === 'string') {
      const trimmed = dateValue.trim()
      if (/^\d{4}$/.test(trimmed)) return trimmed
      const date = new Date(trimmed)
      return isNaN(date.getTime()) ? trimmed : date.toLocaleDateString()
    }

    if (typeof dateValue === 'number') {
      const yearCandidate = String(dateValue)
      if (/^\d{4}$/.test(yearCandidate)) return yearCandidate
      const date = new Date(dateValue)
      return isNaN(date.getTime()) ? yearCandidate : date.toLocaleDateString()
    }

    if (dateValue instanceof Date) {
      return isNaN(dateValue.getTime()) ? '' : dateValue.toLocaleDateString()
    }

    const asString = String(dateValue)
    if (/^\d{4}$/.test(asString)) return asString
    const date = new Date(asString)
    return isNaN(date.getTime()) ? asString : date.toLocaleDateString()
  } catch {
    return String(dateValue)
  }
}

type Business = {
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
  totalAssets?: string | number | null
  equity?: string | number | null
  employeesAvg?: number | null
  industryCode1?: string | null
  industryText1?: string | null
  industryCode2?: string | null
  industryText2?: string | null
  industryCode3?: string | null
  industryText3?: string | null
  vatRegistered?: boolean | null
  vatRegisteredDate?: string | null
  sectorCode?: string | null
  sectorText?: string | null
  hasEvents?: boolean | null
  eventScore?: number | null
  eventWeightedScore?: number | null
}

type RawBusinessData = Partial<Business & {
  org_number?: string
}>

type EventItem = {
  id?: string | number
  title?: string | null
  description?: string | null
  date?: string | null
  url?: string | null
  source?: string | null
  score?: number | null
}

type IndustryOpt = { code: string | null; text: string | null; count: number }

type BusinessesResponse = {
  items: Business[]
  total: number
  grandTotal?: number
}
type SelectedIndustry = { value: string; label: string }

// Available company types (organization forms)
const COMPANY_TYPES: string[] = [
  'AS',
  'ASA',
  'ENK',
  'ANS',
  'DA',
  'NUF',
  'SA',
  'SAS',
  'A/S',
  'A/S/ASA',
]

const BusinessCard = memo(
  ({
    business,
    numberFormatter,
    selectedEventTypes,
    eventWeights,
    isWatched,
    onToggle,
  }: {
    business: Business
    numberFormatter: Intl.NumberFormat
    selectedEventTypes: string[]
    eventWeights: Record<string, number>
    isWatched: boolean
    onToggle: () => void
  }) => {
    const fmt = (v: number | string | null | undefined) =>
      v === null || v === undefined ? '—' : numberFormatter.format(Number(v))

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
      const obs = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setIsInView(true)
              obs.unobserve(entry.target)
            }
          }
        },
        { root: null, rootMargin: '200px', threshold: 0.01 },
      )
      obs.observe(el)
      return () => {
        try {
          obs.disconnect()
        } catch {}
      }
    }, [])

    const getEventKey = (ev: EventItem, idx: number) =>
      String((ev.id ?? `${business.orgNumber}-${idx}`) as string | number)
    
    useEffect(() => {
      if (!business.hasEvents) return
      if (!isInView) return
      let cancelled = false
      const load = async () => {
        setEventsLoading(true)
        setEventsError(null)
        try {
          const params = new URLSearchParams()
          params.set('orgNumber', business.orgNumber)
          params.set('limit', '50')
          if (selectedEventTypes && selectedEventTypes.length > 0) {
            params.set('eventTypes', selectedEventTypes.join(','))
          }
          const res = await fetch('/api/events?' + params.toString())
          const json = (await res.json()) as { items?: EventItem[] } | EventItem[]
          const items = Array.isArray(json) ? json : json.items || []
          const filtered =
            selectedEventTypes && selectedEventTypes.length > 0
              ? (items || []).filter((it) => {
                  if (!it) return false
                  const src =
                    typeof it.source === 'string'
                      ? it.source
                      : it?.source == null
                        ? ''
                        : String(it.source)
                  return !!src && selectedEventTypes.includes(src)
                })
              : items
          if (!cancelled) setEvents(filtered)
        } catch (e) {
          if (!cancelled) {
            setEventsError(e)
            setEvents([])
          }
        } finally {
          if (!cancelled) setEventsLoading(false)
        }
      }
      load()
      return () => {
        cancelled = true
      }
    }, [business.orgNumber, business.hasEvents, selectedEventTypes, isInView])

    const companyScore = useMemo(() => {
      if (!selectedEventTypes || selectedEventTypes.length === 0) return 0
      const backendScore = business.eventWeightedScore
      if (typeof backendScore === 'number') {
        return backendScore
      }
      const fallbackScore = business.eventScore
      if (typeof fallbackScore === 'number') {
        return fallbackScore
      }
      return 0
    }, [business.eventWeightedScore, business.eventScore, selectedEventTypes])

    return (
      <div ref={cardRef} className="py-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold mb-2">{business.name}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
              <div>
                <div className="mb-2">
                  <span className="font-medium">Org:</span> {business.orgNumber}
                </div>
                <div className="mb-2">
                  <span className="font-medium">CEO:</span> {business.ceo || '—'}
                </div>
                <div className="mb-2">
                  <span className="font-medium">Employees:</span> {business.employees ?? '—'}
                </div>
                <div className="mb-2">
                  <span className="font-medium">Revenue:</span> {business.revenue == null ? '—' : `${fmt(business.revenue)}${business.fiscalYear ? ` (FY ${business.fiscalYear})` : ''}`}
                </div>
              </div>
              <div>
                <div className="mb-2">
                  <span className="font-medium">Address:</span> {[
                    business.addressStreet,
                    business.addressPostalCode,
                    business.addressCity,
                  ].filter(Boolean).join(', ') || '—'}
                </div>
                <div className="mb-2">
                  <span className="font-medium">Website:</span>{' '}
                  {business.website ? (
                    <a className="text-sky-400 underline hover:text-sky-300" href={business.website} target="_blank" rel="noreferrer">
                      {business.website}
                    </a>
                  ) : (
                    '—'
                  )}
                </div>
                <div className="mb-2">
                  <span className="font-medium">Industry:</span>{' '}
                  {business.industryCode1 ? `${business.industryCode1} ${business.industryText1 || ''}`.trim() : '—'}
                </div>
                <div className="mb-2">
                  <span className="font-medium">Sector:</span>{' '}
                  {business.sectorCode ? `${business.sectorCode} ${business.sectorText || ''}`.trim() : '—'}
                </div>
              </div>
            </div>
          </div>
          <div className="ml-6 flex flex-col items-end gap-3">
            {(() => {
              if (!business.hasEvents) {
                return <div className="h-px w-12 bg-white/20" aria-hidden="true" />
              }
              const hasSelected = selectedEventTypes && selectedEventTypes.length > 0
              const hasAnyEvents = Array.isArray(events) && events.length > 0
              const canShowNumber = hasSelected && hasAnyEvents && !eventsLoading
              if (!canShowNumber) {
                return <div className="h-px w-12 bg-white/20" aria-hidden="true" />
              }
              const color = companyScore > 0 ? 'text-green-400' : companyScore < 0 ? 'text-red-400' : 'text-gray-300'
              return (
                <span className={`${color} text-sm font-medium`} title="Weighted score from selected event types">
                  {numberFormatter.format(companyScore)}
                </span>
              )
            })()}
            <button
              type="button"
              onClick={onToggle}
              className={`w-24 inline-flex justify-center text-xs px-2 py-1 border border-white/20 text-white/90 bg-red-500/10 hover:bg-red-500/20 hover:text-white hover:border-white/40 focus:outline-none focus:ring-1 focus:ring-red-500/40`}
              aria-pressed={isWatched}
              title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {isWatched ? 'Watching' : 'Watch'}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="text-lg font-semibold mb-3">Latest events</h4>
          {!business.hasEvents ? (
            <div className="text-sm text-gray-400">No events available</div>
          ) : (
            <>
              {eventsLoading && (
                <div className="text-sm text-gray-400">Loading events…</div>
              )}
              {!eventsLoading && !!eventsError && (
                <div className="text-sm text-red-400">Failed to load events</div>
              )}
              {!eventsLoading && (events?.length ?? 0) === 0 && (
                <div className="text-sm text-gray-400">No recent events</div>
              )}
              <ul className="space-y-2">
                {(showAllEvents ? events : events?.slice(0, 1))?.map((ev, idx) => (
                  <li key={(ev.id ?? idx) as React.Key} className="text-sm text-gray-200">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="font-medium" style={{ whiteSpace: 'pre-wrap' }}>
                          {(() => {
                            const fullTitle = ev.title || 'Untitled event'
                            const key = getEventKey(ev, idx)
                            const isExpanded = expandedTitleKeys.has(key)
                            const limit = 80
                            const needsTruncate = fullTitle.length > limit
                            if (!needsTruncate) return fullTitle
                            if (isExpanded) {
                              return (
                                <>
                                  {fullTitle}{' '}
                                  <button className="text-sky-400 hover:text-sky-300 underline text-xs" style={{ display: 'inline-block' }} onClick={() => setExpandedTitleKeys((prev) => {
                                    const next = new Set(prev)
                                    next.delete(key)
                                    return next
                                  })}>
                                    Less
                                  </button>
                                </>
                              )
                            }
                            return (
                              <>
                                {fullTitle.slice(0, limit)}…{' '}
                                <button className="text-sky-400 hover:text-sky-300 underline text-xs" style={{ display: 'inline-block' }} onClick={() => setExpandedTitleKeys((prev) => new Set(prev).add(key))}>
                                  More
                                </button>
                              </>
                            )
                          })()}
                        </div>
                        {ev.description && (
                          <div className="text-gray-400 mt-1" style={{ whiteSpace: 'pre-wrap' }}>
                            {(() => {
                              const full = ev.description as string
                              const key = getEventKey(ev, idx)
                              const isExpanded = expandedDescKeys.has(key)
                              const limit = 160
                              const needsTruncate = full.length > limit
                              if (!needsTruncate) return full
                              if (isExpanded) {
                                return (
                                  <>
                                    {full}{' '}
                                    <button className="text-sky-400 hover:text-sky-300 underline" style={{ display: 'inline-block' }} onClick={() => {
                                      setExpandedDescKeys((prev) => {
                                        const next = new Set(prev)
                                        next.delete(key)
                                        return next
                                      })
                                    }}>
                                      Less
                                    </button>
                                  </>
                                )
                              }
                              return (
                                <>
                                  {full.slice(0, limit)}…{' '}
                                  <button className="text-sky-400 hover:text-sky-300 underline" style={{ display: 'inline-block' }} onClick={() => {
                                    setExpandedDescKeys((prev) => new Set(prev).add(key))
                                  }}>
                                    More
                                  </button>
                                </>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-auto">
                        <div className="text-xs text-gray-400 whitespace-nowrap">
                          {formatEventDate(ev.date)}
                        </div>
                        {ev.source ? (
                          <div className="mt-1 flex justify-end">
                            {(() => {
                              const s = typeof ev.source === 'string' ? ev.source : ev?.source == null ? '' : String(ev.source)
                              const t = s.replace(/_/g, ' ')
                              const label = t.charAt(0).toUpperCase() + t.slice(1)
                              const weight = eventWeights[s] ?? 0
                              const badgeColor = weight > 0 
                                ? 'border-green-500 bg-green-500/20 text-green-200 hover:bg-green-500/30'
                                : weight < 0 
                                  ? 'border-red-500 bg-red-500/20 text-red-200 hover:bg-red-500/30'
                                  : 'border-white/30 bg-white/5 text-gray-200 hover:bg-white/10'
                              return (
                                <span className={`inline-block px-2 py-1 text-[11px] leading-none border ${badgeColor}`} title={label} aria-label={label}>
                                  {label}
                                </span>
                              )
                            })()}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {(() => {
                      const href = typeof ev.url === 'string' ? ev.url : String(ev.url ?? '')
                      if (!href || !/^https?:\/\//i.test(href)) return null
                      return (
                        <a href={href} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:text-sky-300 underline">
                          Source
                        </a>
                      )
                    })()}
                  </li>
                ))}
              </ul>
              {!!events && events.length > 1 && (
                <div className="mt-2">
                  {!showAllEvents ? (
                    <button className="text-xs text-sky-400 hover:text-sky-300 underline" onClick={() => setShowAllEvents(true)}>
                      Show {events.length - 1} more
                    </button>
                  ) : (
                    <button className="text-xs text-sky-400 hover:text-sky-300 underline" onClick={() => {
                      setShowAllEvents(false)
                      setExpandedTitleKeys(new Set())
                      setExpandedDescKeys(new Set())
                    }}>
                      Show less
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  },
)

BusinessCard.displayName = 'BusinessCard'

export default function SearchPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    const userEmail = session.user?.email
    if (userEmail && !ALLOWED_USERS.includes(userEmail)) {
      router.push('/countdown')
      return
    }
  }, [session, status, router])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const [data, setData] = useState<Business[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [grandTotal, setGrandTotal] = useState<number | null>(null)
  const [, setCountPending] = useState<boolean>(false)
  const [industryQuery, setIndustryQuery] = useState('')
  const [selectedIndustries, setSelectedIndustries] = useState<SelectedIndustry[]>(() => {
    if (typeof window === 'undefined') return []
    const sp = new URLSearchParams(window.location.search)
    const inds = sp.getAll('industries')
    return inds.map((v) => ({ value: v, label: v }))
  })
  const [allIndustries, setAllIndustries] = useState<IndustryOpt[]>([])
  const [suggestions, setSuggestions] = useState<IndustryOpt[]>([])
  const globalSearchRef = useRef<HTMLInputElement | null>(null)
  const globalDropdownRef = useRef<HTMLDivElement | null>(null)
  const [globalDropdownRect, setGlobalDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [globalDropdownOpen, setGlobalDropdownOpen] = useState(false)
  const [companySuggestions, setCompanySuggestions] = useState<Array<{ name: string; orgNumber: string }>>([])
  const [globalSearch, setGlobalSearch] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('q') || ''
  })
  const [committedGlobalSearch, setCommittedGlobalSearch] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('q') || ''
  })
  const [areaQuery, setAreaQuery] = useState('')
  const [selectedAreas, setSelectedAreas] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    const sp = new URLSearchParams(window.location.search)
    const arr = sp.getAll('areas')
    return arr.filter(Boolean)
  })
  const areaInputRef = useRef<HTMLInputElement | null>(null)
  const areaDropdownRef = useRef<HTMLDivElement | null>(null)
  const [areaDropdownRect, setAreaDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [areaDropdownOpen, setAreaDropdownOpen] = useState(false)
  const [areaSuggestions, setAreaSuggestions] = useState<string[]>([])
  const [companyTypeQuery, setCompanyTypeQuery] = useState('')
  const [selectedCompanyTypes, setSelectedCompanyTypes] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    return new URLSearchParams(window.location.search).getAll('orgFormCode').map((s) => s.trim()).filter(Boolean)
  })
  const companyTypeInputRef = useRef<HTMLInputElement | null>(null)
  const companyTypeDropdownRef = useRef<HTMLDivElement | null>(null)
  const [companyTypeDropdownRect, setCompanyTypeDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [companyTypeDropdownOpen, setCompanyTypeDropdownOpen] = useState(false)
  const [companyTypeSuggestions, setCompanyTypeSuggestions] = useState<string[]>(COMPANY_TYPES)
  const [revenueMin, setRevenueMin] = useState<number | ''>(() => {
    if (typeof window === 'undefined') return ''
    const sp = new URLSearchParams(window.location.search)
    const v = sp.get('revenueMin')
    const n = v == null ? NaN : Number(v)
    return Number.isFinite(n) ? Math.floor(n) : ''
  })
  const [revenueMax, setRevenueMax] = useState<number | ''>(() => {
    if (typeof window === 'undefined') return ''
    const sp = new URLSearchParams(window.location.search)
    const v = sp.get('revenueMax')
    const n = v == null ? NaN : Number(v)
    return Number.isFinite(n) ? Math.floor(n) : ''
  })
  const [selectedRevenueRange, setSelectedRevenueRange] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('revenueRange') || ''
  })
  const [maxRevenue, setMaxRevenue] = useState<number>(108070744000)
  const [minRevenue, setMinRevenue] = useState<number>(-1868256000)
  const [apiLoaded, setApiLoaded] = useState<boolean>(false)
  const [eventsFilter, setEventsFilter] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('events') || ''
  })
  const [availableEventTypes, setAvailableEventTypes] = useState<string[]>([])
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    const sp = new URLSearchParams(window.location.search)
    const csv = sp.get('eventTypes') || ''
    return csv ? csv.split(',').map((s) => s.trim()).filter(Boolean) : []
  })
  const [eventWeights, setEventWeights] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {}
    const sp = new URLSearchParams(window.location.search)
    try {
      const raw = sp.get('eventWeights')
      if (!raw) return {}
      const obj = JSON.parse(raw)
      if (obj && typeof obj === 'object') return obj as Record<string, number>
    } catch {}
    return {}
  })
  const selectedSource = 'general'
  const [sortBy, setSortBy] = useState<string>(() => {
    if (typeof window === 'undefined') return 'updatedAt'
    const v = new URLSearchParams(window.location.search).get('sortBy') || 'updatedAt'
    const allowed = new Set(['updatedAt', 'name', 'revenue', 'employees', 'scoreDesc', 'scoreAsc'])
    return allowed.has(v) ? v : 'updatedAt'
  })
  const [offset, setOffset] = useState<number>(0)
  const debouncedIndustry = useDebounce(industryQuery, 100)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [operatingResults, setOperatingResults] = useState('')
  const eventsRef = useRef<HTMLDivElement>(null);

  // Watchlist state
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    fetch('/api/watchlist', { cache: 'no-store' })
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return
        const items = Array.isArray(res) ? res : res.items || []
        const next = new Set<string>()
        for (const it of items) {
          const org = String((it?.orgNumber ?? it?.org_number ?? '') as string)
          if (org) next.add(org)
        }
        setWatchlist(next)
      })
      .catch(() => setWatchlist(new Set()))
    return () => {
      cancelled = true
    }
  }, [status])

  const addWatch = async (org: string) => {
    try {
      await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgNumber: org }),
      })
      setWatchlist((prev) => new Set(prev).add(org))
    } catch {}
  }
  const removeWatch = async (org: string) => {
    try {
      await fetch('/api/watchlist?orgNumber=' + encodeURIComponent(org), { method: 'DELETE' })
      setWatchlist((prev) => {
        const next = new Set(prev)
        next.delete(org)
        return next
      })
    } catch {}
  }

  // Use hardcoded revenue bounds for immediate loading
  const uiMaxRevenue = useMemo(() => {
    return maxRevenue
  }, [maxRevenue])

  const uiMinRevenue = useMemo(() => {
    return minRevenue
  }, [minRevenue])

  // Derived revenue bounds for UI and query
  const numericRevenueMin = revenueMin === '' ? uiMinRevenue : revenueMin
  const numericRevenueMax = revenueMax === '' ? uiMaxRevenue : revenueMax
  const derivedLower = Math.min(Math.max(numericRevenueMin, uiMinRevenue), uiMaxRevenue)
  const derivedUpper = Math.max(Math.min(numericRevenueMax, uiMaxRevenue), uiMinRevenue)
  
  // Only apply revenue filter if user has explicitly set bounds different from global range
  const hasRevenueFilter = !(
    (revenueMin === '' || revenueMin === uiMinRevenue) && 
    (revenueMax === '' || revenueMax === uiMaxRevenue)
  )
  
  // Only send revenue params to API if there's an actual filter applied
  const shouldApplyRevenueFilter = hasRevenueFilter && 
    (derivedLower !== uiMinRevenue || derivedUpper !== uiMaxRevenue)

  const queryParam = useMemo(() => {
    const sp = new URLSearchParams()
    selectedIndustries.forEach((si) => sp.append('industries', si.value))
    selectedAreas.forEach((a) => sp.append('areas', a))
    if (committedGlobalSearch.trim()) sp.append('q', committedGlobalSearch.trim())
    if (shouldApplyRevenueFilter) {
      sp.append('revenueMin', String(derivedLower))
      sp.append('revenueMax', String(derivedUpper))
    }
    if (eventsFilter) sp.append('events', eventsFilter)
    if (selectedEventTypes.length > 0) sp.append('eventTypes', selectedEventTypes.join(','))
    if (selectedEventTypes.length > 0) sp.append('eventWeights', JSON.stringify(eventWeights))
    sp.append('source', selectedSource)
    if (sortBy) sp.append('sortBy', sortBy)
    selectedCompanyTypes.forEach((t) => sp.append('orgFormCode', t))
    if (offset) sp.append('offset', String(offset))
    if (offset === 0) sp.append('skipCount', '1')
    return sp.toString() ? `?${sp.toString()}` : ''
  }, [selectedIndustries, selectedAreas, committedGlobalSearch, shouldApplyRevenueFilter, derivedLower, derivedUpper, eventsFilter, selectedEventTypes, eventWeights, sortBy, offset, selectedCompanyTypes])

  const addSelectedIndustry = (value: string, label?: string) => {
    const v = value.trim()
    if (!v) return
    setSelectedIndustries((prev) => {
      const exists = prev.some((p) => p.value.toLowerCase() === v.toLowerCase())
      if (exists) return prev
      return [...prev, { value: v, label: (label ?? v).trim() }]
    })
  }

  const removeSelectedIndustry = (value: string) => {
    setSelectedIndustries((prev) => prev.filter((p) => p.value.toLowerCase() !== value.toLowerCase()))
  }

  const addSelectedArea = (value: string) => {
    const v = value.trim()
    if (!v) return
    setSelectedAreas((prev) => {
      const exists = prev.some((p) => p.toLowerCase() === v.toLowerCase())
      if (exists) return prev
      return [...prev, v]
    })
  }

  const removeSelectedArea = (value: string) => {
    setSelectedAreas((prev) => prev.filter((p) => p.toLowerCase() !== value.toLowerCase()))
  }

  useEffect(() => {
    setLoading(true)
    setCountPending(queryParam.includes('skipCount=1'))
    const hasEventWeights = Object.keys(eventWeights).length > 0
    const delay = hasEventWeights ? Math.random() * 2000 + 2000 : 0
    const timeoutId = setTimeout(() => {
      fetch('/api/businesses' + queryParam)
        .then((r) => r.json())
        .then((res: BusinessesResponse | Business[]) => {
          if (Array.isArray(res)) {
            setData((prev) => {
              const normalize = (arr: RawBusinessData[]): Business[] =>
                (arr || []).map((b: RawBusinessData) => ({ ...b, orgNumber: String(b?.orgNumber ?? b?.org_number ?? '').trim(), })).filter((b: RawBusinessData) => b && b.orgNumber && b.orgNumber.length > 0) as Business[]
              if (offset > 0) {
                const combined = [...prev, ...normalize(res)]
                const seen = new Set<string>()
                return combined.filter((business) => {
                  const org = business?.orgNumber
                  if (!org) return false
                  if (seen.has(org)) return false
                  seen.add(org)
                  return true
                })
              }
              return normalize(res)
            })
            setTotal(res.length)
          } else {
            setData((prev) => {
              const normalize = (arr: RawBusinessData[]): Business[] =>
                (arr || []).map((b: RawBusinessData) => ({ ...b, orgNumber: String(b?.orgNumber ?? b?.org_number ?? '').trim(), })).filter((b: RawBusinessData) => b && b.orgNumber && b.orgNumber.length > 0) as Business[]
              if (offset > 0) {
                const combined = [...prev, ...normalize(res.items)]
                const seen = new Set<string>()
                return combined.filter((business) => {
                  const org = business?.orgNumber
                  if (!org) return false
                  if (seen.has(org)) return false
                  seen.add(org)
                  return true
                })
              }
              return normalize(res.items)
            })
            if (typeof res.total === 'number' && res.total > 0) setTotal(res.total)
            if (typeof res.grandTotal === 'number') setGrandTotal(res.grandTotal)
          }
        })
        .finally(() => setLoading(false))
    }, delay)
    return () => clearTimeout(timeoutId)
  }, [queryParam, offset, eventWeights])

  useEffect(() => {
    const hasSkip = queryParam.includes('skipCount=1')
    if (!hasSkip) return
    const sp = new URLSearchParams(queryParam.replace(/^\?/, ''))
    sp.delete('skipCount')
    sp.set('countOnly', '1')
    fetch('/api/businesses?' + sp.toString())
      .then((r) => r.json())
      .then((res: { total?: number; grandTotal?: number }) => {
        if (typeof res.total === 'number') setTotal(res.total)
        if (typeof res.grandTotal === 'number') setGrandTotal(res.grandTotal)
      })
      .catch(() => {})
      .finally(() => setCountPending(false))
  }, [queryParam])

  useEffect(() => {
    if ((sortBy === 'scoreDesc' || sortBy === 'scoreAsc') && selectedEventTypes.length === 0) {
      setSortBy('updatedAt')
    }
  }, [sortBy, selectedEventTypes.length])

  useEffect(() => {
    setOffset(0)
    setData([])
  }, [selectedIndustries, selectedAreas, revenueMin, revenueMax, eventsFilter, selectedEventTypes, eventWeights, sortBy, selectedCompanyTypes])

  // Fetch both min and max revenue bounds from API
  useEffect(() => {
    let cancelled = false
    
    const fetchBounds = async () => {
      try {
        const [maxRes, minRes] = await Promise.all([
          fetch('/api/businesses/max-revenue').then((r) => r.json()),
          fetch('/api/businesses/min-revenue').then((r) => r.json())
        ])
        
        if (cancelled) return
        
        const maxVal = Number(maxRes?.maxRevenue)
        const minVal = Number(minRes?.minRevenue)
        
        setMaxRevenue(Number.isFinite(maxVal) ? Math.floor(maxVal) : 0)
        setMinRevenue(Number.isFinite(minVal) ? Math.floor(minVal) : 0)
        setApiLoaded(true)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch revenue bounds:', error)
          setMaxRevenue(0)
          setMinRevenue(0)
          setApiLoaded(true) // Mark as loaded even on error to prevent infinite loading
        }
      }
    }
    
    fetchBounds()
    return () => { cancelled = true }
  }, [])

  // Set initial revenue range to hardcoded values if no URL params were provided
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Check if URL had revenue parameters - if so, don't override
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('revenueMin') || sp.get('revenueMax')) return
    
    // Only set once on initial load if values are empty
    if (revenueMin === '' && revenueMax === '') {
      console.log('Setting initial revenue range to full bounds:', { minRevenue, maxRevenue })
      setRevenueMin(minRevenue)
      setRevenueMax(maxRevenue)
    }
  }, [minRevenue, maxRevenue, revenueMin, revenueMax])

  // Back-compat: map revenueRange buckets from URL into min/max if provided and min/max are empty
  useEffect(() => {
    if (!selectedRevenueRange) return
    if (revenueMin !== '' || revenueMax !== '') return
    switch (selectedRevenueRange) {
      case '0-1M':
        setRevenueMin(0); setRevenueMax(1000000); break
      case '1M-10M':
        setRevenueMin(1000000); setRevenueMax(10000000); break
      case '10M-100M':
        setRevenueMin(10000000); setRevenueMax(100000000); break
      case '100M+':
        setRevenueMin(100000000); setRevenueMax(''); break
    }
  }, [selectedRevenueRange, revenueMin, revenueMax])

  useEffect(() => {
    fetch('/api/industries')
      .then((r) => r.json())
      .then((rows: IndustryOpt[]) => {
        setAllIndustries(rows)
        setSuggestions(rows)
      })
      .catch(() => {
        setAllIndustries([])
        setSuggestions([])
      })
  }, [])

  useEffect(() => {
    fetch('/api/events/types')
      .then((r) => r.json())
      .then((res: { items?: string[] }) => setAvailableEventTypes(res.items || []))
      .catch(() => setAvailableEventTypes([]))
  }, [])

  const [totalFilteredCount, setTotalFilteredCount] = useState(0)

  useEffect(() => {
    if (!debouncedIndustry.trim()) {
      setSuggestions(allIndustries)
      setTotalFilteredCount(allIndustries.length)
      return
    }
    const query = debouncedIndustry.toLowerCase()
    const filtered = allIndustries.filter((industry) => {
      const code = (industry.code || '').toLowerCase()
      const text = (industry.text || '').toLowerCase()
      return code.includes(query) || text.includes(query)
    })
    setTotalFilteredCount(filtered.length)
    filtered.sort((a, b) => {
      const aCode = (a.code || '').toLowerCase()
      const aText = (a.text || '').toLowerCase()
      const bCode = (b.code || '').toLowerCase()
      const bText = (b.text || '').toLowerCase()
      const aExact = aCode === query || aText === query
      const bExact = bCode === query || bText === query
      if (aExact !== bExact) return aExact ? -1 : 1
      const aStarts = aCode.startsWith(query) || aText.startsWith(query)
      const bStarts = bCode.startsWith(query) || bText.startsWith(query)
      if (aStarts !== bStarts) return aStarts ? -1 : 1
      return aCode.localeCompare(bCode)
    })
    setSuggestions(filtered.slice(0, 100))
  }, [debouncedIndustry, allIndustries])

  // Keep global search dropdown positioned
  useEffect(() => {
    if (!globalDropdownOpen) return
    const updateRect = () => {
      const el = globalSearchRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setGlobalDropdownRect({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    }
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [globalDropdownOpen])

  // Close on outside click for global search
  useEffect(() => {
    if (!globalDropdownOpen) return
    const handleDown = (e: MouseEvent) => {
      const input = globalSearchRef.current
      const menu = globalDropdownRef.current
      const target = e.target as Node
      if (menu && menu.contains(target)) return
      if (input && input.contains(target)) return
      setGlobalDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleDown)
    return () => document.removeEventListener('mousedown', handleDown)
  }, [globalDropdownOpen])

  // Company suggestions (immediate while typing)
  const debouncedGlobal = useDebounce(globalSearch, 0)
  useEffect(() => {
    const term = (debouncedGlobal || '').trim()
    if (term.length < 1) {
      setCompanySuggestions([])
      setGlobalDropdownOpen(false)
      return
    }
    let cancelled = false
    const fetchSuggestions = async () => {
      try {
        const res = await fetch(`/api/businesses?q=${encodeURIComponent(term)}&skipCount=1`)
        const json = await res.json()
        const items = Array.isArray(json) ? json : json.items || []
        const uniq = new Map<string, { name: string; orgNumber: string }>()
        for (const it of items) {
          const org = String((it?.orgNumber ?? '').toString())
          if (!org) continue
          if (!uniq.has(org)) uniq.set(org, { name: String(it?.name ?? ''), orgNumber: org })
          if (uniq.size >= 12) break
        }
        if (!cancelled) {
          setCompanySuggestions(Array.from(uniq.values()))
          setGlobalDropdownOpen(true)
        }
      } catch {
        if (!cancelled) {
          setCompanySuggestions([])
          setGlobalDropdownOpen(false)
        }
      }
    }
    fetchSuggestions()
    return () => { cancelled = true }
  }, [debouncedGlobal])

  useEffect(() => {
    if (!dropdownOpen) return
    const updateRect = () => {
      const el = inputRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setDropdownRect({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    }
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [dropdownOpen])

  // Keep company type dropdown positioned
  useEffect(() => {
    if (!companyTypeDropdownOpen) return
    const updateRect = () => {
      const el = companyTypeInputRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setCompanyTypeDropdownRect({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    }
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [companyTypeDropdownOpen])

  

  // Close on outside click for company type
  useEffect(() => {
    if (!companyTypeDropdownOpen) return
    const handleDown = (e: MouseEvent) => {
      const input = companyTypeInputRef.current
      const menu = companyTypeDropdownRef.current
      const target = e.target as Node
      if (menu && menu.contains(target)) return
      if (input && input.contains(target)) return
      setCompanyTypeDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleDown)
    return () => document.removeEventListener('mousedown', handleDown)
  }, [companyTypeDropdownOpen])

  useEffect(() => {
    if (!dropdownOpen) return
    const handleDown = (e: MouseEvent) => {
      const input = inputRef.current
      const menu = dropdownRef.current
      const target = e.target as Node
      if (menu && menu.contains(target)) return
      if (input && input.contains(target)) return
      setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleDown)
    return () => document.removeEventListener('mousedown', handleDown)
  }, [dropdownOpen])

  useEffect(() => {
    const updateHeight = () => {
      if (eventsRef.current) {
        const height = eventsRef.current.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--events-height', `${height}px`);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [eventsFilter]);  // Re-run when eventsFilter changes as it affects height

  const sortedData = data

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <div className="text-lg text-gray-400">Loading...</div>
        </div>
      </div>
    )
  }

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

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20 md:pb-24">
      {globalDropdownOpen && companySuggestions.length > 0 && globalDropdownRect && isMounted && createPortal(
        <div
          ref={globalDropdownRef}
          className="z-[9999] max-h-80 overflow-auto border border-white/10 bg-black text-white shadow-xl divide-y divide-white/10"
          style={{ position: 'fixed', top: globalDropdownRect.top, left: globalDropdownRect.left, width: globalDropdownRect.width }}
        >
          {companySuggestions.map((c, idx) => (
            <button
              key={`${c.orgNumber}-${idx}`}
              onClick={() => {
                setGlobalSearch(c.name || c.orgNumber)
                setGlobalDropdownOpen(false)
              }}
              className="block w-full text-left px-4 py-3 hover:bg-white/20 focus:bg-white/20 focus:outline-none text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span>{c.name || 'Unnamed company'}</span>
                <span className="text-xs text-gray-400">{c.orgNumber}</span>
              </div>
            </button>
          ))}
        </div>,
        document.body,
      )}
      {/* Topwide search + quick filters */}
      <div className="px-6 py-3 border-b border-white/10">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="w-full md:w-1/3">
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search companies"
              ref={globalSearchRef}
              onFocus={() => {
                setGlobalDropdownOpen(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setCommittedGlobalSearch(globalSearch)
                  setOffset(0)
                  setGlobalDropdownOpen(false)
                }
              }}
              className="w-full bg-transparent text-white placeholder-gray-500 px-0 py-2 border-0 border-b border-white/20 focus:outline-none focus:ring-0 focus:border-white/40"
            />
          </div>
          <div className="w-full md:w-2/3 grid grid-cols-1 sm:grid-cols-3 gap-3 md:pl-3">
            <input
              type="text"
              value={industryQuery}
              onChange={(e) => setIndustryQuery(e.target.value)}
              placeholder="Industry filter"
              onFocus={(e) => {
                // Anchor dropdown to this input
                inputRef.current = e.currentTarget as HTMLInputElement
                if (!industryQuery.trim() && allIndustries.length > 0) {
                  setSuggestions(allIndustries)
                }
                setDropdownOpen(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addSelectedIndustry(industryQuery)
                  setIndustryQuery('')
                  setSuggestions([])
                  setDropdownOpen(false)
                } else if (e.key === 'Escape') {
                  setDropdownOpen(false)
                } else if (
                  e.key === 'Backspace' &&
                  industryQuery.length === 0 &&
                  selectedIndustries.length > 0
                ) {
                  removeSelectedIndustry(
                    selectedIndustries[selectedIndustries.length - 1].value,
                  )
                }
              }}
              className="w-full bg-transparent text-white placeholder-gray-500 px-0 py-2 border-0 border-b border-white/20 focus:outline-none focus:ring-0 focus:border-white/40"
            />
            <input
              type="text"
              value={areaQuery}
              onChange={(e) => setAreaQuery(e.target.value)}
              placeholder="Area filter"
              ref={areaInputRef}
              onFocus={(e) => {
                setAreaDropdownOpen(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addSelectedArea(areaQuery)
                  setAreaQuery('')
                  setAreaDropdownOpen(false)
                } else if (
                  e.key === 'Backspace' &&
                  areaQuery.length === 0 &&
                  selectedAreas.length > 0
                ) {
                  removeSelectedArea(selectedAreas[selectedAreas.length - 1])
                }
              }}
              className="w-full bg-transparent text-white placeholder-gray-500 px-0 py-2 border-0 border-b border-white/20 focus:outline-none focus:ring-0 focus:border-white/40"
            />
            <input
              type="text"
              value={companyTypeQuery}
              onChange={(e) => {
                const val = e.target.value
                setCompanyTypeQuery(val)
                const q = val.trim().toLowerCase()
                setCompanyTypeSuggestions(q ? COMPANY_TYPES.filter((c) => c.toLowerCase().includes(q)) : COMPANY_TYPES)
                setCompanyTypeDropdownOpen(true)
              }}
              placeholder="Company type"
              ref={companyTypeInputRef}
              onFocus={() => {
                setCompanyTypeSuggestions(COMPANY_TYPES)
                setCompanyTypeDropdownOpen(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const candidate = (companyTypeQuery || '').trim().toUpperCase()
                  const exact = COMPANY_TYPES.find((c) => c === candidate)
                  const choice = exact || companyTypeSuggestions[0]
                  if (choice) {
                    setSelectedCompanyTypes((prev) => prev.includes(choice) ? prev : [...prev, choice])
                    setCompanyTypeQuery('')
                    setCompanyTypeDropdownOpen(false)
                  }
                } else if (e.key === 'Escape') {
                  setCompanyTypeDropdownOpen(false)
                } else if (e.key === 'Backspace' && companyTypeQuery.length === 0 && selectedCompanyTypes.length > 0) {
                  setSelectedCompanyTypes((prev) => prev.slice(0, -1))
                }
              }}
              className="w-full bg-transparent text-white placeholder-gray-500 px-0 py-2 border-0 border-b border-white/20 focus:outline-none focus:ring-0 focus:border-white/40"
            />
          </div>
        </div>
        {companyTypeDropdownOpen && companyTypeDropdownRect && isMounted && createPortal(
          <div
            ref={companyTypeDropdownRef}
            className="z-[9999] max-h-80 overflow-auto border border-white/10 bg-black text-white shadow-xl divide-y divide-white/10"
            style={{ position: 'fixed', top: companyTypeDropdownRect.top, left: companyTypeDropdownRect.left, width: companyTypeDropdownRect.width }}
          >
            {companyTypeSuggestions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-400">No matches</div>
            ) : (
              companyTypeSuggestions.map((s, idx) => (
                <button
                  key={`${s}-${idx}`}
                  onClick={() => {
                    setSelectedCompanyTypes((prev) => prev.includes(s) ? prev : [...prev, s])
                    setCompanyTypeQuery('')
                    setCompanyTypeDropdownOpen(false)
                  }}
                  className="block w-full text-left px-4 py-3 hover:bg-white/20 focus:bg-white/20 focus:outline-none text-sm"
                >
                  {s}
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
        {dropdownOpen && suggestions.length > 0 && dropdownRect && isMounted && createPortal(
          <div
            ref={dropdownRef}
            className="z-[9999] max-h-80 overflow-auto border border-white/10 bg-black text-white shadow-xl divide-y divide-white/10"
            style={{ position: 'fixed', top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
          >
            {industryQuery.trim() && (
              <div className="px-4 py-2 text-xs text-gray-400 bg-gray-800 border-b border-white/10">
                {suggestions.length} of {totalFilteredCount} industries match &quot;{industryQuery}&quot;
              </div>
            )}
            {!industryQuery.trim() && allIndustries.length > 0 && (
              <div className="px-4 py-2 text-xs text-gray-400 bg-gray-800 border-b border-white/10">
                {suggestions.length} of {allIndustries.length} industries shown
              </div>
            )}
            {suggestions.map((s, idx) => {
              const label = [s.code, s.text].filter(Boolean).join(' – ')
              const term = (s.code || s.text || '').toString()
              return (
                <button
                  key={idx}
                  onClick={() => {
                    addSelectedIndustry(term, label)
                    setIndustryQuery('')
                    setSuggestions([])
                    setDropdownOpen(false)
                  }}
                  className="block w-full text-left px-4 py-3 hover:bg-white/20 focus:bg-white/20 focus:outline-none text-sm"
                >
                  {label}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
        {areaDropdownOpen && areaDropdownRect && isMounted && createPortal(
          <div
            ref={areaDropdownRef}
            className="z-[9999] max-h-80 overflow-auto border border-white/10 bg-black text-white shadow-xl divide-y divide-white/10"
            style={{ position: 'fixed', top: areaDropdownRect.top, left: areaDropdownRect.left, width: areaDropdownRect.width }}
          >
            {areaSuggestions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-400">No matches</div>
            ) : (
              areaSuggestions.map((s, idx) => (
                <button
                  key={`${s}-${idx}`}
                  onClick={() => {
                    addSelectedArea(s)
                    setAreaQuery('')
                    setAreaDropdownOpen(false)
                  }}
                  className="block w-full text-left px-4 py-3 hover:bg-white/20 focus:bg-white/20 focus:outline-none text-sm"
                >
                  {s}
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
      </div>

      {(() => {
        const hasAnyAppliedFilter =
          selectedIndustries.length > 0 ||
          selectedAreas.length > 0 ||
          hasRevenueFilter ||
          !!eventsFilter ||
          selectedEventTypes.length > 0 ||
          selectedCompanyTypes.length > 0
        if (!hasAnyAppliedFilter) return null
        const revenueLabel = `${numberFormatter.format(derivedLower)} - ${derivedUpper === uiMaxRevenue ? 'Max' : numberFormatter.format(derivedUpper)} NOK`
        return (
          <div className="px-6 py-2 border-b border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400 mr-1">Applied:</span>
              {selectedIndustries.map((si) => (
                <span key={`applied-ind-${si.value}`} className="group inline-flex items-center gap-1 text-xs px-2 py-1 border border-white/20 text-white/90">
                  <span>{si.label}</span>
                  <button
                    type="button"
                    title="Remove industry"
                    aria-label="Remove industry"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeSelectedIndustry(si.value)}
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedAreas.map((a) => (
                <span key={`applied-area-${a}`} className="group inline-flex items-center gap-1 text-xs px-2 py-1 border border-white/20 text-white/90">
                  <span>{a}</span>
                  <button
                    type="button"
                    title="Remove area"
                    aria-label="Remove area"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeSelectedArea(a)}
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedCompanyTypes.map((t) => (
                <span key={`applied-ctype-${t}`} className="group inline-flex items-center gap-1 text-xs px-2 py-1 border border-white/20 text-white/90">
                  <span>{t}</span>
                  <button
                    type="button"
                    title="Remove company type"
                    aria-label="Remove company type"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setSelectedCompanyTypes((prev) => prev.filter((x) => x !== t))
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              {hasRevenueFilter && (
                <span className="group inline-flex items-center gap-1 text-xs px-2 py-1 border border-white/20 text-white/90">
                  <span>Revenue: {revenueLabel}</span>
                  <button
                    type="button"
                    title="Remove revenue filter"
                    aria-label="Remove revenue filter"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { setRevenueMin(''); setRevenueMax(''); setSelectedRevenueRange('') }}
                  >
                    ×
                  </button>
                </span>
              )}
              {!!eventsFilter && (
                <span className="group inline-flex items-center gap-1 text-xs px-2 py-1 border border-white/20 text-white/90">
                  <span>{eventsFilter === 'with' ? 'With events' : 'Without events'}</span>
                  <button
                    type="button"
                    title="Remove events filter"
                    aria-label="Remove events filter"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setEventsFilter('')}
                  >
                    ×
                  </button>
                </span>
              )}
              {selectedEventTypes.map((t) => {
                const display = t.replace(/_/g, ' ')
                const label = display.charAt(0).toUpperCase() + display.slice(1)
                return (
                  <span key={`applied-etype-${t}`} className="group inline-flex items-center gap-1 text-xs px-2 py-1 border border-white/20 text-white/90">
                    <span>{label}</span>
                    <button
                      type="button"
                      title="Remove event type"
                      aria-label="Remove event type"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        setSelectedEventTypes((prev) => prev.filter((x) => x !== t))
                        setEventWeights((prev) => ({ ...prev, [t]: 0 }))
                      }}
                    >
                      ×
                    </button>
                  </span>
                )
              })}
              <button
                type="button"
                className="ml-2 text-xs px-2 py-1 border border-white/20 text-white/90 bg-red-500/10 hover:bg-red-500/20 hover:text-white hover:border-white/40 focus:outline-none focus:ring-1 focus:ring-red-500/40"
                onClick={() => {
                  setSelectedIndustries([])
                  setIndustryQuery('')
                  setSelectedAreas([])
                  setAreaQuery('')
                  setSelectedCompanyTypes([])
                  setCompanyTypeQuery('')
                  setRevenueMin('')
                  setRevenueMax('')
                  setSelectedRevenueRange('')
                  setEventsFilter('')
                  setSelectedEventTypes([])
                  setEventWeights({})
                  setOffset(0)
                }}
              >
                Clear filters
              </button>
            </div>
          </div>
        )
      })()}

      <div className="flex">
        <div className="w-96 bg-black border-r border-white/10 min-h-screen p-6 sticky top-0 self-start overflow-y-auto">
          <div className="mb-6">
            <div className="sticky top-0 z-20 bg-black pb-2" ref={eventsRef}>
              <label className="block text-sm font-medium mb-2">Events</label>
              <select value={eventsFilter} onChange={(e) => setEventsFilter(e.target.value)} className="w-full px-3 py-2 bg-transparent text-white border border-white/10 focus:outline-none focus:ring-0 focus:border-white/40">
                <option value="">All companies</option>
                <option value="with">With events</option>
                <option value="without">Without events</option>
              </select>
            
            </div>
            <div className="mt-6">
              <div className="sticky top-[var(--events-height)] z-10 bg-black pb-2">
                <label className="block text-sm font-medium">Event types</label>
              </div>
              <div className="space-y-3 pr-1">
                {availableEventTypes.map((raw) => {
                  const t = raw
                  const selected = selectedEventTypes.includes(t)
                  const weight = eventWeights[t] ?? 0
                  const display = (t || '').replace(/_/g, ' ')
                  const displayCap = display.charAt(0).toUpperCase() + display.slice(1)
                  return (
                    <div key={t} className={`p-3 bg-transparent border ${selected ? (weight > 0 ? 'border-green-500' : weight < 0 ? 'border-red-500' : 'border-yellow-500') : 'border-white/10'}`} onClick={() => {
                      setSelectedEventTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])
                      if (selected) {
                        setEventWeights((prev) => ({ ...prev, [t]: 0 }))
                      } else if (eventWeights[t] === undefined) {
                        setEventWeights((prev) => ({ ...prev, [t]: 0 }))
                      }
                    }}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm">{displayCap}</span>
                        <span className="text-xs text-gray-400">{weight}</span>
                      </div>
                      <input type="range" min={-10} max={10} step={1} value={weight} onClick={(e) => e.stopPropagation()} onChange={(e) => {
                        const val = Number(e.target.value)
                        setEventWeights((prev) => ({ ...prev, [t]: val }))
                        if (!selectedEventTypes.includes(t)) {
                          setSelectedEventTypes((prev) => [...prev, t])
                        }
                      }} className="w-full mt-3 slider-square" />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6">
          <div className="mb-8 space-y-6">
            <div className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Revenue <span className="ml-2 text-xs text-gray-400 align-middle">in 1000 NOK</span></h3>
                  <div>
                    {true && (
                      <div className="mt-4">
                        {(() => {
                          const lower = Math.min(derivedLower, uiMaxRevenue)
                          const upper = Math.min(derivedUpper, uiMaxRevenue)
                          const range = Math.max(1, uiMaxRevenue - uiMinRevenue)
                          const leftPct = ((lower - uiMinRevenue) / range) * 100
                          const widthPct = ((upper - lower) / range) * 100
                          return (
                            <div className="relative">
                              {/* Base track */}
                              <div className="h-1 bg-white/20 rounded" />
                              {/* Selected range fill */}
                              <div
                                className="absolute top-0 h-1 bg-white/40"
                                style={{ left: `${leftPct}%`, width: `${Math.max(0, widthPct)}%` }}
                              />
                              {/* Two thumbs overlaid, using ghost track to hide native track */}
                              <input
                                type="range"
                                min={uiMinRevenue}
                                max={uiMaxRevenue}
                                step={1000}
                                value={lower}
                                onChange={(e) => {
                                  const n = Math.min(Math.max(Number(e.target.value), uiMinRevenue), uiMaxRevenue)
                                  const minVal = revenueMin === '' ? uiMinRevenue : revenueMin
                                  const maxVal = revenueMax === '' ? uiMaxRevenue : revenueMax
                                  const lowerIsMin = minVal <= maxVal
                                  if (lowerIsMin) setRevenueMin(n)
                                  else setRevenueMax(n)
                                }}
                                className="absolute inset-0 w-full slider-square slider-ghost"
                                aria-label="Minimum revenue"
                              />
                              <input
                                type="range"
                                min={uiMinRevenue}
                                max={uiMaxRevenue}
                                step={1000}
                                value={upper}
                                onChange={(e) => {
                                  const n = Math.min(Math.max(Number(e.target.value), uiMinRevenue), uiMaxRevenue)
                                  const minVal = revenueMin === '' ? uiMinRevenue : revenueMin
                                  const maxVal = revenueMax === '' ? uiMaxRevenue : revenueMax
                                  const lowerIsMin = minVal <= maxVal
                                  if (lowerIsMin) setRevenueMax(n)
                                  else setRevenueMin(n)
                                }}
                                className="absolute inset-0 w-full slider-square slider-ghost"
                                aria-label="Maximum revenue"
                              />
                              <div className="flex justify-between items-center gap-4 mt-3">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={numberFormatter.format(Math.floor(lower / 1000))}
                                  onChange={(e) => {
                                    const text = (e.target.value || '').trim()
                                    const neg = text.startsWith('-')
                                    const digits = text.replace(/[^\d]/g, '')
                                    const thousands = digits.length === 0 ? 0 : Math.floor(Number(digits))
                                    const valueNok = Math.min(Math.max(thousands * 1000, uiMinRevenue), uiMaxRevenue)
                                    const minVal = revenueMin === '' ? uiMinRevenue : revenueMin
                                    const maxVal = revenueMax === '' ? uiMaxRevenue : revenueMax
                                    const lowerIsMin = minVal <= maxVal
                                    const finalVal = neg ? Math.max(-valueNok, uiMinRevenue) : valueNok
                                    if (lowerIsMin) setRevenueMin(finalVal)
                                    else setRevenueMax(finalVal)
                                  }}
                                  className="w-28 bg-transparent text-white placeholder-gray-500 px-0 py-2 border-0 border-b border-white/20 focus:outline-none focus:ring-0 focus:border-white/40 text-sm"
                                />
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={numberFormatter.format(Math.floor(upper / 1000))}
                                  onChange={(e) => {
                                    const text = (e.target.value || '').trim()
                                    const neg = text.startsWith('-')
                                    const digits = text.replace(/[^\d]/g, '')
                                    const thousands = digits.length === 0 ? Math.floor(uiMaxRevenue / 1000) : Math.floor(Number(digits))
                                    const valueNok = Math.min(Math.max(thousands * 1000, uiMinRevenue), uiMaxRevenue)
                                    const minVal = revenueMin === '' ? uiMinRevenue : revenueMin
                                    const maxVal = revenueMax === '' ? uiMaxRevenue : revenueMax
                                    const lowerIsMin = minVal <= maxVal
                                    const finalVal = neg ? Math.max(-valueNok, uiMinRevenue) : valueNok
                                    if (lowerIsMin) setRevenueMax(finalVal)
                                    else setRevenueMin(finalVal)
                                  }}
                                  className="w-28 bg-transparent text-white placeholder-gray-500 px-0 py-2 border-0 border-b border-white/20 focus:outline-none focus:ring-0 focus:border-white/40 text-sm"
                                />
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Operating results</h3>
                  <div>
                    <select value={operatingResults} onChange={(e) => setOperatingResults(e.target.value)} className="w-full px-4 py-3 bg-transparent text-white border border-white/10 focus:outline-none focus:ring-0 focus:border-white/40">
                      <option value="">Any</option>
                      <option value="profitable">Profitable</option>
                      <option value="loss">Loss-making</option>
                    </select>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Sort By</h3>
                  <div>
                    <select value={sortBy} onChange={(e) => {
                      const newValue = e.target.value
                      if ((newValue === 'scoreDesc' || newValue === 'scoreAsc') && selectedEventTypes.length === 0) {
                        setSortBy('updatedAt')
                      } else {
                        setSortBy(newValue)
                      }
                    }} className="w-full px-4 py-3 bg-transparent text-white border border-white/10 focus:outline-none focus:ring-0 focus:border-white/40">
                      <option value="updatedAt">Last Updated</option>
                      <option value="name">Company Name</option>
                      <option value="revenue">Revenue (High to Low)</option>
                      <option value="employees">Employees (High to Low)</option>
                      <option value="scoreDesc" disabled={selectedEventTypes.length === 0} className={selectedEventTypes.length === 0 ? 'text-gray-500' : ''}>
                        Score (High to Low) {selectedEventTypes.length === 0 ? '(Select event types first)' : ''}
                      </option>
                      <option value="scoreAsc" disabled={selectedEventTypes.length === 0} className={selectedEventTypes.length === 0 ? 'text-gray-500' : ''}>
                        Score (Low to High) {selectedEventTypes.length === 0 ? '(Select event types first)' : ''}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
                <div className="text-lg text-gray-400">Loading businesses...</div>
              </div>
            </div>
          ) : sortedData.length === 0 ? (
            (() => {
              const hasAnyFilter = selectedIndustries.length > 0 || !!selectedRevenueRange || !!eventsFilter || selectedEventTypes.length > 0
              return (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="text-lg text-gray-400">{hasAnyFilter ? 'No companies match your current filters' : 'No businesses found'}</div>
                    {hasAnyFilter && (<div className="text-sm text-gray-500 mt-2">Try adjusting your filters to see more results</div>)}
                  </div>
                </div>
              )
            })()
          ) : (
            <div className="mt-4 border-t border-white/10 divide-y divide-white/10">
              {sortedData.map((business) => {
                const org = business.orgNumber
                const isWatched = watchlist.has(org)
                return (
                  <BusinessCard
                    key={org}
                    business={{ ...business, hasEvents: eventsFilter === 'with' ? true : business.hasEvents }}
                    numberFormatter={numberFormatter}
                    selectedEventTypes={selectedEventTypes}
                    eventWeights={eventWeights}
                    isWatched={isWatched}
                    onToggle={() => (isWatched ? removeWatch(org) : addWatch(org))}
                  />
                )
              })}
            </div>
          )}
          {(() => {
            const hasAnyFilter = selectedIndustries.length > 0 || !!selectedRevenueRange || !!eventsFilter || selectedEventTypes.length > 0
            const totalForPaging = hasAnyFilter ? total : (grandTotal ?? total)
            return (
              <div className="mt-8 flex items-center justify-between gap-4">
                <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="px-4 py-2 border border-white/10 bg-gray-900 hover:bg-gray-800 text-sm">Go to top</button>
                {data.length < totalForPaging && (
                  <button onClick={() => setOffset((prev) => prev + 100)} className="ml-auto px-4 py-2 border border-white/10 bg-gray-900 hover:bg-gray-800 text-sm">Load more</button>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}


