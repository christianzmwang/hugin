'use client'

import { useEffect, useMemo, useRef, useState, memo } from 'react'
import { createPortal } from 'react-dom'

const numberFormatter = new Intl.NumberFormat('no-NO')

function useDebounce<T>(value: T, delay = 100) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function formatEventDate(dateString: string | null | undefined): string {
  if (!dateString) return ''
  
  // Check if it's just a year (4 digits)
  if (/^\d{4}$/.test(dateString.trim())) {
    return dateString.trim()
  }
  
  // Try to parse as a regular date
  try {
    const date = new Date(dateString)
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      // If parsing failed, return the original string
      return dateString
    }
    return date.toLocaleDateString()
  } catch {
    // If any error occurs, return the original string
    return dateString
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
  // events
  hasEvents?: boolean | null
  eventScore?: number | null
  eventWeightedScore?: number | null
  // recommendation, rationale and score removed
}

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

// Memoized business card component for better performance
const BusinessCard = memo(
  ({
    business,
    numberFormatter,
  selectedEventTypes,
  eventWeights,
  }: {
    business: Business
    numberFormatter: Intl.NumberFormat
  selectedEventTypes: string[]
  eventWeights: Record<string, number>
  }) => {
    const fmt = (v: number | string | null | undefined) =>
      v === null || v === undefined ? '—' : numberFormatter.format(Number(v))

    // Lazy-load events: only when company has events AND the card is in view
  const [events, setEvents] = useState<EventItem[] | null>(null)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<unknown>(null)
    const [showAllEvents, setShowAllEvents] = useState(false)
    const [expandedTitleKeys, setExpandedTitleKeys] = useState<Set<string>>(new Set())
    const [expandedDescKeys, setExpandedDescKeys] = useState<Set<string>>(new Set())
    const cardRef = useRef<HTMLDivElement | null>(null)
    const [isInView, setIsInView] = useState(false)

    // Observe visibility for better performance
    useEffect(() => {
      const el = cardRef.current
      if (!el) return
      const obs = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setIsInView(true)
              // Once visible, we can stop observing this element
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
    
    // Load all events when card is visible
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
          const json = (await res.json()) as
            | { items?: EventItem[] }
            | EventItem[]
          const items = Array.isArray(json) ? json : json.items || []
          const filtered =
            selectedEventTypes && selectedEventTypes.length > 0
              ? (items || []).filter(
                  (it) => !!it && !!it.source && selectedEventTypes.includes(it.source as string),
                )
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
      // fire-and-forget
      load()
      return () => {
        cancelled = true
      }
    }, [business.orgNumber, business.hasEvents, selectedEventTypes, isInView])

    // Use backend-calculated weighted score
    const companyScore = useMemo(() => {
      // If no event types selected, show 0
      if (!selectedEventTypes || selectedEventTypes.length === 0) return 0
      
      // Use the backend-calculated eventWeightedScore when available
      const backendScore = business.eventWeightedScore
      if (typeof backendScore === 'number') {
        return backendScore
      }
      
      // Fallback to eventScore if no weighted score available
      const fallbackScore = business.eventScore
      if (typeof fallbackScore === 'number') {
        return fallbackScore
      }
      
      return 0
    }, [business.eventWeightedScore, business.eventScore, selectedEventTypes])

    return (
  <div ref={cardRef} className={
        'border p-6 transition-all hover:shadow-lg border-purple-500/40 bg-gray-900 hover:bg-gray-800'
      }>
  <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold mb-2">{business.name}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
              <div>
                <div className="mb-2">
                  <span className="font-medium">Org:</span> {business.orgNumber}
                </div>
                <div className="mb-2">
                  <span className="font-medium">CEO:</span>{' '}
                  {business.ceo || '—'}
                </div>
                <div className="mb-2">
                  <span className="font-medium">Employees:</span>{' '}
                  {business.employees ?? '—'}
                </div>
                <div className="mb-2">
                  <span className="font-medium">Revenue:</span>{' '}
                  {business.revenue == null
                    ? '—'
                    : `${fmt(business.revenue)}${business.fiscalYear ? ` (FY ${business.fiscalYear})` : ''}`}
                </div>
              </div>
              <div>
                <div className="mb-2">
                  <span className="font-medium">Address:</span>{' '}
                  {[
                    business.addressStreet,
                    business.addressPostalCode,
                    business.addressCity,
                  ]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </div>
                <div className="mb-2">
                  <span className="font-medium">Website:</span>{' '}
                  {business.website ? (
                    <a
                      className="text-sky-400 underline hover:text-sky-300"
                      href={business.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {business.website}
                    </a>
                  ) : (
                    '—'
                  )}
                </div>
                <div className="mb-2">
                  <span className="font-medium">Industry:</span>{' '}
                  {business.industryCode1
                    ? `${business.industryCode1} ${business.industryText1 || ''}`.trim()
                    : '—'}
                </div>
                <div className="mb-2">
                  <span className="font-medium">Sector:</span>{' '}
                  {business.sectorCode
                    ? `${business.sectorCode} ${business.sectorText || ''}`.trim()
                    : '—'}
                </div>
              </div>
            </div>
          </div>
          <div className="ml-6 flex flex-col items-end gap-3">
            {(() => {
              // Always show consistent spacing/layout regardless of events
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
                <span
                  className={`${color} text-sm font-medium`}
                  title="Weighted score from selected event types"
                >
                  {numberFormatter.format(companyScore)}
                </span>
              )
            })()}
          </div>
        </div>

        {/* Events section - always shown for consistent styling */}
        <div className="mt-4 border-t border-white/10 pt-4">
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
                <li
                  key={(ev.id ?? idx) as React.Key}
                  className="text-sm text-gray-200"
                >
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
                                <button
                                  className="text-sky-400 hover:text-sky-300 underline text-xs"
                                  style={{ display: 'inline-block' }}
                                  onClick={() =>
                                    setExpandedTitleKeys((prev) => {
                                      const next = new Set(prev)
                                      next.delete(key)
                                      return next
                                    })
                                  }
                                >
                                  Less
                                </button>
                              </>
                            )
                          }
                          return (
                            <>
                              {fullTitle.slice(0, limit)}…{' '}
                              <button
                                className="text-sky-400 hover:text-sky-300 underline text-xs"
                                style={{ display: 'inline-block' }}
                                onClick={() =>
                                  setExpandedTitleKeys((prev) => new Set(prev).add(key))
                                }
                              >
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
                                  <button
                                    className="text-sky-400 hover:text-sky-300 underline"
                                    style={{ display: 'inline-block' }}
                                    onClick={() => {
                                      setExpandedDescKeys((prev) => {
                                        const next = new Set(prev)
                                        next.delete(key)
                                        return next
                                      })
                                    }}
                                  >
                                    Less
                                  </button>
                                </>
                              )
                            }
                            return (
                              <>
                                {full.slice(0, limit)}…{' '}
                                <button
                                  className="text-sky-400 hover:text-sky-300 underline"
                                  style={{ display: 'inline-block' }}
                                  onClick={() => {
                                    setExpandedDescKeys((prev) => new Set(prev).add(key))
                                  }}
                                >
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
                            const s = (ev.source as string) || ''
                            const t = s.replace(/_/g, ' ')
                            const label = t.charAt(0).toUpperCase() + t.slice(1)
                            const weight = eventWeights[s] ?? 0
                            const badgeColor = weight > 0 
                              ? 'border-green-500 bg-green-500/20 text-green-200 hover:bg-green-500/30'
                              : weight < 0 
                                ? 'border-red-500 bg-red-500/20 text-red-200 hover:bg-red-500/30'
                                : 'border-white/30 bg-white/5 text-gray-200 hover:bg-white/10'
                            return (
                              <span
                                className={`inline-block px-2 py-1 text-[11px] leading-none border ${badgeColor}`}
                                title={label}
                                aria-label={label}
                              >
                                {label}
                              </span>
                            )
                          })()}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {ev.url && (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-sky-400 hover:text-sky-300 underline"
                    >
                      Source
                    </a>
                  )}
                </li>
              ))}
            </ul>
              {!!events && events.length > 1 && (
                <div className="mt-2">
                  {!showAllEvents ? (
                    <button
                      className="text-xs text-sky-400 hover:text-sky-300 underline"
                      onClick={() => setShowAllEvents(true)}
                    >
                      Show {events.length - 1} more
                    </button>
                  ) : (
                    <button
                      className="text-xs text-sky-400 hover:text-sky-300 underline"
                      onClick={() => {
                        setShowAllEvents(false)
                        setExpandedTitleKeys(new Set())
                        setExpandedDescKeys(new Set())
                      }}
                    >
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

export default function BrregPage() {
  const [data, setData] = useState<Business[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [grandTotal, setGrandTotal] = useState<number | null>(null)
  const [, setCountPending] = useState<boolean>(false)
  const [industryQuery, setIndustryQuery] = useState('')
  const [selectedIndustries, setSelectedIndustries] = useState<
    SelectedIndustry[]
  >(() => {
    if (typeof window === 'undefined') return []
    const sp = new URLSearchParams(window.location.search)
    const inds = sp.getAll('industries')
    return inds.map((v) => ({ value: v, label: v }))
  })
  const [allIndustries, setAllIndustries] = useState<IndustryOpt[]>([])
  const [suggestions, setSuggestions] = useState<IndustryOpt[]>([])
  const [selectedRevenueRange, setSelectedRevenueRange] = useState<string>(
    () => {
      if (typeof window === 'undefined') return ''
      return (
        new URLSearchParams(window.location.search).get('revenueRange') || ''
      )
    },
  )
  const [eventsFilter, setEventsFilter] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('events') || ''
  })
  // Event type filtering & weighting
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
  // recommendation and score filters removed
  const selectedSource = 'general'
  const [sortBy, setSortBy] = useState<string>(() => {
    if (typeof window === 'undefined') return 'updatedAt'
    const v =
      new URLSearchParams(window.location.search).get('sortBy') || 'updatedAt'
    const allowed = new Set([
      'updatedAt',
      'name',
      'revenue',
      'employees',
      'scoreDesc',
      'scoreAsc',
    ])
    return allowed.has(v) ? v : 'updatedAt'
  })
  const [offset, setOffset] = useState<number>(0)
  const debouncedIndustry = useDebounce(industryQuery, 100)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const [dropdownRect, setDropdownRect] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  // Removed rationale expand/collapse state

  const queryParam = useMemo(() => {
    const sp = new URLSearchParams()
    selectedIndustries.forEach((si) => sp.append('industries', si.value))
    if (selectedRevenueRange) {
      sp.append('revenueRange', selectedRevenueRange)
    }
    if (eventsFilter) {
      sp.append('events', eventsFilter)
    }
    if (selectedEventTypes.length > 0) {
      sp.append('eventTypes', selectedEventTypes.join(','))
    }
    // Always send event weights when event types are selected, even if some weights are 0
    if (selectedEventTypes.length > 0) {
      sp.append('eventWeights', JSON.stringify(eventWeights))
    }
    // recommendation and score params removed
    sp.append('source', selectedSource)
    if (sortBy) {
      sp.append('sortBy', sortBy)
    }
    if (offset) {
      sp.append('offset', String(offset))
    }
    // On first page, show items fast and defer counting for better TTI
    if (offset === 0) {
      sp.append('skipCount', '1')
    }
    return sp.toString() ? `?${sp.toString()}` : ''
  }, [
    selectedIndustries,
    selectedRevenueRange,
    eventsFilter,
    selectedEventTypes,
    eventWeights,
    // removed recommendation and score dependencies
    sortBy,
    offset,
  ])

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
    setSelectedIndustries((prev) =>
      prev.filter((p) => p.value.toLowerCase() !== value.toLowerCase()),
    )
  }

  useEffect(() => {
    setLoading(true)
  // If we asked the server to skip the count, mark it as pending
  setCountPending(queryParam.includes('skipCount=1'))
    
    // Add random delay (2-4 seconds) when event weights are present
    const hasEventWeights = Object.keys(eventWeights).length > 0
    const delay = hasEventWeights ? Math.random() * 2000 + 2000 : 0 // 2000-4000ms
    
    const timeoutId = setTimeout(() => {
      fetch('/api/businesses' + queryParam)
      .then((r) => r.json())
      .then((res: BusinessesResponse | Business[]) => {
        if (Array.isArray(res)) {
          // Legacy shape
          setData((prev) => {
            if (offset > 0) {
              // Deduplicate by orgNumber when concatenating
              const combined = [...prev, ...res]
              const seen = new Set<string>()
              return combined.filter(business => {
                if (seen.has(business.orgNumber)) return false
                seen.add(business.orgNumber)
                return true
              })
            }
            return res
          })
          setTotal(res.length)
        } else {
          setData((prev) => {
            if (offset > 0) {
              // Deduplicate by orgNumber when concatenating
              const combined = [...prev, ...res.items]
              const seen = new Set<string>()
              return combined.filter(business => {
                if (seen.has(business.orgNumber)) return false
                seen.add(business.orgNumber)
                return true
              })
            }
            return res.items
          })
          // If server skipped count, keep current total for snappy UI
          if (typeof res.total === 'number' && res.total > 0)
            setTotal(res.total)
          if (typeof res.grandTotal === 'number') setGrandTotal(res.grandTotal)
        }
      })
      .finally(() => setLoading(false))
    }, delay)
    
    return () => clearTimeout(timeoutId)
  }, [queryParam, offset, eventWeights])

  // Background count refresh whenever we used skipCount (first page fast-path)
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

  // Auto-reset score sorting when no event types are selected
  useEffect(() => {
    if ((sortBy === 'scoreDesc' || sortBy === 'scoreAsc') && selectedEventTypes.length === 0) {
      setSortBy('updatedAt')
    }
  }, [sortBy, selectedEventTypes.length])

  // Reset pagination when filters or sorting change
  useEffect(() => {
    setOffset(0)
    setData([])
  }, [
    selectedIndustries,
    selectedRevenueRange,
    eventsFilter,
    selectedEventTypes,
    eventWeights,
    // removed recommendation and score
    sortBy,
  ])

  // Preload all industries on component mount for fast client-side filtering
  useEffect(() => {
    fetch('/api/industries')
      .then((r) => r.json())
      .then((rows: IndustryOpt[]) => {
        setAllIndustries(rows)
        setSuggestions(rows) // Show all initially
      })
      .catch(() => {
        setAllIndustries([])
        setSuggestions([])
      })
  }, [])

  // Load available event types on mount
  useEffect(() => {
    fetch('/api/events/types')
      .then((r) => r.json())
      .then((res: { items?: string[] }) => setAvailableEventTypes(res.items || []))
      .catch(() => setAvailableEventTypes([]))
  }, [])

  // Client-side filtering for instant results
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

    // Sort by relevance - exact matches first, then starts with, then contains
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

    setSuggestions(filtered.slice(0, 100)) // Show more options for better UX
  }, [debouncedIndustry, allIndustries])

  // Keep dropdown positioned to the input using a portal so layout below never shifts
  useEffect(() => {
    if (!dropdownOpen) return
    const updateRect = () => {
      const el = inputRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setDropdownRect({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      })
    }
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [dropdownOpen])

  // Close on outside click
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

  // Data is now sorted server-side, no need for client-side sorting
  const sortedData = data

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-black border-b border-white/10">
        <div className="py-4 px-6">
          <h1 className="text-xl font-bold">Allvitr / <span className='text-red-600'>Hugin</span></h1>
        </div>
      </div>

      <div className="flex">
  {/* Left Sidebar - Signals */}
  <div className="w-96 bg-black border-r border-white/10 min-h-screen p-6">
          <div className="sticky top-6">
            <h2 className="text-xl font-semibold mb-6">Signals</h2>

            {/* Recommendation and Score filters removed */}

            {/* Events Filter moved from top panel */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Events</label>
              <select
                value={eventsFilter}
                onChange={(e) => setEventsFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 text-white border border-white/10 focus:border-green-400 focus:ring-1 focus:ring-green-400"
              >
                <option value="">All companies</option>
                <option value="with">With events</option>
                <option value="without">Without events</option>
              </select>
              {eventsFilter && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-sm text-gray-400">Events filter:</span>
                  <span className="inline-flex items-center gap-2 bg-purple-600 px-3 py-1 text-sm">
                    <span className="font-medium">
                      {eventsFilter === 'with' ? 'With events' : 'Without events'}
                    </span>
                    <button
                      className="opacity-80 hover:opacity-100"
                      onClick={() => setEventsFilter('')}
                    >
                      ×
                    </button>
                  </span>
                </div>
              )}
              {/* Event types list with per-type weight and selection border */}
              <div className="mt-6">
                <label className="block text-sm font-medium mb-2">Event types</label>
                <div className="max-h-[28rem] overflow-auto space-y-3 pr-1">
                  {availableEventTypes.map((raw) => {
                    const t = raw
                    const selected = selectedEventTypes.includes(t)
                    const weight = eventWeights[t] ?? 0
                    const display = (t || '').replace(/_/g, ' ')
                    const displayCap = display.charAt(0).toUpperCase() + display.slice(1)
                    return (
                      <div
                        key={t}
                        className={`p-3 bg-gray-900 border ${
                          selected 
                            ? weight > 0 
                              ? 'border-green-500' 
                              : weight < 0 
                                ? 'border-red-500' 
                                : 'border-yellow-500'
                            : 'border-white/10'
                        }`}
                        onClick={() => {
                          setSelectedEventTypes((prev) =>
                            prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
                          )
                          // When deselecting, reset weight to 0
                          if (selected) {
                            setEventWeights((prev) => ({ ...prev, [t]: 0 }))
                          } else if (eventWeights[t] === undefined) {
                            setEventWeights((prev) => ({ ...prev, [t]: 0 }))
                          }
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm">{displayCap}</span>
                          <span className="text-xs text-gray-400">{weight}</span>
                        </div>
                        <input
                          type="range"
                          min={-10}
                          max={10}
                          step={1}
                          value={weight}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            setEventWeights((prev) => ({ ...prev, [t]: val }))
                            // moving the slider selects the event type if not already selected
                            if (!selectedEventTypes.includes(t)) {
                              setSelectedEventTypes((prev) => [...prev, t])
                            }
                          }}
                          className="w-full mt-3 slider-square"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Active Filters Display */}
            {/* Active filters section removed (only recommendation/score previously) */}

            {/* Results Count - Hidden per user request */}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6">
          {/* Top Panel - Industry & Revenue Filters */}
          <div className="mb-8 space-y-6">
            {/* Combined Industry & Revenue Filters */}
            <div className="bg-gray-900 border border-white/10 p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Industry Filter
                  </h3>
                  <div>
                    <input
                      type="text"
                      value={industryQuery}
                      onChange={(e) => setIndustryQuery(e.target.value)}
                      ref={inputRef}
                      onFocus={() => {
                        // Show all suggestions if no query, otherwise show filtered results
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
                            selectedIndustries[selectedIndustries.length - 1]
                              .value,
                          )
                        }
                      }}
                      placeholder="Type industry code or text..."
                      className="w-full px-4 py-3 bg-gray-900 text-white border border-white/10 focus:border-green-400 focus:ring-1 focus:ring-green-400"
                    />
                    {dropdownOpen &&
                      suggestions.length > 0 &&
                      dropdownRect &&
                      createPortal(
                        <div
                          ref={dropdownRef}
                          className="z-[9999] max-h-80 overflow-auto border border-white/10 bg-black text-white shadow-xl divide-y divide-white/10"
                          style={{
                            position: 'fixed',
                            top: dropdownRect.top,
                            left: dropdownRect.left,
                            width: dropdownRect.width,
                          }}
                        >
                          {/* Show count of available options */}
                          {industryQuery.trim() && (
                            <div className="px-4 py-2 text-xs text-gray-400 bg-gray-800 border-b border-white/10">
                              {suggestions.length} of {totalFilteredCount}{' '}
                              industries match &quot;{industryQuery}&quot;
                            </div>
                          )}
                          {!industryQuery.trim() &&
                            allIndustries.length > 0 && (
                              <div className="px-4 py-2 text-xs text-gray-400 bg-gray-800 border-b border-white/10">
                                {suggestions.length} of {allIndustries.length}{' '}
                                industries shown
                              </div>
                            )}
                          {suggestions.map((s, idx) => {
                            const label = [s.code, s.text]
                              .filter(Boolean)
                              .join(' – ')
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
                    {selectedIndustries.length > 0 && (
                      <div className="mt-4 flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-gray-400">
                          Filtering by:
                        </span>
                        {selectedIndustries.map((si) => (
                          <span
                            key={si.value}
                            className="inline-flex items-center gap-2 bg-green-600 px-3 py-1 text-sm"
                          >
                            <span className="font-medium">{si.label}</span>
                            <button
                              className="opacity-80 hover:opacity-100"
                              onClick={() => removeSelectedIndustry(si.value)}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <button
                          className="text-sm text-red-400 hover:text-red-300 underline"
                          onClick={() => {
                            setSelectedIndustries([])
                            setIndustryQuery('')
                          }}
                        >
                          clear all
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Revenue Filter</h3>
                  <div>
                    <select
                      value={selectedRevenueRange}
                      onChange={(e) => setSelectedRevenueRange(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-900 text-white border border-white/10 focus:border-green-400 focus:ring-1 focus:ring-green-400"
                    >
                      <option value="">All revenue ranges</option>
                      <option value="0-1M">0 - 1M NOK</option>
                      <option value="1M-10M">1M - 10M NOK</option>
                      <option value="10M-100M">10M - 100M NOK</option>
                      <option value="100M+">100M+ NOK</option>
                    </select>
                    {selectedRevenueRange && (
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-sm text-gray-400">
                          Revenue filter:
                        </span>
                        <span className="inline-flex items-center gap-2 bg-blue-600 px-3 py-1 text-sm">
                          <span className="font-medium">
                            {selectedRevenueRange === '0-1M'
                              ? '0 - 1M NOK'
                              : selectedRevenueRange === '1M-10M'
                                ? '1M - 10M NOK'
                                : selectedRevenueRange === '10M-100M'
                                  ? '10M - 100M NOK'
                                  : selectedRevenueRange === '100M+'
                                    ? '100M+ NOK'
                                    : selectedRevenueRange}
                          </span>
                          <button
                            className="opacity-80 hover:opacity-100"
                            onClick={() => setSelectedRevenueRange('')}
                          >
                            ×
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Sort By</h3>
                  <div>
                    <select
                      value={sortBy}
                      onChange={(e) => {
                        const newValue = e.target.value
                        // If trying to select score sorting but no event types selected, fallback to updatedAt
                        if ((newValue === 'scoreDesc' || newValue === 'scoreAsc') && selectedEventTypes.length === 0) {
                          setSortBy('updatedAt')
                        } else {
                          setSortBy(newValue)
                        }
                      }}
                      className="w-full px-4 py-3 bg-gray-900 text-white border border-white/10 focus:border-green-400 focus:ring-1 focus:ring-green-400"
                    >
                      <option value="updatedAt">Last Updated</option>
                      <option value="name">Company Name</option>
                      <option value="revenue">Revenue (High to Low)</option>
                      <option value="employees">Employees (High to Low)</option>
                      <option 
                        value="scoreDesc" 
                        disabled={selectedEventTypes.length === 0}
                        className={selectedEventTypes.length === 0 ? 'text-gray-500' : ''}
                      >
                        Score (High to Low) {selectedEventTypes.length === 0 ? '(Select event types first)' : ''}
                      </option>
                      <option 
                        value="scoreAsc" 
                        disabled={selectedEventTypes.length === 0}
                        className={selectedEventTypes.length === 0 ? 'text-gray-500' : ''}
                      >
                        Score (Low to High) {selectedEventTypes.length === 0 ? '(Select event types first)' : ''}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Business List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
                <div className="text-lg text-gray-400">
                  Loading businesses...
                </div>
              </div>
            </div>
          ) : sortedData.length === 0 ? (
            (() => {
              const hasAnyFilter =
                selectedIndustries.length > 0 ||
                !!selectedRevenueRange ||
                !!eventsFilter ||
                selectedEventTypes.length > 0
              
              return (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="text-lg text-gray-400">
                      {hasAnyFilter ? 'No companies match your current filters' : 'No businesses found'}
                    </div>
                    {hasAnyFilter && (
                      <div className="text-sm text-gray-500 mt-2">
                        Try adjusting your filters to see more results
                      </div>
                    )}
                  </div>
                </div>
              )
            })()
          ) : (
            <div className="space-y-4">
              {sortedData.map((business) => (
                <BusinessCard
                  key={business.orgNumber}
                  business={{
                    ...business,
                    // If filtering by 'with', hard-enable hasEvents to ensure UI loads them
                    hasEvents:
                      eventsFilter === 'with' ? true : business.hasEvents,
                  }}
                  numberFormatter={numberFormatter}
                  selectedEventTypes={selectedEventTypes}
                  eventWeights={eventWeights}
                />
              ))}
            </div>
          )}
          {(() => {
            const hasAnyFilter =
              selectedIndustries.length > 0 ||
              !!selectedRevenueRange ||
              !!eventsFilter ||
              selectedEventTypes.length > 0
            const totalForPaging = hasAnyFilter ? total : (grandTotal ?? total)
            return (
              <div className="mt-8 flex items-center justify-between gap-4">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-4 py-2 border border-white/10 bg-gray-900 hover:bg-gray-800 text-sm"
            >
              Go to top
            </button>
                {data.length < totalForPaging && (
              <button
                onClick={() => setOffset((prev) => prev + 100)}
                className="ml-auto px-4 py-2 border border-white/10 bg-gray-900 hover:bg-gray-800 text-sm"
              >
                Load more
              </button>
            )}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
