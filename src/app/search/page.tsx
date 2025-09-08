'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, ComponentType } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
// NOTE: Virtualized list (react-window) temporarily removed due to import export mismatch under Next 15 / React 19.
// If needed, reintroduce with a guarded dynamic import.

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

function formatDateEU(dateValue: unknown): string {
  if (dateValue == null) return ''
  try {
    if (typeof dateValue === 'string') {
      const trimmed = dateValue.trim()
      if (/^\d{4}$/.test(trimmed)) return trimmed
      const d = new Date(trimmed)
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
      }
      return trimmed
    }
    if (typeof dateValue === 'number') {
      const d = new Date(dateValue)
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
      }
      return String(dateValue)
    }
    if (dateValue instanceof Date) {
      if (!isNaN(dateValue.getTime())) {
        return dateValue.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
      }
      return ''
    }
    const d = new Date(String(dateValue))
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
    return String(dateValue)
  } catch {
    return ''
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
  registeredAtBrreg?: string | null
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

interface BusinessCardProps {
  business: Business
  numberFormatter: Intl.NumberFormat
  selectedEventTypes: string[]
  eventWeights: Record<string, number>
  isWatched: boolean
  onToggle: () => void
}
type BusinessCardModule = {
  BusinessCard?: ComponentType<BusinessCardProps>
  default: ComponentType<BusinessCardProps>
}
const BusinessCard = dynamic<BusinessCardProps>(
  () => import('@/components/search/BusinessCard').then((m: BusinessCardModule) => m.BusinessCard ?? m.default),
  { ssr: false, loading: () => <div className="py-6 -mx-4 px-4 first:border-t first:border-white/10"><div className="animate-pulse h-6 w-40 bg-white/10 mb-4" /><div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm"><div className="space-y-2"><div className="h-3 bg-white/10 w-24" /><div className="h-3 bg-white/10 w-36" /><div className="h-3 bg-white/10 w-28" /></div><div className="space-y-2"><div className="h-3 bg-white/10 w-24 ml-auto" /><div className="h-3 bg-white/10 w-20 ml-auto" /></div></div></div> }
)

export default function SearchPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
  const hasDbAccess = Boolean(session.user?.mainAccess)
  if (!hasDbAccess) {
  router.push('/noaccess')
      return
    }
  }, [session, status, router])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const [data, setData] = useState<Business[]>([])
  // Saved list integration removed: we only rely on query params for filters now.
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
  const [areaDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [areaDropdownOpen, setAreaDropdownOpen] = useState(false)
  // Area suggestions (UI consumption currently disabled)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  // Draft values for revenue inputs; only applied when clicking Apply
  const [draftRevenueMin, setDraftRevenueMin] = useState<string>('')
  const [draftRevenueMax, setDraftRevenueMax] = useState<string>('')
  const [selectedRevenueRange, setSelectedRevenueRange] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('revenueRange') || ''
  })
  // Revenue bounds (sliders hidden in current layout)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [maxRevenue, setMaxRevenue] = useState<number>(108070744000)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [minRevenue, setMinRevenue] = useState<number>(-1868256000)
  const [profitMin, setProfitMin] = useState<number | ''>(() => {
    if (typeof window === 'undefined') return ''
    const sp = new URLSearchParams(window.location.search)
    const v = sp.get('profitMin')
    const n = v == null ? NaN : Number(v)
    return Number.isFinite(n) ? Math.floor(n) : ''
  })
  const [profitMax, setProfitMax] = useState<number | ''>(() => {
    if (typeof window === 'undefined') return ''
    const sp = new URLSearchParams(window.location.search)
    const v = sp.get('profitMax')
    const n = v == null ? NaN : Number(v)
    return Number.isFinite(n) ? Math.floor(n) : ''
  })
  // Draft values for profit inputs; only applied when clicking Apply  
  const [draftProfitMin, setDraftProfitMin] = useState<string>('')
  const [draftProfitMax, setDraftProfitMax] = useState<string>('')
  // Profit bounds (sliders hidden in current layout)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [maxProfit, setMaxProfit] = useState<number>(0)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [minProfit, setMinProfit] = useState<number>(0)
  const [, setApiLoaded] = useState<boolean>(false)
  const [eventsFilter, setEventsFilter] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('events') || ''
  })
  const [availableEventTypes, setAvailableEventTypes] = useState<string[]>([])
  // Website tech filters
  const [hasWoo, setHasWoo] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const v = new URLSearchParams(window.location.search).get('webEcomWoocommerce')
    return ['1', 'true', 'yes'].includes(String(v).toLowerCase())
  })
  const [hasShopify, setHasShopify] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const v = new URLSearchParams(window.location.search).get('webCmsShopify')
    return ['1', 'true', 'yes'].includes(String(v).toLowerCase())
  })
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
  const [metricMode, setMetricMode] = useState<'revenue' | 'operating'>('revenue')
  const [sortBy, setSortBy] = useState<string>(() => {
    if (typeof window === 'undefined') return 'updatedAt'
    const v = new URLSearchParams(window.location.search).get('sortBy') || 'updatedAt'
  const allowed = new Set(['updatedAt', 'name', 'revenue', 'revenueAsc', 'employees', 'employeesAsc', 'scoreDesc', 'scoreAsc', 'registreringsdato'])
    return allowed.has(v) ? v : 'updatedAt'
  })
  const [offset, setOffset] = useState<number>(0)
  const debouncedIndustry = useDebounce(industryQuery, 100)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const eventsRef = useRef<HTMLDivElement>(null);
  const [isEventTypesCollapsed, setIsEventTypesCollapsed] = useState<boolean>(false)
  const [listName, setListName] = useState<string>('')
  // listId no longer used; filters are encoded directly in query params when link created.
  // Event types scroll state for fade overlays
  const eventTypesScrollRef = useRef<HTMLDivElement | null>(null)
  const [eventTypesScrollState, setEventTypesScrollState] = useState<{ atTop: boolean; atBottom: boolean }>({ atTop: true, atBottom: true })

  const updateEventTypesScrollState = () => {
    const el = eventTypesScrollRef.current
    if (!el) return
    const atTop = el.scrollTop <= 0
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
    setEventTypesScrollState((prev) => (prev.atTop === atTop && prev.atBottom === atBottom ? prev : { atTop, atBottom }))
  }

  // Removed list fetch & filtering.
  useEffect(() => {
    updateEventTypesScrollState()
  }, [availableEventTypes, isEventTypesCollapsed])

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

  // Keyword scanner moved to /sandbox

  // Use hardcoded revenue bounds for immediate loading


  // Only apply revenue filter if user has explicitly set values
  const hasRevenueFilter = revenueMin !== '' || revenueMax !== ''

  // Use hardcoded profit bounds for immediate loading


  // Only apply profit filter if user has explicitly set values
  const hasProfitFilter = profitMin !== '' || profitMax !== ''

  // Registration date filters (moved up so they are declared before queryParam useMemo)
  const [registrationFrom, setRegistrationFrom] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('registeredFrom') || ''
  })
  const [registrationTo, setRegistrationTo] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('registeredTo') || ''
  })

  const queryParam = useMemo(() => {
    const sp = new URLSearchParams()
    selectedIndustries.forEach((si) => sp.append('industries', si.value))
    selectedAreas.forEach((a) => sp.append('areas', a))
    if (committedGlobalSearch.trim()) sp.append('q', committedGlobalSearch.trim())
    if (hasRevenueFilter) {
      if (revenueMin !== '') sp.append('revenueMin', String(revenueMin))
      if (revenueMax !== '') sp.append('revenueMax', String(revenueMax))
    }
    if (hasProfitFilter) {
      if (profitMin !== '') sp.append('profitMin', String(profitMin))
      if (profitMax !== '') sp.append('profitMax', String(profitMax))
    }
    if (eventsFilter) sp.append('events', eventsFilter)
    if (hasWoo) sp.append('webEcomWoocommerce', '1')
    if (hasShopify) sp.append('webCmsShopify', '1')
    if (selectedEventTypes.length > 0) sp.append('eventTypes', selectedEventTypes.join(','))
    if (selectedEventTypes.length > 0) sp.append('eventWeights', JSON.stringify(eventWeights))
    sp.append('source', selectedSource)
  if (sortBy) sp.append('sortBy', sortBy)
    selectedCompanyTypes.forEach((t) => sp.append('orgFormCode', t))
    if (offset) sp.append('offset', String(offset))
    if (offset === 0) sp.append('skipCount', '1')
    if (registrationFrom) sp.append('registeredFrom', registrationFrom)
    if (registrationTo) sp.append('registeredTo', registrationTo)
  // listId not appended; filters alone reproduce list.
    return sp.toString() ? `?${sp.toString()}` : ''
  }, [
    selectedIndustries,
    selectedAreas,
    committedGlobalSearch,
    hasRevenueFilter,
    revenueMin,
    revenueMax,
    hasProfitFilter,
    profitMin,
    profitMax,
    eventsFilter,
    selectedEventTypes,
    eventWeights,
    sortBy,
    offset,
    selectedCompanyTypes,
    hasWoo,
    hasShopify,
    registrationFrom, // added: ensure date-from filter updates query
    registrationTo,   // added: ensure date-to filter updates query
  // listId removed
  ])

  // Keep browser URL in sync with active filters (without full reload)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const newUrl = queryParam ? `${window.location.pathname}${queryParam}` : window.location.pathname
    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, '', newUrl)
    }
  }, [queryParam])

  // One-time hydration of filter state from existing URL params (for SSR-safe guards that returned defaults).
  const [hydratedFromUrl, setHydratedFromUrl] = useState(false)
  useEffect(() => {
    if (hydratedFromUrl) return
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    let changed = false
    // Industries
    if (selectedIndustries.length === 0) {
      const inds = sp.getAll('industries').filter(Boolean)
      if (inds.length > 0) {
        setSelectedIndustries(inds.map(v => ({ value: v, label: v })))
        changed = true
      }
    }
    // Areas
    if (selectedAreas.length === 0) {
      const areas = sp.getAll('areas').filter(Boolean)
      if (areas.length > 0) { setSelectedAreas(areas); changed = true }
    }
    // Company types
    if (selectedCompanyTypes.length === 0) {
      const forms = sp.getAll('orgFormCode').filter(Boolean)
      if (forms.length > 0) { setSelectedCompanyTypes(forms); changed = true }
    }
    // Event types & weights
    if (selectedEventTypes.length === 0) {
      const evCsv = sp.get('eventTypes') || ''
      if (evCsv) {
        const evs = evCsv.split(',').map(s => s.trim()).filter(Boolean)
        if (evs.length > 0) { setSelectedEventTypes(evs); changed = true }
      }
    }
    if (Object.keys(eventWeights).length === 0) {
      const ew = sp.get('eventWeights')
      if (ew) {
        try { const parsed = JSON.parse(ew); if (parsed && typeof parsed === 'object') { setEventWeights(parsed); changed = true } } catch {}
      }
    }
    // Sort
    const sortParam = sp.get('sortBy')
    if (sortParam) {
      const allowed = new Set(['updatedAt', 'name', 'revenue', 'revenueAsc', 'employees', 'employeesAsc', 'scoreDesc', 'scoreAsc', 'registreringsdato'])
      if (allowed.has(sortParam) && sortParam !== sortBy) { setSortBy(sortParam); changed = true }
    }
    // Revenue / profit bounds
    const rMin = sp.get('revenueMin'); const rMax = sp.get('revenueMax')
    if (rMin && revenueMin === '') { const n = Number(rMin); if (Number.isFinite(n)) { setRevenueMin(Math.floor(n)); changed = true } }
    if (rMax && revenueMax === '') { const n = Number(rMax); if (Number.isFinite(n)) { setRevenueMax(Math.floor(n)); changed = true } }
    const pMin = sp.get('profitMin'); const pMax = sp.get('profitMax')
    if (pMin && profitMin === '') { const n = Number(pMin); if (Number.isFinite(n)) { setProfitMin(Math.floor(n)); changed = true } }
    if (pMax && profitMax === '') { const n = Number(pMax); if (Number.isFinite(n)) { setProfitMax(Math.floor(n)); changed = true } }
    // Registration dates
    const regFromP = sp.get('registeredFrom'); const regToP = sp.get('registeredTo')
    if (regFromP && !registrationFrom) { setRegistrationFrom(regFromP); changed = true }
    if (regToP && !registrationTo) { setRegistrationTo(regToP); changed = true }
    // Global search
    const qParam = sp.get('q')
    if (qParam && !committedGlobalSearch) { setGlobalSearch(qParam); setCommittedGlobalSearch(qParam); changed = true }
    // Events filter
    const evF = sp.get('events')
    if (evF && !eventsFilter) { setEventsFilter(evF); changed = true }
    // Tech flags
    if (sp.has('webEcomWoocommerce') && !hasWoo) { setHasWoo(true); changed = true }
    if (sp.has('webCmsShopify') && !hasShopify) { setHasShopify(true); changed = true }
    setHydratedFromUrl(true)
    if (changed) {
      // Reset offset so first fetch matches hydrated filters
      setOffset(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaveList = async () => {
    try {
      const name = (listName || '').trim()
      if (!name) {
        alert('Please enter a list name')
        return
      }
      // Remove pagination/count params so re-opening starts from first page with proper filters
      const cleanedQuery = (() => {
        const raw = (queryParam || '').replace(/^\?/, '')
        const sp = new URLSearchParams(raw)
        sp.delete('offset')
        sp.delete('skipCount')
        sp.delete('countOnly')
        return sp.toString() ? `?${sp.toString()}` : ''
      })()
      const orgNumbers = (data || []).map((b) => String(b.orgNumber || '').trim()).filter(Boolean)
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filterQuery: cleanedQuery, orgNumbers })
      })
      const json = await res.json().catch(() => ({} as any))
      if (res.ok && json?.id) {
        alert('Saved list successfully')
        setListName('')
      } else if (res.status === 503) {
        alert('Database not configured for saved lists')
      } else if (json?.error) {
        alert('Failed to save list: ' + json.error)
      } else {
        alert('Failed to save list')
      }
    } catch {
      alert('Failed to save list')
    }
  }

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
    const controller = new AbortController()
    fetch('/api/businesses' + queryParam, { signal: controller.signal })
      .then((r) => r.json())
      .then((res: BusinessesResponse | Business[]) => {
        if (controller.signal.aborted) return
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
      .catch(() => { /* swallow fetch abort or network errors */ })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
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
  }, [selectedIndustries, selectedAreas, revenueMin, revenueMax, profitMin, profitMax, eventsFilter, selectedEventTypes, eventWeights, sortBy, selectedCompanyTypes, hasWoo, hasShopify])

  // Keep draft inputs in sync with applied values
  useEffect(() => {
    setDraftRevenueMin(revenueMin === '' ? '' : String(Math.floor(Number(revenueMin) / 1000)))
    setDraftRevenueMax(revenueMax === '' ? '' : String(Math.floor(Number(revenueMax) / 1000)))
  }, [revenueMin, revenueMax])

  useEffect(() => {
    setDraftProfitMin(profitMin === '' ? '' : String(Math.floor(Number(profitMin) / 1000)))
    setDraftProfitMax(profitMax === '' ? '' : String(Math.floor(Number(profitMax) / 1000)))
  }, [profitMin, profitMax])

  // Fetch all financial bounds (revenue and profit) in a single optimized call
  // Only fetch when the component is actually mounted and visible (not just prefetched)
  useEffect(() => {
    if (pathname !== '/search') return
    if (typeof document === 'undefined') return
    let cancelled = false
    const fetchAllBounds = async () => {
      try {
        const res = await fetch('/api/businesses/bounds', { next: { revalidate: 900 } })
        const json = await res.json()
        if (cancelled) return
        const { maxRevenue: mxR, minRevenue: mnR, maxProfit: mxP, minProfit: mnP } = json || {}
        setMaxRevenue(Number.isFinite(mxR) ? Math.floor(mxR) : 0)
        setMinRevenue(Number.isFinite(mnR) ? Math.floor(mnR) : 0)
        setMaxProfit(Number.isFinite(mxP) ? Math.floor(mxP) : 0)
        setMinProfit(Number.isFinite(mnP) ? Math.floor(mnP) : 0)
        setApiLoaded(true)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch financial bounds:', error)
          setMaxRevenue(0); setMinRevenue(0); setMaxProfit(0); setMinProfit(0); setApiLoaded(true)
        }
      }
    }
    const timeoutId = setTimeout(fetchAllBounds, 80)
    return () => { cancelled = true; clearTimeout(timeoutId) }
  }, [pathname])

  // Back-compat: map revenueRange buckets from URL into min/max if provided and min/max are empty
  useEffect(() => {
    if (!selectedRevenueRange) return
    if (revenueMin !== '' || revenueMax !== '') return
    switch (selectedRevenueRange) {
      case '0-1M':
        setDraftRevenueMin('0'); setDraftRevenueMax('1000'); break
      case '1M-10M':
        setDraftRevenueMin('1000'); setDraftRevenueMax('10000'); break
      case '10M-100M':
        setDraftRevenueMin('10000'); setDraftRevenueMax('100000'); break
      case '100M+':
        setDraftRevenueMin('100000'); setDraftRevenueMax(''); break
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
              className="w-full bg-transparent text-white placeholder-gray-500 px-0 py-2 border-0 border-b border-white/20 focus:outline-none focus:ring-0 focus:border-red-600/90"
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
              className="w-full bg-transparent text-white placeholder-gray-500 px-0 py-2 border-0 border-b border-white/20 focus:outline-none focus:ring-0 focus:border-red-600/90"
            />
            <input
              type="text"
              value={areaQuery}
              onChange={(e) => setAreaQuery(e.target.value)}
              placeholder="Area filter"
              ref={areaInputRef}
              onFocus={() => {
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
              className="w-full bg-transparent text-white placeholder-gray-500 px-0 py-2 border-0 border-b border-white/20 focus:outline-none focus:ring-0 focus:border-red-600/90"
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
              className="w-full bg-transparent text-white placeholder-gray-500 px-0 py-2 border-0 border-b border-white/20 focus:outline-none focus:ring-0 focus:border-red-600/90"
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
          selectedCompanyTypes.length > 0 ||
          hasRevenueFilter ||
          hasProfitFilter ||
          !!eventsFilter ||
          hasShopify || hasWoo ||
          selectedEventTypes.length > 0
        if (!hasAnyAppliedFilter) return null
        const revenueLabel = `${revenueMin !== '' ? numberFormatter.format(Math.floor(revenueMin / 1000)) : 'Min'} - ${revenueMax !== '' ? numberFormatter.format(Math.floor(revenueMax / 1000)) : 'Max'} NOK`
        const profitLabel = `${profitMin !== '' ? numberFormatter.format(Math.floor(profitMin / 1000)) : 'Min'} - ${profitMax !== '' ? numberFormatter.format(Math.floor(profitMax / 1000)) : 'Max'} NOK`
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
              {hasShopify && (
                <span className="group inline-flex items-center gap-1 text-xs px-2 py-1 border border-white/10 text-white/90">
                  <span>Shopify</span>
                  <button
                    type="button"
                    title="Remove Shopify filter"
                    aria-label="Remove Shopify filter"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setHasShopify(false)}
                  >
                    ×
                  </button>
                </span>
              )}
              {hasWoo && (
                <span className="group inline-flex items-center gap-1 text-xs px-2 py-1 border border-white/10 text-white/90">
                  <span>WooCommerce</span>
                  <button
                    type="button"
                    title="Remove WooCommerce filter"
                    aria-label="Remove WooCommerce filter"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setHasWoo(false)}
                  >
                    ×
                  </button>
                </span>
              )}
              {hasRevenueFilter && (
                <span className="group inline-flex items-center gap-1 text-xs px-2 py-1 border border-white/20 text-white/90">
                  <span>Revenue: {revenueLabel}</span>
                  <button
                    type="button"
                    title="Remove revenue filter"
                    aria-label="Remove revenue filter"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { setRevenueMin(''); setRevenueMax(''); setSelectedRevenueRange(''); setDraftRevenueMin(''); setDraftRevenueMax('') }}
                  >
                    ×
                  </button>
                </span>
              )}
              {hasProfitFilter && (
                <span className="group inline-flex items-center gap-1 text-xs px-2 py-1 border border-white/20 text-white/90">
                  <span>Operating results: {profitLabel}</span>
                  <button
                    type="button"
                    title="Remove operating results filter"
                    aria-label="Remove operating results filter"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { setProfitMin(''); setProfitMax(''); setDraftProfitMin(''); setDraftProfitMax('') }}
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
                className="ml-2 text-xs px-2 py-1 border border-white/20 text-white/90 bg-red-600/10 hover:bg-red-600/20 hover:border-red-600/60 focus:outline-none focus:ring-1 focus:ring-red-600/40"
                onClick={() => {
                  setSelectedIndustries([])
                  setIndustryQuery('')
                  setSelectedAreas([])
                  setAreaQuery('')
                  setSelectedCompanyTypes([])
                  setCompanyTypeQuery('')
                  setHasShopify(false)
                  setHasWoo(false)
                  setRevenueMin('')
                  setRevenueMax('')
                  setDraftRevenueMin('')
                  setDraftRevenueMax('')
                  setSelectedRevenueRange('')
                  setProfitMin('')
                  setProfitMax('')
                  setDraftProfitMin('')
                  setDraftProfitMax('')
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
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="List name"
                className="flex-1 min-w-0 bg-transparent text-white placeholder-gray-500 px-2 py-1 border border-white/10 focus:outline-none focus:ring-0 focus:border-red-600/90 text-xs"
              />
              <button
                type="button"
                onClick={handleSaveList}
                className="text-xs px-2 py-1 border border-white/10 hover:border-red-600/60 hover:bg-red-600/10"
                title="Save current results as a named list"
              >
                Save List
              </button>
            </div>
            <div className="sticky top-0 z-20 bg-black pb-2" ref={eventsRef}>
              <label className="block text-sm font-medium mb-2">Events</label>
              <select value={eventsFilter} onChange={(e) => setEventsFilter(e.target.value)} className="w-full px-3 py-2 bg-transparent text-white border border-white/10 focus:outline-none focus:ring-0 focus:border-red-600/90">
                <option value="">All companies</option>
                <option value="with">With events</option>
                <option value="without">Without events</option>
              </select>
            
            </div>
            <div className="mt-6">
              <div className="sticky top-[var(--events-height)] z-10 bg-black pb-2 flex items-center justify-between">
                <label className="block text-sm font-medium">Registration date</label>
              </div>
              <div className="flex items-center gap-3 w-full">
                <input
                  type="date"
                  value={registrationFrom}
                  onChange={(e) => setRegistrationFrom(e.target.value)}
                  className="flex-1 min-w-0 bg-black border border-white/10 text-xs px-2 py-1 text-white focus:outline-none focus:border-red-600/70"
                  placeholder="From"
                />
                <span className="text-gray-500 text-xs px-1 select-none">to</span>
                <input
                  type="date"
                  value={registrationTo}
                  onChange={(e) => setRegistrationTo(e.target.value)}
                  className="flex-1 min-w-0 bg-black border border-white/10 text-xs px-2 py-1 text-white focus:outline-none focus:border-red-600/70"
                  placeholder="To"
                />
                {(registrationFrom || registrationTo) && (
                  <button
                    type="button"
                    onClick={() => { setRegistrationFrom(''); setRegistrationTo('') }}
                    className="ml-2 shrink-0 text-[10px] px-2 py-1 border border-white/10 text-gray-300 hover:text-white hover:border-red-600/60"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {/* Website tech: moved directly below Registration date */}
            <div className="mt-6">
              <div className="sticky top-[var(--events-height)] z-10 bg-black pb-2 flex items-center justify-between">
                <label className="block text-sm font-medium">Website tech</label>
                {(hasShopify || hasWoo) && (
                  <button
                    type="button"
                    onClick={() => { setHasShopify(false); setHasWoo(false) }}
                    className="text-[10px] px-2 py-1 border border-white/20 text-gray-300 hover:text-white hover:border-red-600/60"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hasShopify}
                    onChange={(e) => setHasShopify(e.target.checked)}
                    className="checkbox-tech"
                  />
                  <span>Shopify</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hasWoo}
                    onChange={(e) => setHasWoo(e.target.checked)}
                    className="checkbox-tech"
                  />
                  <span>WooCommerce</span>
                </label>
              </div>
            </div>
            <div className="mt-6">
              <div className="sticky top-[var(--events-height)] z-10 bg-black pb-2 flex items-center justify-between">
                <label className="block text-sm font-medium">Event types</label>
                <button
                  type="button"
                  onClick={() => setIsEventTypesCollapsed(prev => !prev)}
                  className="text-xs px-2 py-1 border border-white/10 text-white/70 hover:text-white hover:border-red-600/60 hover:bg-red-600/10 focus:outline-none focus:ring-1 focus:ring-red-600/40"
                  aria-expanded={!isEventTypesCollapsed}
                >
                  {isEventTypesCollapsed ? 'Show' : 'Hide'}
                </button>
              </div>
              {!isEventTypesCollapsed && (
              <div className="relative">
                {/* Scrollable list */}
                <div
                  ref={eventTypesScrollRef}
                  onScroll={updateEventTypesScrollState}
                  className="space-y-3 h-96 overflow-y-auto custom-scroll thin-scroll w-full"
                >
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
                {/* Top fade */}
                {!eventTypesScrollState.atTop && (
                  <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black via-black/70 to-transparent" />
                )}
                {/* Bottom fade */}
                {!eventTypesScrollState.atBottom && (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black via-black/70 to-transparent" />
                )}
              </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 p-6">
          <div className="mb-8 space-y-6">
            <div className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-lg font-semibold">
                      {metricMode === 'revenue' ? 'Revenue' : 'Operating results'}
                      <span className="ml-2 text-xs text-gray-400 align-middle">in 1000 NOK</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-xl leading-none px-3 py-0.5 border border-white/10 text-white bg-transparent hover:bg-red-600/10 hover:border-red-600/60 focus:outline-none focus:ring-1 focus:ring-red-600/40"
                        title={metricMode === 'revenue' ? 'Switch to Operating results' : 'Switch to Revenue'}
                        onClick={() => setMetricMode((m) => (m === 'revenue' ? 'operating' : 'revenue'))}
                      >
                        ⇄
                      </button>
                      <button
                        type="button"
                        className="text-xs px-2 py-1 border border-white/10 text-white/90 bg-transparent hover:bg-red-600/10 hover:border-red-600/60 focus:outline-none focus:ring-1 focus:ring-red-600/40"
                        onClick={() => {
                          if (metricMode === 'revenue') {
                            const minVal = draftRevenueMin.trim() === '' ? '' : Number(draftRevenueMin.replace(/[^-\d]/g, '')) * 1000
                            const maxVal = draftRevenueMax.trim() === '' ? '' : Number(draftRevenueMax.replace(/[^-\d]/g, '')) * 1000
                            
                            // Validation: check if max is lower than min
                            if (minVal !== '' && maxVal !== '' && maxVal < minVal) {
                              alert('Maximum value cannot be lower than minimum value')
                              return
                            }
                            
                            setRevenueMin(minVal)
                            setRevenueMax(maxVal)
                            setSelectedRevenueRange('')
                            setOffset(0)
                          } else {
                            const minVal = draftProfitMin.trim() === '' ? '' : Number(draftProfitMin.replace(/[^-\d]/g, '')) * 1000
                            const maxVal = draftProfitMax.trim() === '' ? '' : Number(draftProfitMax.replace(/[^-\d]/g, '')) * 1000
                            
                            // Validation: check if max is lower than min
                           
                            
                            setProfitMin(minVal)
                            setProfitMax(maxVal)
                            setOffset(0)
                          }
 }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                  <div className="mt-4">
                    {(() => {
                      if (metricMode === 'revenue') {
                        return (
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Min"
                                value={draftRevenueMin}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^0-9-]/g, '')
                                  setDraftRevenueMin(value)
                                }}
                                className="w-full bg-transparent text-white placeholder-gray-500 px-0 py-2 border-0 border-b border-white/20 focus:outline-none focus:ring-0 focus:border-red-600/90 text-sm"
                              />
                            </div>
                            <div className="flex-1">
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Max"
                                value={draftRevenueMax}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^0-9-]/g, '')
                                  setDraftRevenueMax(value)
                                }}
                                className="w-full bgtransparent text-white placeholder-gray-500 px-0 py-2 border-0 border-b border-white/20 focus:outline-none focus:ring-0 focus:border-red-600/90 text-sm"
                              />
                            </div>
                          </div>
                        )
                      }
                      return (
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="Min"
                              value={draftProfitMin}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9-]/g, '')
                                setDraftProfitMin(value)
                              }}
                              className="w-full bg-transparent text-white placeholder-gray-500 px-0 py-2 border-0 border-b border-white/20 focus:outline-none focus:ring-0 focus:border-red-600/90 text-sm"
                            />
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="Max"
                              value={draftProfitMax}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9-]/g, '')
                                setDraftProfitMax(value)
                              }}
                              className="w-full bg-transparent text-white placeholder-gray-500 px-0 py-2 border-0 border-b border-white/20 focus:outline-none focus:ring-0 focus:border-red-600/90 text-sm"
                            />
                          </div>
                        </div>
                      )
                    })()}
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
                    }} className="w-full px-4 py-3 bg-transparent text-white border border-white/10 focus:outline-none focus:ring-0 focus:border-red-600/90">
                      <option value="updatedAt">Last Updated (New → Old)</option>
                      <option value="name">Company Name (A → Z)</option>
                      <option value="revenue">Revenue (High → Low)</option>
                      <option value="revenueAsc">Revenue (Low → High)</option>
                      <option value="employees">Employees (High → Low)</option>
                      <option value="employeesAsc">Employees (Low → High)</option>
                      <option value="registreringsdato">Registreringsdato (New → Old)</option>
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
          ) : data.length === 0 ? (
            (() => {
              const hasAnyFilter = selectedIndustries.length > 0 || !!selectedRevenueRange || !!eventsFilter || selectedEventTypes.length > 0 || hasShopify || hasWoo
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
            <div className="mt-4 divide-y divide-white/10">
              {data.map((business) => {
                const org = business.orgNumber
                const isWatched = watchlist.has(org)
                return (
                  <div key={org} className="relative">
                    <BusinessCard
                      business={{ ...business, hasEvents: eventsFilter === 'with' ? true : business.hasEvents }}
                      numberFormatter={numberFormatter}
                      selectedEventTypes={selectedEventTypes}
                      eventWeights={eventWeights}
                      isWatched={isWatched}
                      onToggle={() => (isWatched ? removeWatch(org) : addWatch(org))}
                    />
                  </div>
                )
              })}
            </div>
          )}
      {(() => {
            const hasAnyFilter = selectedIndustries.length > 0 || !!selectedRevenueRange || !!eventsFilter || selectedEventTypes.length > 0 || hasShopify || hasWoo
            const totalForPaging = hasAnyFilter ? total : (grandTotal ?? total)
            return (
              <div className="mt-8">
        {/* Hide Load more if list filter active and we've already loaded all list companies present in current batch */}
                {data.length < totalForPaging && (
                  <button onClick={() => setOffset((prev) => prev + 100)} className="w-full px-4 py-2 border border-white/10 hover:bg-red-600/10 hover:border-red-600/60 focus:outline-none focus:ring-1 focus:ring-red-600/40 text-sm transition-colors duration-200">Load more</button>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
