'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef, useCallback, useLayoutEffect, Suspense } from 'react'
import { useDashboardMode } from '@/components/DashboardThemeProvider'
// ParallelChat removed from inline usage; chat implemented directly in this page now
import { createPortal } from 'react-dom'

type Business = {
  orgNumber: string
  name: string
  website: string | null
  summary?: string | null
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
  orgFormCode?: string | null
  orgFormText?: string | null
  hasEvents?: boolean | null
  eventScore?: number | null
  eventWeightedScore?: number | null
  // Comprehensive financial data from Power Office
  operatingIncome?: string | number | null
  operatingResult?: string | number | null
  profitBeforeTax?: string | number | null
  valuta?: string | null
  fraDato?: string | null
  tilDato?: string | null
  sumDriftsinntekter?: string | number | null
  driftsresultat?: string | number | null
  aarsresultat?: string | number | null
  sumEiendeler?: string | number | null
  sumEgenkapital?: string | number | null
  sumGjeld?: string | number | null
  // Website analysis data
  webFinalUrl?: string | null
  webStatus?: number | null
  webElapsedMs?: number | null
  webIp?: string | null
  webTlsValid?: boolean | null
  webTlsNotAfter?: string | null
  webTlsDaysToExpiry?: number | null
  webTlsIssuer?: string | null
  webPrimaryCms?: string | null
  webCmsWordpress?: boolean | null
  webCmsDrupal?: boolean | null
  webCmsJoomla?: boolean | null
  webCmsTypo3?: boolean | null
  webCmsShopify?: boolean | null
  webCmsWix?: boolean | null
  webCmsSquarespace?: boolean | null
  webCmsWebflow?: boolean | null
  webCmsGhost?: boolean | null
  webCmsDuda?: boolean | null
  webCmsCraft?: boolean | null
  webEcomWoocommerce?: boolean | null
  webEcomMagento?: boolean | null
  webPayStripe?: boolean | null
  webPayPaypal?: boolean | null
  webPayKlarna?: boolean | null
  webAnalyticsGa4?: boolean | null
  webAnalyticsGtm?: boolean | null
  webAnalyticsUa?: boolean | null
  webAnalyticsFbPixel?: boolean | null
  webAnalyticsLinkedin?: boolean | null
  webAnalyticsHotjar?: boolean | null
  webAnalyticsHubspot?: boolean | null
  webJsReact?: boolean | null
  webJsVue?: boolean | null
  webJsAngular?: boolean | null
  webJsNextjs?: boolean | null
  webJsNuxt?: boolean | null
  webJsSvelte?: boolean | null
  webHasEmailText?: boolean | null
  webHasPhoneText?: boolean | null
  webHtmlKb?: number | null
  webHtmlKbOver500?: boolean | null
  webHeaderServer?: string | null
  webHeaderXPoweredBy?: string | null
  webSecurityHsts?: boolean | null
  webSecurityCsp?: boolean | null
  webCookiesPresent?: boolean | null
  webCdnHint?: string | null
  webServerHint?: string | null
  webRiskFlags?: string | null
  webErrors?: string | null
  webCmsWordpressHash?: string | null
  webRiskPlaceholderKw?: boolean | null
  webRiskParkedKw?: boolean | null
  webRiskSuspendedKw?: boolean | null
  registeredAtBrreg?: string | null
}

type EventItem = {
  id?: string | number
  title?: string | null
  description?: string | null
  date?: string | null
  url?: string | null
  source?: string | null
  score?: number | null
  orgNumber?: string | null
  businessName?: string | null
}

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

// Lightweight numeric formatter for NOK/financial values used in JSX (was referenced as fmt but not defined)
function fmt(v: unknown): string {
  if (v === null || v === undefined) return ''
  const num = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v.replace(/[^0-9,.-]/g, '').replace(/,(?=\d{3}\b)/g, '')) : NaN)
  if (!isFinite(num)) return String(v)
  try {
    // Use Norwegian formatting (fallback to default)
    return new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(num)
  } catch {
    return Number(num).toLocaleString()
  }
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
    const d = new Date(typeof dateValue === 'string' ? dateValue : String(dateValue))
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
    return String(dateValue)
  } catch {
    return ''
  }
}

// Render research text, converting bracketed citations like [1] and a final Sources list to links
function renderResearchWithLinks(text: string) {
  // Split into main content and sources section by common headers
  const parts = text.split(/\n+\s*(Sources|Kilder)\s*:?/i)
  let body = text
  let sourcesBlock = ''
  if (parts.length >= 3) {
    body = parts[0]
    sourcesBlock = parts.slice(2).join('\n') // capture after header
  }

  // Parse sources into a map: index -> url
  const sourceMap = new Map<number, { title?: string; url?: string }>()
  if (sourcesBlock) {
    const lines = sourcesBlock.split(/\n+/)
    for (const line of lines) {
      // Patterns like: [1] Title - https://example.com
      const m = line.match(/^\s*\[(\d+)\]\s*(.*?)\s*-\s*(https?:\/\/\S+)/i)
      if (m) {
        const idx = Number(m[1])
        sourceMap.set(idx, { title: m[2]?.trim(), url: m[3] })
        continue
      }
      // Or: 1. https://example.com
      const m2 = line.match(/^\s*(\d+)[\).]\s*(https?:\/\/\S+)/)
      if (m2) {
        const idx = Number(m2[1])
        sourceMap.set(idx, { url: m2[2] })
      }
    }
  }

  // Replace inline [n] with links if present in sourceMap
  const linkedBody = body.split(/(\[\d+\])/).map((chunk, i) => {
    const m = chunk.match(/^\[(\d+)\]$/)
    if (m) {
      const idx = Number(m[1])
      const src = sourceMap.get(idx)
      if (src?.url) {
        return (
          <a key={`cite-${i}`} href={src.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 underline">[{idx}]</a>
        )
      }
    }
    return <span key={`t-${i}`}>{chunk}</span>
  })

  return (
    <div>
      <div className="whitespace-pre-wrap">{linkedBody}</div>
      {sourceMap.size > 0 && (
        <div className="mt-4">
          <div className="text-sm text-gray-300 font-semibold mb-2">Kilder</div>
          <ul className="list-decimal list-inside space-y-1">
            {Array.from(sourceMap.entries()).map(([idx, meta]) => (
              <li key={idx}>
                {meta.url ? (
                  <a href={meta.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 underline">
                    {meta.title ? `${meta.title} — ${meta.url}` : meta.url}
                  </a>
                ) : (
                  <span>{meta.title || `[${idx}]`}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Remove AI chain-of-thought style paragraphs from free-form text
function stripChainOfThought(text: string): string {
  if (!text) return text
  // Keep the Sources/Kilder section intact; process body separately
  const parts = text.split(/\n+\s*(Sources|Kilder)\s*:?/i)
  let body = text
  let tailHeader = ''
  let tailRest = ''
  if (parts.length >= 3) {
    body = parts[0]
    tailHeader = parts[1]
    tailRest = parts.slice(2).join('\n')
  }
  // Heuristic: drop paragraphs that look like reflective reasoning/instructions
  const paras = body.split(/\n{2,}/)
  const keep: string[] = []
  const cotRe = new RegExp(
    [
      '(?:^|\\b)(?:i|we)\\s+(?:will|should|need to|am going to|think|guess|believe|decide|assess)\\b',
      "\\blet's\\b",
      '\\bokay,?\\b',
      '\\bnow,?\\b',
      '\\b(prompt|sample|translate|translation|target language|source language|detect the language|the user is asking)\\b',
      '\\bstep(?:s)?\\b',
      '\\bchain(?:-| )of(?:-| )thought\\b',
    ].join('|'),
    'i'
  )
  for (const p of paras) {
    const trimmed = p.trim()
    if (!trimmed) continue
    const hasCitation = /\[\d+\]/.test(trimmed)
    const hasUrl = /https?:\/\//i.test(trimmed)
    const looksLikeList = /^\s*[-•\d+\.]/m.test(trimmed)
    if (hasCitation || hasUrl || looksLikeList) {
      keep.push(trimmed)
      continue
    }
    if (cotRe.test(trimmed)) {
      continue
    }
    keep.push(trimmed)
  }
  const cleanedBody = keep.join('\n\n')
  return tailHeader ? `${cleanedBody}\n\n${tailHeader}\n${tailRest}`.trim() : cleanedBody
}

// Build a deduplicated list of citations from Parallel "basis" structure
function extractCitationsFromBasis(basis: unknown): Array<{ title?: string; url?: string }> {
  const out: Array<{ title?: string; url?: string }> = []
  const seen = new Set<string>()
  if (!basis || !Array.isArray(basis)) return out
  for (const b of basis as Array<unknown>) {
    const cites = (b as { citations?: unknown })?.citations as unknown
    if (!Array.isArray(cites)) continue
    for (const c of cites as Array<unknown>) {
      const url: string | undefined = (c as { url?: string })?.url
      if (url && !seen.has(url)) {
        seen.add(url)
        out.push({ title: (c as { title?: string })?.title, url })
      }
    }
  }
  return out
}

function renderResearchWithLinksAndBasis(text: string, basisCitations: Array<{ title?: string; url?: string }>) {
  const hasInlineBrackets = /\[\d+\]/.test(text)
  const hasSourcesHeader = /\n\s*(Sources|Kilder)\s*:?/i.test(text)
  const content = renderResearchWithLinks(text)
  if (hasInlineBrackets || hasSourcesHeader || !basisCitations?.length) return content
  // Append sources from basis if the text itself lacks citations and no sources section exists
  return (
    <div>
      {content}
      <div className="mt-4">
        <div className="text-sm text-gray-300 font-semibold mb-2">Kilder</div>
        <ul className="list-decimal list-inside space-y-1">
          {basisCitations.map((c, idx) => (
            <li key={c.url || `${idx}`}>
              {c.url ? (
                <a href={c.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 underline">
                  {c.title ? `${c.title} — ${c.url}` : c.url}
                </a>
              ) : (
                <span>{c.title || ''}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// Structured research object support for Compose/Parallel outputs
type StructuredResearch = {
  directAnswer?: string
  keyPoints?: string[]
  sources?: Array<{ title?: string; url?: string; accessed_at?: string }>
}

// Attempt to flatten various Parallel output.content shapes into a string
function extractStringFrom(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== 'object') return null
  const rec = obj as Record<string, unknown>
  for (const k of keys) {
    const v = rec[k]
    if (typeof v === 'string') return v
  }
  return null
}

function flattenParallelContent(val: unknown): string | null {
  if (val == null) return null
  if (typeof val === 'string') return val
  // Array of segments (strings or objects with text/content)
  if (Array.isArray(val)) {
    const parts = val.map(seg => {
      if (typeof seg === 'string') return seg
      if (seg && typeof seg === 'object') {
        const s = extractStringFrom(seg, ['text', 'content', 'value'])
        return typeof s === 'string' ? s : ''
      }
      return ''
    }).filter(Boolean)
    return parts.length ? parts.join('\n').trim() : null
  }
  if (typeof val === 'object') {
    const rec = val as Record<string, unknown>
    // Common shapes: { text }, { content: '...' }, { content: { text: '...' } }, { content: [ ...segments ] }
    if (typeof rec.text === 'string') return rec.text
    if (typeof rec.content === 'string') return rec.content
    if (Array.isArray(rec.content)) {
      const arr = flattenParallelContent(rec.content)
      if (arr) return arr
    }
    if (rec.content && typeof rec.content === 'object') {
      const nested = flattenParallelContent(rec.content)
      if (nested) return nested
    }
  }
  return null
}

function coerceStructuredResearch(input: unknown): StructuredResearch | null {
  try {
    let obj: unknown = input
    if (typeof input === 'string') {
      const trimmed = input.trim()
      if (!trimmed.startsWith('{')) return null
      obj = JSON.parse(trimmed) as unknown
    }
    if (!obj || typeof obj !== 'object') return null
    // Normalize common keys case-insensitively
    const lower: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) lower[String(k).toLowerCase()] = v as unknown
    const directAnswer = typeof lower['direct answer'] === 'string' ? lower['direct answer'] : undefined
    const keyPoints = Array.isArray(lower['key points']) ? (lower['key points'] as unknown[]).filter((x: unknown) => typeof x === 'string') as string[] : undefined
    const sources = Array.isArray(lower['sources'])
      ? (lower['sources'] as unknown[])
          .map((s: unknown) => {
            const ss = s as { title?: string; url?: string; accessed_at?: string }
            return { title: ss?.title, url: ss?.url, accessed_at: ss?.accessed_at }
          })
          .filter((s: { title?: string; url?: string }) => Boolean(s && (s.title || s.url)))
      : undefined
    if (!directAnswer && !keyPoints && !sources) return null
    return { directAnswer, keyPoints, sources }
  } catch {
    return null
  }
}

function renderStructuredResearch(data: StructuredResearch) {
  const { directAnswer, keyPoints, sources } = data
  const sourceMap = new Map<number, { title?: string; url?: string }>()
  if (Array.isArray(sources)) {
    sources.forEach((s, idx) => sourceMap.set(idx + 1, { title: s?.title, url: s?.url }))
  }
  const linkify = (text: string) =>
    text.split(/(\[\d+\])/).map((chunk, i) => {
      const m = chunk.match(/^\[(\d+)\]$/)
      if (m) {
        const idx = Number(m[1])
        const src = sourceMap.get(idx)
        if (src?.url) {
          return (
            <a key={`cite-s-${i}`} href={src.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 underline">[{idx}]</a>
          )
        }
      }
      return <span key={`s-${i}`}>{chunk}</span>
    })

  return (
    <div>
      {directAnswer && (
        <div className="mb-4 whitespace-pre-wrap">{linkify(directAnswer)}</div>
      )}
      {Array.isArray(keyPoints) && keyPoints.length > 0 && (
        <ul className="list-disc list-inside space-y-1">
          {keyPoints.map((kp, i) => (
            <li key={`kp-${i}`} className="whitespace-pre-wrap">{linkify(kp)}</li>
          ))}
        </ul>
      )}
      {Array.isArray(sources) && sources.length > 0 && (
        <div className="mt-4">
          <div className="text-sm text-gray-300 font-semibold mb-2">Kilder</div>
          <ul className="list-decimal list-inside space-y-1">
            {sources.map((s, idx) => (
              <li key={s.url || `${idx}`}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 underline">
                    {s.title ? `${s.title} — ${s.url}` : s.url}
                  </a>
                ) : (
                  <span>{s.title || ''}</span>
                )}
                {s.accessed_at ? <span className="text-xs text-gray-400 ml-2">({s.accessed_at})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function CompanyPageContent() {
  const { mode: themeMode } = useDashboardMode()
  const light = themeMode === 'light'
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [topCompany, setTopCompany] = useState<Business | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  // Parallel research state
  const [researchRunId, setResearchRunId] = useState<string | null>(null)
  const [researchStatus, setResearchStatus] = useState<'idle' | 'queued' | 'running' | 'completed' | 'error'>('idle')
  const [lastRunStatus, setLastRunStatus] = useState<string | null>(null)
  const [lastPollAt, setLastPollAt] = useState<number | null>(null)
  const [researchText, setResearchText] = useState<string>('')
  const [researchStructured, setResearchStructured] = useState<StructuredResearch | null>(null)
  const [translatedResearchText, setTranslatedResearchText] = useState<string>('')
  const [researchBasis, setResearchBasis] = useState<Array<{ title?: string; url?: string }>>([])
  const [researchError, setResearchError] = useState<string | null>(null)
  const pollTokenRef = useRef(0)
  const [processor, setProcessor] = useState<'lite' | 'base' | 'core' | 'pro' | 'ultra'>('base')
  // UI mode: deep research (default) vs chat
  // Default to 'chat' so users see chat first; they can switch to research via dropdown
  const [uiMode, setUiMode] = useState<'research' | 'chat'>('chat')
  const [procDropdownOpen, setProcDropdownOpen] = useState(false)
  const procDropdownRef = useRef<HTMLDivElement | null>(null)
  const procAnchorRef = useRef<HTMLDivElement | null>(null)
  // Close processor mode dropdown on outside click
  useEffect(() => {
    if (!procDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      const dropdown = procDropdownRef.current
      const anchor = procAnchorRef.current
      if (!dropdown || !anchor) return
      if (dropdown.contains(e.target as Node)) return
      if (anchor.contains(e.target as Node)) return
      setProcDropdownOpen(false)
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [procDropdownOpen])
  const procButtonsContainerRef = useRef<HTMLDivElement | null>(null)
  // Persisted processor group width to keep Chat button stable and avoid layout shift
  const PROC_FALLBACK_WIDTH = 220
  const [procGroupWidth, setProcGroupWidth] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const v = window.localStorage.getItem('procGroupWidth')
      if (v) {
        const n = parseInt(v, 10)
        if (Number.isFinite(n) && n > 50) return n
      }
    }
    return null
  })
  // Inline chat state (replaces ParallelChat component)
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([])
  const [chatInput, setChatInput] = useState('')
  const [chatStreaming, setChatStreaming] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const chatAbortRef = useRef<AbortController | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll chat when new messages or streaming updates arrive
  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [chatMessages, chatStreaming])

  // Ensure Chat label is visible on initial load when defaulting to chat
  // Chat animation removed; no typeout effect
  const [researchDotAnimClass, setResearchDotAnimClass] = useState('')
  const previousModeRef = useRef<'research' | 'chat'>(uiMode)
  const promptRef = useRef<HTMLTextAreaElement | null>(null)

  
  const makeId = () => Math.random().toString(36).slice(2, 10)
  const [customInput, setCustomInput] = useState<string>('')
  // Optional editable block describing the current company (replaces auto Company/Org/Website)
  const [companyInput, setCompanyInput] = useState<string>('')
  // Prompt describing the research request
  const [prompt, setPrompt] = useState<string>('')
  // Info line: ticks every 5s and tracks activity events
  // Tick counter (reserved for future live status; intentionally unused)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [infoTick, setInfoTick] = useState(0)
  // isTranslating removed
  const [isComposing, setIsComposing] = useState(false)
  // Track last manual edit time (currently not used in UI rendering)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [lastPromptEditAt, setLastPromptEditAt] = useState<number | null>(null)
  // Active output schema (designPrompt flow can update; not yet exposed in UI)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [outputSchema, setOutputSchema] = useState<string>(
    'Write a concise, decision-useful research brief on the company above.\n' +
    'Include: overview, products/services, customers and markets, competitive moat, risks, recent developments (last 12 months), notable partnerships, competition, and 3-6 actionable insights.\n' +
    'Keep it 8-14 bullet points, neutral tone. Use Norwegian if the company is Norwegian. Always include citations inline [n] and return a final Sources list.'
  )
  // Preset definitions (UI for selecting presets currently disabled)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const outputPresets: Array<{ key: string; label: string; value: string }> = [
    {
      key: 'brief_citations',
      label: 'Research brief (with [n] citations + Sources)',
      value:
        'Write a concise, decision-useful research brief on the company above.\n' +
        'Include: overview, products/services, customers and markets, competitive moat, risks, recent developments (last 12 months), notable partnerships, competition, and 3-6 actionable insights.\n' +
        'Keep it 8-14 bullet points, neutral tone. Use Norwegian if the company is Norwegian. Always include citations inline [n] and return a final Sources list.',
    },
    {
      key: 'well_structured_text',
      label: 'Well-structured text with citations',
      value: 'Answer the question in well-structured text with citations.',
    },
  ]
  // Selected output preset (preset switcher UI removed for now)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [outputPreset, setOutputPreset] = useState<string>('brief_citations')
  // Timing metrics
  const [researchStartedAt, setResearchStartedAt] = useState<number | null>(null)
  const [composeStartedAt, setComposeStartedAt] = useState<number | null>(null)
  const [composeMs, setComposeMs] = useState<number | null>(null)
  const [parallelStartedAt, setParallelStartedAt] = useState<number | null>(null)
  // Parallel execution timing (diagnostics only)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [parallelMs, setParallelMs] = useState<number | null>(null)
  

  const processorMeta: Record<string, { label: string; est: string; cost: string }> = {
    lite: { label: 'Lite', est: '5s–60s', cost: '$0.005' },
    base: { label: 'Base', est: '15s–100s', cost: '$0.01' },
    core: { label: 'Core', est: '60s–5m', cost: '$0.05' },
    pro: { label: 'Pro', est: '3–9m', cost: '$0.10' },
    ultra: { label: 'Ultra', est: '5–25m', cost: '$0.30' },
  }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [companySuggestions, setCompanySuggestions] = useState<Array<{ name: string; orgNumber: string }>>([])
  // Fast, anchored dropdown like Search page
  const companySearchRef = useRef<HTMLInputElement | null>(null)
  const companyDropdownRef = useRef<HTMLDivElement | null>(null)
  const [companyDropdownRect, setCompanyDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => setIsMounted(true), [])
  const [, setBusinessStats] = useState<{
    totalCompanies: number
    totalEvents: number
    companiesWithEvents: number
  } | null>(null)
  const [recentlyViewed, setRecentlyViewed] = useState<Array<{ name: string; orgNumber: string }>>([])
  const recentlyRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isHorizScrollable, setIsHorizScrollable] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragStateRef = useRef<{ startX: number; scrollLeft: number }>({ startX: 0, scrollLeft: 0 })
  const dragMovedRef = useRef(false)
  const momentumRef = useRef<{ raf: number | null; v: number; lastT: number | null } | null>(null)
  const moveSamplesRef = useRef<Array<{ t: number; pos: number }>>([])
  // Simplified scroll helpers (momentum implementation removed)
  const updateScrollButtons = useCallback(() => {
    const el = recentlyRef.current
    if (!el) { setCanScrollLeft(false); setCanScrollRight(false); setIsHorizScrollable(false); return }
    const maxScroll = el.scrollWidth - el.clientWidth
    setIsHorizScrollable(maxScroll > 0)
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft < maxScroll - 1)
  }, [])
  const cancelMomentum = useCallback(() => {
    if (momentumRef.current?.raf) cancelAnimationFrame(momentumRef.current.raf)
    momentumRef.current = null
  }, [])
  const startMomentum = useCallback((_v: number) => { /* disabled */ }, [])
  
  // Remove unused tab state for organizing the top section
  // const [activeTab, setActiveTab] = useState<'search' | 'recent'>('search')

  const autoResizePrompt = useCallback(() => {
    const el = promptRef.current
    if (!el) return
    el.style.height = 'auto'
    const h = el.scrollHeight
    el.style.height = h + 'px'
  }, [])

  useEffect(() => {
    autoResizePrompt()
  }, [prompt, autoResizePrompt])

  useEffect(() => {
    if (previousModeRef.current !== uiMode) {
      if (uiMode === 'research') {
        setResearchDotAnimClass('dot-cascade-enter')
      } else {
        setResearchDotAnimClass('dot-cascade-exit')
      }
      previousModeRef.current = uiMode
    }
  }, [uiMode])

  // Removed legacy momentum scroll effect (was referencing undefined vars after cleanup).
  useLayoutEffect(() => {
    // No-op placeholder; keep hook order stable.
    return () => { /* noop */ }
  }, [])

  useEffect(() => {
    // Recompute when list changes and on resize/scroll
    const el = recentlyRef.current
    if (!el) return
    updateScrollButtons()
    const onScroll = () => updateScrollButtons()
    el.addEventListener('scroll', onScroll, { passive: true })
    // Cancel momentum on wheel input
    const onWheel = () => cancelMomentum()
    el.addEventListener('wheel', onWheel, { passive: true })
    const onResize = () => updateScrollButtons()
    window.addEventListener('resize', onResize)
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', onResize)
    }
  }, [recentlyViewed.length, updateScrollButtons, cancelMomentum])

  // Ensure initial measurement right after layout/paint when recentlyViewed changes
  useEffect(() => {
    let raf = 0 as number | undefined as unknown as number
    raf = requestAnimationFrame(() => {
      updateScrollButtons()
    })
    return () => cancelAnimationFrame(raf)
  }, [recentlyViewed.length, updateScrollButtons])

  const handleDragStart = (clientX: number) => {
    const el = recentlyRef.current
    if (!el) return
    cancelMomentum() // any new interaction cancels momentum
    setIsDragging(true)
    dragStateRef.current = { startX: clientX, scrollLeft: el.scrollLeft }
    dragMovedRef.current = false
    // initialize velocity samples
    moveSamplesRef.current = [{ t: performance.now(), pos: el.scrollLeft }]
  }

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging) return
    const el = recentlyRef.current
    if (!el) return
    const dx = clientX - dragStateRef.current.startX
    if (Math.abs(dx) > 5) dragMovedRef.current = true
    el.scrollLeft = dragStateRef.current.scrollLeft - dx
    updateScrollButtons()
    // record sample for velocity
    const now = performance.now()
    moveSamplesRef.current.push({ t: now, pos: el.scrollLeft })
    const cutoff = now - 200
    while (moveSamplesRef.current.length > 2 && moveSamplesRef.current[0].t < cutoff) {
      moveSamplesRef.current.shift()
    }
  }, [isDragging, updateScrollButtons])

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    // compute fling velocity from recent samples (weighted over last 120-200ms)
    const samples = moveSamplesRef.current
    if (samples.length >= 2) {
      const last = samples[samples.length - 1]
      const minWindow = 120
      let i = samples.length - 2
      while (i > 0 && last.t - samples[i].t < minWindow) i--
      const start = Math.max(0, i)
      let sumW = 0
      let sumV = 0
      for (let j = start; j < samples.length - 1; j++) {
        const a = samples[j]
        const b = samples[j + 1]
        const dt = Math.max(1, b.t - a.t)
        const vSeg = (b.pos - a.pos) / dt
        // weight recent segments higher
        const w = 1 + (a.t - samples[start].t) / Math.max(1, last.t - samples[start].t)
        sumW += w
        sumV += vSeg * w
      }
      const v = sumW > 0 ? sumV / sumW : 0
      if (dragMovedRef.current && Math.abs(v) > 0.2) {
        startMomentum(v)
      }
    }
    // small delay before enabling click again
    setTimeout(() => { dragMovedRef.current = false }, 120)
  }, [isDragging, startMomentum])

  useEffect(() => {
    // While dragging, track movement and end events at window level
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX)
    const onMouseUp = () => handleDragEnd()
    const onTouchMove = (e: TouchEvent) => {
      const x = e.touches[0]?.clientX ?? 0
      handleDragMove(x)
    }
    const onTouchEnd = () => handleDragEnd()

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      window.addEventListener('touchmove', onTouchMove, { passive: true })
      window.addEventListener('touchend', onTouchEnd)

      // Prevent text selection and set grabbing cursor globally
      const prevUserSelect = document.body.style.userSelect
      const prevCursor = document.body.style.cursor
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'

      return () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend', onTouchEnd)
        document.body.style.userSelect = prevUserSelect
        document.body.style.cursor = prevCursor
      }
    }
    return () => {}
  }, [isDragging, handleDragMove, handleDragEnd])

  const scrollByAmount = (delta: number) => {
    const el = recentlyRef.current
    if (!el) return
    cancelMomentum()
    el.scrollBy({ left: delta, behavior: 'smooth' })
  }

  // Load recently viewed companies (local only; DB integration removed)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recentlyViewedCompanies')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          // Basic validation + trim to 20
          const items = parsed
            .filter((c: unknown): c is Record<string, unknown> => !!c && typeof c === 'object')
            .filter((c) => typeof c.orgNumber === 'string')
            .map((c) => ({ name: String((c.name as unknown) || ''), orgNumber: String(c.orgNumber as string) }))
            .slice(0, 20)
          setRecentlyViewed(items)
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }, [])

  // Add company to recently viewed (localStorage only now)
  const addToRecentlyViewed = (company: { name: string; orgNumber: string }) => {
    setRecentlyViewed(prev => {
      const filtered = prev.filter(c => c.orgNumber !== company.orgNumber)
      const updated = [company, ...filtered].slice(0, 20)
      try { localStorage.setItem('recentlyViewedCompanies', JSON.stringify(updated)) } catch {}
      return updated
    })
  }

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
  }, [status, session, router])

  const sendChat = useCallback(async () => {
    if (chatStreaming || !chatInput.trim()) return
    setChatError(null)
    const userMsg = { id: makeId(), role: 'user' as const, content: chatInput.trim() }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    const assistantId = makeId()
    setChatMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])
    setChatStreaming(true)
    const ctl = new AbortController()
    chatAbortRef.current = ctl
    try {
      const systemPrompt = [
        'Answer concisely (Norwegian if the user writes Norwegian; otherwise mirror their language).',
        'Do not include or infer any specific company identifying details unless the user explicitly provides them in their own message.',
        'Interpret terse or ambiguous queries generically. If the user later specifies a company or additional context, adapt accordingly.',
        'If the user asks for something you cannot answer from their explicit input, say you do not know rather than guessing.',
        'Do not fabricate or over‑elaborate. Be direct and only rely on what the user has supplied.',
      ].join('\n\n')
      // Build contextual prefix describing the visible company and the user's organization (from configuration/business context)
      const contextLines: string[] = []
      if (topCompany?.name) {
        contextLines.push(`Target company: ${topCompany.name}${topCompany.orgNumber ? ` (Org ${topCompany.orgNumber})` : ''}`)
        if (topCompany.website) contextLines.push(`Company website: ${topCompany.website}`)
      }
      if (customInput.trim()) {
        // Derive a compact single-line representation from customInput (company profile)
        const rawProfile = customInput.trim().split(/\n+/).map(l => l.trim()).filter(Boolean)
        const profileSummary = rawProfile.slice(0, 3).join(' | ').slice(0, 300)
        contextLines.push(`User represents: ${profileSummary}`)
      }
      const contextualPrefix = contextLines.length ? contextLines.join('\n') + '\n\n' : ''
      const augmentedUserContent = contextualPrefix + userMsg.content
      const payload = {
        model: 'speed',
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt + '\n\nAvoid assuming any specific company; only use identifiers the user provides explicitly.' },
          ...chatMessages.filter(m => m.content.trim()),
          { role: 'user', content: augmentedUserContent },
        ],
      }
      const res = await fetch('/api/parallel/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctl.signal,
      })
      if (!res.ok || !res.body) throw new Error(`Feil (${res.status})`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const append = (chunk: string) => setChatMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m))
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split(/\n\n/)
        buffer = parts.pop() || ''
        for (const p of parts) {
          const line = p.trim()
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (data === '[DONE]') { chatAbortRef.current = null; break }
          try {
            const json = JSON.parse(data)
            const delta = json?.choices?.[0]?.delta?.content
            if (typeof delta === 'string') append(delta)
            else if (typeof json?.content === 'string') append(json.content)
          } catch {
            if (data) append(data)
          }
        }
      }
    } catch (e: unknown) {
      const errObj = e as { name?: string; message?: string }
      if (errObj?.name === 'AbortError') setChatError('Avbrutt')
      else setChatError(errObj?.message || 'Ukjent feil')
    } finally {
      setChatStreaming(false)
      chatAbortRef.current = null
    }
  }, [chatStreaming, chatInput, customInput, companyInput, topCompany?.name, topCompany?.orgNumber, topCompany?.website, topCompany?.ceo, chatMessages])

  // Keep companyInput synced to the currently viewed company to avoid mismatches in Compose/Parallel
  useEffect(() => {
    if (!topCompany) return
    const buildDefaultBlock = (c: Business) => [
      `Company: ${c.name}`,
      c.orgNumber ? `Org number: ${c.orgNumber}` : undefined,
      c.website ? `Website: ${c.website}` : undefined,
    ].filter(Boolean).join('\n')
    const normalize = (s: string) => s.replace(/\r\n/g, '\n').trim()
    const defaultBlock = buildDefaultBlock(topCompany)
    setCompanyInput(prev => {
      const prevNorm = normalize(prev || '')
      const defNorm = normalize(defaultBlock)
      // If empty, set to current company
      if (!prevNorm) return defaultBlock
      // If previous block clearly refers to a different company/org, reset
      const prevOrg = prevNorm.match(/Org number:\s*(\d+)/i)?.[1] || null
      const prevName = prevNorm.match(/^Company:\s*(.+)$/m)?.[1]?.trim() || null
      const currOrg = topCompany.orgNumber || null
      const currName = topCompany.name
      if ((prevOrg && currOrg && prevOrg !== currOrg) || (prevName && prevName !== currName)) {
        return defaultBlock
      }
      // Otherwise, enforce the header lines to match the current company, keep user's extra lines
      const lines = prevNorm.split(/\n/)
      const filtered = lines.filter(l => !/^\s*(Company:|Org number:|Website:)\b/i.test(l))
      const header = [
        `Company: ${currName}`,
        currOrg ? `Org number: ${currOrg}` : null,
        topCompany.website ? `Website: ${topCompany.website}` : null,
      ].filter(Boolean) as string[]
      const merged = [...header, ...(filtered.length ? [''] : []), ...filtered].join('\n').trim()
      return merged || defaultBlock
    })
  }, [topCompany?.orgNumber, topCompany?.name, topCompany?.website])

  // Fetch company data
  useEffect(() => {
    if (status !== 'authenticated') return
    
    let cancelled = false
    
    const fetchCompanyData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Check if orgNumber is provided in URL
        const orgNumberFromUrl = searchParams.get('orgNumber')
        
        if (orgNumberFromUrl) {
          // Fetch specific company by exact orgNumber
          const params = new URLSearchParams({
            orgNumber: orgNumberFromUrl,
            limit: '1'
          })

          const response = await fetch(`/api/businesses?${params.toString()}`)
          if (!response.ok) throw new Error('Failed to fetch company')
          
          const data = await response.json()
          const items = Array.isArray(data) ? data : data.items || []
          
          if (cancelled) return
          
          if (items.length > 0) {
            const company = items[0] as Business
            setTopCompany(company)
            
            // Add to recently viewed
            addToRecentlyViewed({
              name: company.name,
              orgNumber: company.orgNumber
            })
            
            // Fetch events for this company
            const eventsParams = new URLSearchParams({
              orgNumber: company.orgNumber,
              limit: '50'
            })
            
                         const eventsResponse = await fetch(`/api/events?${eventsParams.toString()}`)
             if (eventsResponse.ok) {
               const eventsData = await eventsResponse.json()
               const rawItems = Array.isArray(eventsData) ? eventsData : eventsData.items || []
               const now = Date.now()
               const eventItems = (rawItems as EventItem[]).filter(e => {
                 if (!e?.date) return true
                 const t = Date.parse(String(e.date))
                 return Number.isFinite(t) && t <= now
               })
               if (!cancelled) {
                 setEvents(eventItems)
               }
             }
          } else {
            if (!cancelled) {
              setError('Company not found')
            }
          }
        } else {
          // Try to load most recently viewed company from localStorage first
          let lastViewedOrg: string | null = null
          try {
            const stored = localStorage.getItem('recentlyViewedCompanies')
            if (stored) {
              const parsed = JSON.parse(stored)
              if (Array.isArray(parsed) && parsed[0]?.orgNumber) {
                lastViewedOrg = String(parsed[0].orgNumber)
              }
            }
          } catch {
            // ignore localStorage errors and fall back
          }

          if (lastViewedOrg) {
            // Fetch the most recently viewed company by orgNumber
            const params = new URLSearchParams({
              orgNumber: lastViewedOrg,
              limit: '1'
            })

            const response = await fetch(`/api/businesses?${params.toString()}`)
            if (!response.ok) throw new Error('Failed to fetch company')

            const data = await response.json()
            const items = Array.isArray(data) ? data : data.items || []

            if (cancelled) return

            if (items.length > 0) {
              const company = items[0] as Business
              setTopCompany(company)

              // Add to recently viewed (when loading from localStorage)
              addToRecentlyViewed({
                name: company.name,
                orgNumber: company.orgNumber
              })

              // Fetch events for this company
              const eventsParams = new URLSearchParams({
                orgNumber: company.orgNumber,
                limit: '50'
              })

              const eventsResponse = await fetch(`/api/events?${eventsParams.toString()}`)
              if (eventsResponse.ok) {
                const eventsData = await eventsResponse.json()
                const rawItems = Array.isArray(eventsData) ? eventsData : eventsData.items || []
                const now = Date.now()
                const eventItems = (rawItems as EventItem[]).filter(e => {
                  if (!e?.date) return true
                  const t = Date.parse(String(e.date))
                  return Number.isFinite(t) && t <= now
                })
                if (!cancelled) {
                  setEvents(eventItems)
                }
              }
            } else {
              // Fallback to original behavior if stored orgNumber not found
              const params = new URLSearchParams({
                events: 'with',
                sortBy: 'scoreDesc',
                limit: '1'
              })

              const response2 = await fetch(`/api/businesses?${params.toString()}`)
              if (!response2.ok) throw new Error('Failed to fetch companies')

              const data2 = await response2.json()
              const items2 = Array.isArray(data2) ? data2 : data2.items || []

              if (cancelled) return

              if (items2.length > 0) {
                const company2 = items2[0] as Business
                setTopCompany(company2)

                // Add to recently viewed (fallback company)
                addToRecentlyViewed({
                  name: company2.name,
                  orgNumber: company2.orgNumber
                })

                if (company2.orgNumber) {
                  const eventsParams2 = new URLSearchParams({
                    orgNumber: company2.orgNumber,
                    limit: '50'
                  })

                  const eventsResponse2 = await fetch(`/api/events?${eventsParams2.toString()}`)
                  if (eventsResponse2.ok) {
                    const eventsData2 = await eventsResponse2.json()
                    const rawItems2 = Array.isArray(eventsData2) ? eventsData2 : eventsData2.items || []
                    const now2 = Date.now()
                    const eventItems2 = (rawItems2 as EventItem[]).filter(e => {
                      if (!e?.date) return true
                      const t = Date.parse(String(e.date))
                      return Number.isFinite(t) && t <= now2
                    })
                    if (!cancelled) {
                      setEvents(eventItems2)
                    }
                  }
                }
              } else {
                if (!cancelled) {
                  setError('No companies with news events found')
                }
              }
            }
          } else {
            // Fallback to original behavior: fetch top company with events
            const params = new URLSearchParams({
              events: 'with',
              sortBy: 'scoreDesc',
              limit: '1'
            })

            const response = await fetch(`/api/businesses?${params.toString()}`)
            if (!response.ok) throw new Error('Failed to fetch companies')

            const data = await response.json()
            const items = Array.isArray(data) ? data : data.items || []

            if (cancelled) return

            if (items.length > 0) {
              const company = items[0] as Business
              setTopCompany(company)

              // Add to recently viewed (final fallback)
              addToRecentlyViewed({
                name: company.name,
                orgNumber: company.orgNumber
              })

              // Fetch events for this company
              if (company.orgNumber) {
                const eventsParams = new URLSearchParams({
                  orgNumber: company.orgNumber,
                  limit: '50'
                })

                const eventsResponse = await fetch(`/api/events?${eventsParams.toString()}`)
                if (eventsResponse.ok) {
                  const eventsData = await eventsResponse.json()
                  const rawItems = Array.isArray(eventsData) ? eventsData : eventsData.items || []
                  const now = Date.now()
                  const eventItems = (rawItems as EventItem[]).filter(e => {
                    if (!e?.date) return true
                    const t = Date.parse(String(e.date))
                    return Number.isFinite(t) && t <= now
                  })
                  if (!cancelled) {
                    setEvents(eventItems)
                  }
                }
              }
            } else {
              if (!cancelled) {
                setError('No companies with news events found')
              }
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load company data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    
    fetchCompanyData()
    
    return () => {
      cancelled = true
    }
  }, [status, searchParams])

  // Keep companyInput synced to the currently viewed company to avoid mismatches in Compose/Parallel
  useEffect(() => {
    if (!topCompany) return
    const buildDefaultBlock = (c: Business) => [
      `Company: ${c.name}`,
      c.orgNumber ? `Org number: ${c.orgNumber}` : undefined,
      c.website ? `Website: ${c.website}` : undefined,
    ].filter(Boolean).join('\n')
    const normalize = (s: string) => s.replace(/\r\n/g, '\n').trim()
    const defaultBlock = buildDefaultBlock(topCompany)
    setCompanyInput(prev => {
      const prevNorm = normalize(prev || '')
  // (removed unused defNorm)
      // If empty, set to current company
      if (!prevNorm) return defaultBlock
      // If previous block clearly refers to a different company/org, reset
      const prevOrg = prevNorm.match(/Org number:\s*(\d+)/i)?.[1] || null
      const prevName = prevNorm.match(/^Company:\s*(.+)$/m)?.[1]?.trim() || null
      const currOrg = topCompany.orgNumber || null
      const currName = topCompany.name
      if ((prevOrg && currOrg && prevOrg !== currOrg) || (prevName && prevName !== currName)) {
        return defaultBlock
      }
      // Otherwise, enforce the header lines to match the current company, keep user's extra lines
      const lines = prevNorm.split(/\n/)
      const filtered = lines.filter(l => !/^\s*(Company:|Org number:|Website:)\b/i.test(l))
      const header = [
        `Company: ${currName}`,
        currOrg ? `Org number: ${currOrg}` : null,
        topCompany.website ? `Website: ${topCompany.website}` : null,
      ].filter(Boolean) as string[]
      const merged = [...header, ...(filtered.length ? [''] : []), ...filtered].join('\n').trim()
      return merged || defaultBlock
    })
  }, [topCompany?.orgNumber, topCompany?.name, topCompany?.website])

  // Load business context: prefer session.user.businessContext, fallback to localStorage
  useEffect(() => {
    try {
      const fromSession = session?.user?.businessContext as string | undefined
      if (fromSession && fromSession.trim()) {
        setCustomInput(fromSession)
        try { localStorage.setItem('businessContext', fromSession) } catch {}
        return
      }
      const bc = localStorage.getItem('businessContext')
      if (bc && typeof bc === 'string') {
        setCustomInput(bc)
      }
    } catch {
      // ignore
    }
  }, [session?.user])

  // Poll for research result when queued/running
  useEffect(() => {
    let timer: number | null = null
    const token = pollTokenRef.current
    const poll = async () => {
      // If a new run started, abort this poll loop
      if (token !== pollTokenRef.current) return
      if (!researchRunId) return
      try {
        try { console.log('[company] poll:start', { runId: researchRunId }) } catch {}
        const res = await fetch(`/api/parallel/research?runId=${encodeURIComponent(researchRunId)}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (token !== pollTokenRef.current) return
          const status = (data as { status?: string })?.status
          const result = (data as { result?: unknown })?.result as unknown
          try { console.log('[company] poll:ok', { runId: researchRunId, status }) } catch {}
          setLastRunStatus(status || 'queued')
          setLastPollAt(Date.now())
          if (status === 'completed' && result) {
            const output = (result as { output?: unknown })?.output as unknown
            let contentAny: unknown = (output as { content?: unknown })?.content ?? (output as { text?: unknown })?.text ?? output
            const flattened = flattenParallelContent(contentAny)
            if (flattened) contentAny = flattened
            if (contentAny !== undefined && contentAny !== null) {
              const structured = coerceStructuredResearch(contentAny)
              if (structured) {
                try {
                  const trd = await translateStructured(structured, (prompt || '').slice(0, 400))
                  setResearchStructured(trd)
                } catch {
                  setResearchStructured(structured)
                }
                setResearchText('')
                setTranslatedResearchText('')
              } else {
                const englishText = typeof contentAny === 'string' ? contentAny : String(contentAny)
                setResearchText(stripChainOfThought(englishText))
                try {
                  const tr = await fetch('/api/translate', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ text: englishText, matchPrompt: true, promptText: (prompt || '').slice(0, 400) }),
                  })
                  if (tr.ok) {
                    const trData = await tr.json()
                    setTranslatedResearchText(stripChainOfThought(String(trData.text || '')))
                  } else {
                    setTranslatedResearchText('')
                  }
                } catch {
                  setTranslatedResearchText('')
                }
              }
            }
            const basis = (output as { basis?: unknown })?.basis
            setResearchBasis(extractCitationsFromBasis(basis))
            // Status will be set to 'completed' by useEffect when output is available
            return
          }
          // still queued
          setResearchStatus('running')
        } else if (res.status === 202) {
          try { console.log('[company] poll:queued', { runId: researchRunId }) } catch {}
          setResearchStatus('running')
          setLastRunStatus('queued')
          setLastPollAt(Date.now())
        } else {
          setResearchStatus('error')
          setResearchError('Failed to get research status')
          setLastRunStatus('error')
          setLastPollAt(Date.now())
        }
      } catch (e) {
        try { console.warn('[company] poll:error', e) } catch {}
        setResearchStatus('error')
        setResearchError('Research polling failed')
        setLastRunStatus('error')
        setLastPollAt(Date.now())
      }
      timer = window.setTimeout(poll, 2500)
    }
    if (researchRunId && (researchStatus === 'queued' || researchStatus === 'running')) {
      poll()
    }
    return () => {
      if (timer) window.clearTimeout(timer)
    }
  }, [researchRunId, researchStatus])

  // Translate structured research sections to match the prompt language
  const translateStructured = async (data: StructuredResearch, promptText: string): Promise<StructuredResearch> => {
    const out: StructuredResearch = { ...data }
    const promptSample = (promptText || '').slice(0, 400)
    const tasks: Array<Promise<void>> = []
    // Translate directAnswer in parallel with key points
    if (data.directAnswer && data.directAnswer.trim()) {
      tasks.push(
        (async () => {
          try {
            const tr = await fetch('/api/translate', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ text: data.directAnswer, matchPrompt: true, promptText: promptSample }),
            })
            if (tr.ok) {
              const td = await tr.json()
              out.directAnswer = String(td.text || data.directAnswer)
            }
          } catch {}
        })()
      )
    }
    // Translate keyPoints concurrently (preserve order)
    if (Array.isArray(data.keyPoints) && data.keyPoints.length > 0) {
      const promises = data.keyPoints.map(async (kp) => {
        const s = typeof kp === 'string' ? kp : String(kp)
        if (!s.trim()) return s
        try {
          const tr = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: s, matchPrompt: true, promptText: promptSample }),
          })
          if (!tr.ok) return s
          const td = await tr.json()
          return String(td.text || s)
        } catch {
          return s
        }
      })
      tasks.push(
        (async () => {
          const translated = await Promise.all(promises)
          out.keyPoints = translated
        })()
      )
    }
    try {
      if (tasks.length) await Promise.all(tasks)
      return out
    } finally {
      // Translation complete
    }
  }

  const composeRunTranslate = async () => {
    if (!topCompany) return
    try {
      // Start AI (compose) timing
      setComposeStartedAt(typeof performance !== 'undefined' ? performance.now() : Date.now())
      setIsComposing(true)
      try { console.log('[company] compose:start', { processor, orgNumber: topCompany.orgNumber }) } catch {}
      // Build an up-to-date company block; only use the editable textarea if user actually modified it
      const buildCompanyBlock = (c: Business) => {
        const lines = [
          `Company: ${c.name}`,
          c.orgNumber ? `Org number: ${c.orgNumber}` : undefined,
          c.website ? `Website: ${c.website}` : undefined,
        ].filter(Boolean) as string[]
        return lines.join('\n')
      }
      const normalizeBlock = (s: string) => s.replace(/\r\n/g, '\n').trim()
      const defaultBlock = buildCompanyBlock(topCompany)
      // Enforce that the header (Company/Org number/Website) always matches the currently viewed company
      const enforceCurrentHeader = (c: Business, s: string) => {
        const lines = (s || '').split(/\r?\n/)
        const rest = lines.filter(l => !/^\s*(Company:|Org number:|Website:)\b/i.test(l))
        const header = [
          `Company: ${c.name}`,
          c.orgNumber ? `Org number: ${c.orgNumber}` : null,
          c.website ? `Website: ${c.website}` : null,
        ].filter(Boolean) as string[]
        return [...header, ...(rest.length ? [''] : []), ...rest].join('\n').trim()
      }
      const effectiveCompanyBlock = (companyInput && companyInput.trim())
        ? enforceCurrentHeader(topCompany, companyInput)
        : defaultBlock
      // Augment the user's free-form research prompt with concise context (company + user org) without polluting system prompt rules.
      let effectivePrompt = prompt || ''
      const composePrefixParts: string[] = []
      if (topCompany.name) {
        composePrefixParts.push(`Target company: ${topCompany.name}${topCompany.orgNumber ? ` (Org ${topCompany.orgNumber})` : ''}`)
        if (topCompany.website) composePrefixParts.push(`Company website: ${topCompany.website}`)
      }
      if (customInput.trim()) {
        const profileSummary = customInput.trim().split(/\n+/).map(l => l.trim()).filter(Boolean).slice(0, 4).join(' | ').slice(0, 400)
        composePrefixParts.push(`User represents: ${profileSummary}`)
      }
      if (composePrefixParts.length) {
        effectivePrompt = composePrefixParts.join('\n') + '\n\n' + effectivePrompt
      }
      const composeResp = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: effectivePrompt,
          businessContext: customInput || undefined,
          companyBlock: effectiveCompanyBlock || undefined,
          processor,
        }),
      })
      if (!composeResp.ok) {
        const data = await composeResp.json().catch(() => ({}))
        throw new Error(data?.error || 'Compose failed')
      }
      const composeData = await composeResp.json()
      try { console.log('[company] compose:ok', { model: (composeData as { model?: string })?.model }) } catch {}
      // End AI timing
      setComposeMs((prev) => {
        const start = (typeof performance !== 'undefined' ? performance.now() : Date.now())
        const s = composeStartedAt ?? start
        return Math.max(0, start - s)
      })
      setIsComposing(false)
      const inputStr: string = composeData.input
      const outputSchemaStr: string = composeData.outputSchema

      const runResp = await fetch('/api/parallel/research', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          companyName: topCompany.name,
          website: topCompany.website,
          orgNumber: topCompany.orgNumber,
          processor,
          input: inputStr,
          customInput: customInput || undefined,
          outputSchema: outputSchemaStr,
        }),
      })
      // Start Parallel timing (from POST request start)
      setParallelStartedAt((typeof performance !== 'undefined' ? performance.now() : Date.now()))
      if (!runResp.ok && runResp.status !== 202) {
        const data = await runResp.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to start research')
      }
      const runData: unknown = await runResp.json()
      const runId: string | undefined = (runData as { runId?: string })?.runId
      const result = (runData as { result?: unknown })?.result as unknown
      try { console.log('[company] run:start', { status: runResp.status, runId, hasImmediateResult: Boolean(result) }) } catch {}
      if (runId && (!result || runResp.status === 202)) {
        setResearchRunId(runId)
        setResearchStatus('running')
        return
      }
      const output = (result as { output?: unknown })?.output as unknown
      const contentAny: unknown = (output as { content?: unknown })?.content ?? (output as { text?: unknown })?.text ?? output
      if (contentAny === undefined || contentAny === null) throw new Error('Empty result')
      const structured = coerceStructuredResearch(contentAny)
      if (structured) {
        try {
          const trd = await translateStructured(structured, prompt)
          setResearchStructured(trd)
        } catch {
          setResearchStructured(structured)
        }
        setResearchText('')
        // End Parallel timing and log summary
        const end = (typeof performance !== 'undefined' ? performance.now() : Date.now())
        const pStart = parallelStartedAt ?? end
        const pMs = Math.max(0, end - pStart)
        setParallelMs(pMs)
        // Status will be set to 'completed' by useEffect when output is available
        const totalStart = researchStartedAt ?? end
        const totalMs = Math.max(0, end - totalStart)
        const aiMs = composeMs ?? ((composeStartedAt && researchStartedAt) ? (composeStartedAt - researchStartedAt) : 0)
        try { console.log(`[research-timing] total=${(totalMs/1000).toFixed(2)}s, ai=${(aiMs/1000).toFixed(2)}s, parallel=${(pMs/1000).toFixed(2)}s`) } catch {}
      } else {
        const englishText = typeof contentAny === 'string' ? contentAny : String(contentAny)
        setResearchText(stripChainOfThought(englishText))
        try {
          const tr = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: englishText, matchPrompt: true, promptText: (prompt || '').slice(0, 400) }),
          })
          if (tr.ok) {
            const trData = await tr.json()
            // Use translated text as the main text if translation succeeded
            setResearchText(stripChainOfThought(String(trData.text || englishText)))
          }
        } catch {
          // Keep English text if translation fails
        }
        // End Parallel timing and log summary
        const end = (typeof performance !== 'undefined' ? performance.now() : Date.now())
        const pStart = parallelStartedAt ?? end
        const pMs = Math.max(0, end - pStart)
        setParallelMs(pMs)
        const totalStart = researchStartedAt ?? end
        const totalMs = Math.max(0, end - totalStart)
        const aiMs = composeMs ?? ((composeStartedAt && researchStartedAt) ? (composeStartedAt - researchStartedAt) : 0)
        try { console.log(`[research-timing] total=${(totalMs/1000).toFixed(2)}s, ai=${(aiMs/1000).toFixed(2)}s, parallel=${(pMs/1000).toFixed(2)}s`) } catch {}
      }
      const basis = (output as { basis?: unknown })?.basis
      setResearchBasis(extractCitationsFromBasis(basis))
    } catch (e) {
      setResearchStatus('error')
      setResearchError(e instanceof Error ? e.message : 'Compose/Run/Translate failed')
      setIsComposing(false)
    }
  }

  const triggerResearch = async () => {
    if (!topCompany) return
    pollTokenRef.current += 1
    setResearchError(null)
    setResearchRunId(null)
    setResearchBasis([])
    setResearchText('')
    setResearchStructured(null)
    // reset timing and start total timer
    setResearchStartedAt(typeof performance !== 'undefined' ? performance.now() : Date.now())
    setComposeStartedAt(null)
    setComposeMs(null)
    setParallelStartedAt(null)
    setParallelMs(null)
    setResearchStatus('queued')
    setLastRunStatus('queued')
    setLastPollAt(Date.now())
  }

  const handleClearResearch = () => {
    // Invalidate polling and clear all research state
    pollTokenRef.current += 1
    setResearchRunId(null)
    setResearchText('')
    setTranslatedResearchText('')
    setResearchStructured(null)
    setResearchBasis([])
    setResearchError(null)
    setResearchStatus('idle')
    setLastRunStatus(null)
    setLastPollAt(null)
    setIsComposing(false)
  }

  // Fetch business statistics
  useEffect(() => {
    if (status !== 'authenticated') return
    
    let cancelled = false
    
    const fetchStats = async () => {
      try {
        // Get total companies count
        const companiesResponse = await fetch('/api/businesses?countOnly=1')
        const companiesData = await companiesResponse.json()
        
        // Get companies with events count
        const withEventsResponse = await fetch('/api/businesses?events=with&countOnly=1')
        const withEventsData = await withEventsResponse.json()
        
        // Get total events count (approximate from latest events)
        const eventsResponse = await fetch('/api/events?limit=1')
        await eventsResponse.json()
        
        if (!cancelled) {
          setBusinessStats({
            totalCompanies: companiesData.total || companiesData.grandTotal || 0,
            companiesWithEvents: withEventsData.total || withEventsData.grandTotal || 0,
            totalEvents: 50000 // Approximate since we don't have a direct count API
          })
        }
      } catch {
        console.error('Failed to fetch business stats')
      }
    }
    
    fetchStats()
    
    return () => {
      cancelled = true
    }
  }, [status])

  // Company search suggestions
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setCompanySuggestions([])
      setCompanyDropdownOpen(false)
      return
    }

    // Use optimized instant search endpoint with indexed search_vector/trigram
    // and cancel in-flight requests when query changes rapidly
    const ctl = new AbortController()
    const fetchSuggestions = async () => {
      try {
        const params = new URLSearchParams({
          search: searchQuery,
          sortBy: 'name',
          order: 'asc',
          limit: '10',
        })
        const res = await fetch(`/api/businesses/instant?${params.toString()}` , { signal: ctl.signal })
        if (!res.ok) throw new Error('instant search failed')
        const data = await res.json()
        const items = Array.isArray(data?.items) ? data.items : []
        type InstantItem = { name?: unknown; org_number?: unknown; orgNumber?: unknown }
        // Dedupe by orgNumber for stability
        const uniq = new Map<string, { name: string; orgNumber: string }>()
        for (const it of items as InstantItem[]) {
          const name = typeof it.name === 'string' ? it.name : ''
          const org = typeof it.org_number === 'string' ? it.org_number : typeof it.orgNumber === 'string' ? it.orgNumber : ''
          if (!org) continue
          if (!uniq.has(org)) uniq.set(org, { name, orgNumber: org })
        }
        setCompanySuggestions(Array.from(uniq.values()))
        setCompanyDropdownOpen(true)
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
        setCompanySuggestions([])
        setCompanyDropdownOpen(false)
      }
    }

    const timeoutId = setTimeout(fetchSuggestions, 200)
    return () => {
      clearTimeout(timeoutId)
      ctl.abort()
    }
  }, [searchQuery])

  // Keep company dropdown positioned under input
  useEffect(() => {
    if (!companyDropdownOpen) return
    const el = companySearchRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCompanyDropdownRect({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    const onScroll = () => {
      const r = el.getBoundingClientRect()
      setCompanyDropdownRect({ top: r.bottom + 8, left: r.left, width: r.width })
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll, true)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll, true)
    }
  }, [companyDropdownOpen])

  // Close dropdown on outside click
  useEffect(() => {
    if (!companyDropdownOpen) return
    function onClick(e: MouseEvent) {
      const target = e.target as Node
      const input = companySearchRef.current
      const menu = companyDropdownRef.current
      if (input && input.contains(target)) return
      if (menu && menu.contains(target)) return
      setCompanyDropdownOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [companyDropdownOpen])

  const handleCompanySelect = async (orgNumber: string) => {
    setCompanyDropdownOpen(false)
    setSearchQuery('')
    setLoading(true)
    setError(null)
  // Clear any existing research output when switching companies
  pollTokenRef.current += 1
  setResearchRunId(null)
  setResearchStatus('idle')
  setResearchError(null)
  setResearchText('')
  setResearchStructured(null)
  setResearchBasis([])

    try {
      // Fetch selected company
      const params = new URLSearchParams({
        orgNumber,
        limit: '1'
      })
      const response = await fetch(`/api/businesses?${params.toString()}`)
      const data = await response.json()
      const items = Array.isArray(data) ? data : data.items || []

      if (items.length > 0) {
        const company = items[0] as Business
        setTopCompany(company)
        
        // Add to recently viewed
        addToRecentlyViewed({
          name: company.name,
          orgNumber: company.orgNumber
        })

        // Fetch events for this company
        const eventsParams = new URLSearchParams({
          orgNumber: company.orgNumber,
          limit: '50'
        })
        
        const eventsResponse = await fetch(`/api/events?${eventsParams.toString()}`)
        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json()
          const rawItems = Array.isArray(eventsData) ? eventsData : eventsData.items || []
          const now = Date.now()
          const eventItems = (rawItems as EventItem[]).filter(e => {
            if (!e?.date) return true
            const t = Date.parse(String(e.date))
            return Number.isFinite(t) && t <= now
          })
          setEvents(eventItems)
        }
      }
    } catch {
      setError('Failed to load selected company')
    } finally {
      setLoading(false)
    }
  }

  return (
  <div className={`min-h-screen pb-8 md:pb-12 transition-colors ${light ? 'company-light' : ''}`}>
    {light && (
      <style jsx global>{`
        .company-light .border-white\/10 { border-color: #e5e7eb !important; }
        .company-light .border-white\/20 { border-color: #d1d5db !important; }
        .company-light .bg-white\/5 { background-color: #f9fafb !important; }
        .company-light .text-white { color: #111827 !important; }
        .company-light .text-white\/90 { color: #1f2937 !important; }
        .company-light .text-gray-300 { color: #4b5563 !important; }
        .company-light .text-gray-400 { color: #6b7280 !important; }
        .company-light .text-gray-500 { color: #6b7280 !important; }
      `}</style>
    )}
      {/* Search Bar and Recently Viewed */}
  <div className={`p-2 px-6 border-b ${light ? 'border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60' : 'border-white/10'}` }>
        <div className="flex items-center gap-8">
              {/* Search Bar */}
          <div className="relative w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Søk selskaper"
            className={`w-full bg-transparent px-0 py-2 border-0 border-b focus:outline-none focus:ring-0 ${light ? 'text-gray-900 placeholder-gray-400 border-gray-300 focus:border-red-600' : 'text-white placeholder-gray-500 border-white/20 focus:border-red-600/90'}`}
            ref={companySearchRef}
            onFocus={() => {
              if (companySuggestions.length > 0) setCompanyDropdownOpen(true)
            }}
          />
          
          {/* Portal-based dropdown anchored to input, like on Search page */}
          {companyDropdownOpen && companySuggestions.length > 0 && companyDropdownRect && isMounted && createPortal(
            <div
              ref={companyDropdownRef}
              className={`z-50 shadow-xl ${light ? 'bg-white border border-gray-200 text-gray-900 divide-y divide-gray-100' : 'border border-white/10 bg-black text-white divide-y divide-white/10'}`}
              style={{ position: 'fixed', top: companyDropdownRect.top, left: companyDropdownRect.left, width: companyDropdownRect.width }}
            >
              {companySuggestions.map((c, idx) => (
                <button
                  key={`${c.orgNumber}-${idx}`}
                  onClick={() => handleCompanySelect(c.orgNumber)}
                  className={`block w-full text-left px-4 py-3 text-sm focus:outline-none transition-colors ${light ? 'hover:bg-gray-100 focus:bg-gray-100' : 'hover:bg-white/20 focus:bg-white/20'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>{c.name || 'Uten navn'}</span>
                    <span className={`text-xs ${light ? 'text-gray-500' : 'text-gray-400'}`}>{c.orgNumber}</span>
                  </div>
                </button>
              ))}
            </div>,
            document.body
          )}
          </div>

          {/* Recently Viewed Companies */}
          {recentlyViewed.length > 0 && (
            <div className="flex-1 relative flex items-center min-w-0">
        {/* Left/Right scroll arrows - visible whenever horizontally scrollable */}
      {isHorizScrollable && (
                <>
                  <button
                    type="button"
                    aria-label="Scroll left"
                    onClick={() => !canScrollLeft ? undefined : scrollByAmount(-300)}
        className={`absolute left-1 top-1/2 -translate-y-1/2 z-20 p-2 text-white transition-opacity ${canScrollLeft ? 'text-opacity-60 hover:text-opacity-90' : 'text-opacity-30 cursor-default pointer-events-none'}`}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Scroll right"
                    onClick={() => !canScrollRight ? undefined : scrollByAmount(300)}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 text-white transition-opacity ${canScrollRight ? 'text-opacity-60 hover:text-opacity-90' : 'text-opacity-30 cursor-default pointer-events-none'}`}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </>
              )}

              <div
                ref={recentlyRef}
                className={`flex gap-2 overflow-x-auto scrollbar-hide pr-8 pl-8 w-full ${isDragging ? 'select-none' : ''}`}
                onMouseDown={(e) => handleDragStart(e.clientX)}
                onMouseMove={(e) => handleDragMove(e.clientX)}
                // keep dragging even when leaving the element; window listeners will manage it
                onMouseLeave={() => { /* no-op to maintain drag */ }}
                onTouchStart={(e) => handleDragStart(e.touches[0]?.clientX ?? 0)}
                onTouchMove={(e) => handleDragMove(e.touches[0]?.clientX ?? 0)}
                onTouchEnd={() => handleDragEnd()}
              >
                {recentlyViewed.map((company, idx) => (
                  <button
                    key={`${company.orgNumber}-${idx}`}
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      if (dragMovedRef.current) {
                        e.preventDefault()
                        e.stopPropagation()
                        return
                      }
                      handleCompanySelect(company.orgNumber)
                    }}
                    className="px-3 py-1 text-xs border border-white/20 text-white/90 hover:bg-red-600/20 hover:border-red-600/60 transition-colors rounded-none whitespace-nowrap flex-shrink-0"
                    title={`${company.name} (${company.orgNumber})`}
                  >
                    <span className="max-w-32 block truncate">{company.name}</span>
                  </button>
                ))}
              </div>
              {/* Fade effect on the left */}
              <div className={`absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r ${light ? 'from-white' : 'from-black'} to-transparent pointer-events-none z-10`}></div>
              {/* Fade effect on the right */}
              <div className={`absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l ${light ? 'from-white' : 'from-black'} to-transparent pointer-events-none z-10`}></div>
            </div>
          )}
        </div>
      </div>

  <div className="p-6">
    {/* Parallel Deep Research */}
        {topCompany && (
          <div className="border border-white/10 p-4 mb-6 bg-white/5">
            <div className="flex items-start gap-3">
              {/* 1. Input area */}
              {uiMode === 'research' ? (
                <textarea
                  id="research-prompt"
                  ref={promptRef}
                  value={prompt}
                  onChange={(e) => { setPrompt(e.target.value); setLastPromptEditAt(Date.now()); autoResizePrompt() }}
                  rows={1}
                  disabled
                  placeholder="Coming soon..."
                  className={`flex-1 border text-sm px-3 py-2 overflow-hidden resize-none leading-6 focus:outline-none cursor-not-allowed opacity-60 ${light
                    ? 'bg-white border-gray-200 text-gray-500 placeholder-gray-400'
                    : 'bg-black border-white/10 text-white/50 placeholder-gray-500'}`}
                />
              ) : (
                <textarea
                  id="chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                  placeholder="Spør hugin"
                  rows={1}
                  className={`flex-1 border text-sm px-3 py-2 overflow-hidden resize-none leading-6 focus:outline-none ${light
                    ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-red-600'
                    : 'bg-black border-white/20 text-white placeholder-gray-500 focus:border-red-600/70'}`}
                />
              )}
              {/* 2. Action button */}
              {uiMode === 'research' ? (
                <button
                  onClick={() => { /* disabled while coming soon */ }}
                  disabled
                  className={`h-10 w-24 border text-sm cursor-not-allowed ${light ? 'border-gray-200 text-gray-400 bg-gray-100' : 'border-white/10 text-white/40 bg-black'}`}
                >Spør</button>
              ) : chatStreaming ? (
                <button
                  onClick={() => chatAbortRef.current?.abort()}
                  className={`h-10 w-24 border text-sm ${light ? 'border-red-500 text-red-700 hover:bg-red-50' : 'border-red-600/60 text-white hover:bg-red-600/20'}`}
                >Stopp</button>
              ) : (
                <button
                  onClick={sendChat}
                  disabled={!chatInput.trim()}
                  className={`h-10 w-24 border text-sm transition-colors ${chatInput.trim()
                    ? (light ? 'border-gray-300 text-gray-800 hover:bg-red-50 hover:border-red-500 hover:text-red-700' : 'border-white/20 text-white/90 bg-black hover:bg-red-600/20 hover:border-red-600/60')
                    : (light ? 'border-gray-200 text-gray-400' : 'border-white/10 text-white/40 bg-black')}`}
                >Spør</button>
              )}
              {/* 3. Processor group (research) or Chat dropdown toggle (chat) */}
              <div ref={procAnchorRef} className="relative flex items-stretch h-10">
                {uiMode === 'research' ? (
                  <div ref={procButtonsContainerRef} className={`h-10 overflow-hidden flex items-stretch text-sm select-none border ${light ? 'bg-white border-gray-300' : 'bg-black border-white/20'}`}>
                    {(['base','pro','ultra'] as const).map((key, idx) => {
                      const selected = processor === key
                      const level = idx + 1
                      const costStr = processorMeta[key].cost
                      const basePoints = (() => { const n = parseFloat(String(costStr).replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? Math.round(n * 1000) : NaN })()
                      const points: number | '?' = Number.isFinite(basePoints) ? Math.round((basePoints as number) * 1.2) : '?'
                      const pointsLabel = typeof points === 'number' ? numberFormatter.format(points) : String(points)
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setProcessor(key)}
                          title={`Estimert tid: ${processorMeta[key].est} • ${pointsLabel} poeng / spørsmål`}
                          className={`px-2 h-full flex items-center justify-center transition-colors ${selected
                            ? (light ? 'bg-red-50 text-red-700' : 'bg-red-600/20 text-white')
                            : (light ? 'text-gray-700 hover:bg-gray-100' : 'text-white/85 hover:bg-white/10')}
                            ${idx > 0 ? (light ? 'border-l border-gray-200' : 'border-l border-white/15') : ''}`}
                        >
                          <span className={`inline-flex flex-col-reverse items-center gap-[3px] ${uiMode==='research' ? researchDotAnimClass : ''}`}>
                            {Array.from({ length: 3 }).map((_, j) => {
                              const litCount = level
                              const isLit = j < litCount
                              return <span key={j} className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${isLit ? (light ? 'bg-red-500' : 'bg-red-400') : (light ? 'bg-gray-300' : 'bg-white/25')}`} />
                            })}
                          </span>
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => setProcDropdownOpen(o => !o)}
                      aria-haspopup="menu"
                      aria-expanded={procDropdownOpen}
                      aria-label="Bytt modus"
                      className={`px-2 h-full flex items-center justify-center border-l text-sm transition-colors ${light
                        ? 'border-gray-200 text-gray-600 hover:bg-gray-100'
                        : 'border-white/15 text-white/70 hover:bg-white/10'} ${procDropdownOpen ? (light ? 'bg-gray-100' : 'bg-white/10') : ''}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="pointer-events-none">
                        <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setProcDropdownOpen(o => !o)}
                    className={`h-10 border text-sm flex items-center justify-between px-4 pl-5 pr-2 transition-colors ${light
                      ? 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      : 'border-white/20 text-white/85 bg-black hover:bg-white/10'}`}
                    style={{ width: procGroupWidth ? `${procGroupWidth}px` : `${PROC_FALLBACK_WIDTH}px` }}
                    aria-haspopup="menu"
                    aria-expanded={procDropdownOpen}
                    title="Velg modus"
                  >
                    <span>Chat</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="pointer-events-none shrink-0 ml-2">
                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
                {uiMode === 'chat' && procGroupWidth == null && (
                  <div aria-hidden="true" className="absolute -left-[9999px] top-0">
                    <div ref={procButtonsContainerRef} className={`h-10 flex items-stretch text-sm select-none border ${light ? 'bg-white border-gray-300' : 'bg-black border-white/20'}`}> 
                      {(['base','pro','ultra'] as const).map((key) => (
                        <button key={`m-${key}`} type="button" className="px-2 h-full" />
                      ))}
                      <button type="button" className="px-2 h-full" />
                    </div>
                  </div>
                )}
                {procDropdownOpen && (
                  <div ref={procDropdownRef} className={`absolute right-0 top-full z-50 border ${light ? 'bg-white border-gray-200' : 'bg-black border-white/20'}`} style={{ width: uiMode==='research' ? ((procAnchorRef.current?.firstElementChild as HTMLElement | null)?.offsetWidth || 0) : (procGroupWidth || undefined) }}>
                    <div className="flex flex-col">
                      {uiMode === 'research' ? (
                        <button
                          onClick={() => { setUiMode('chat'); setProcDropdownOpen(false) }}
                          className={`text-left px-4 py-2 text-sm transition-colors ${light ? 'text-gray-700 hover:bg-gray-100' : 'text-white/85 hover:bg-white/10 hover:text-white'}`}
                        >Chat</button>
                      ) : (
                        <button
                          onClick={() => { setUiMode('research'); setProcDropdownOpen(false) }}
                          className={`text-left px-4 py-2 text-sm transition-colors ${light ? 'text-gray-700 hover:bg-gray-100' : 'text-white/85 hover:bg-white/10 hover:text-white'}`}
                        >Research</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* 4. Clear / abort */}
                {uiMode === 'research' ? (
                  <button
                    onClick={handleClearResearch}
                    className={`h-10 w-24 border text-sm transition-colors ${researchStatus === 'running' || researchStatus === 'queued'
                      ? (light ? 'border-red-500 text-red-700 hover:bg-red-50' : 'border-red-600/60 text-white hover:bg-red-600/20')
                      : (researchText || researchStructured)
                        ? (light ? 'border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-500 hover:text-red-700' : 'border-white/20 text-white/90 hover:bg-red-600/20 hover:border-red-600/60')
                        : (light ? 'border-gray-200 text-gray-400 hover:bg-gray-100' : 'border-white/10 text-white/40 hover:bg-red-600/10 hover:border-red-600/30')}`}
                    title={(researchStatus === 'running' || researchStatus === 'queued') ? 'Avbryt' : 'Tøm svar'}
                  >{(researchStatus === 'running' || researchStatus === 'queued') ? 'Avbryt' : 'Tøm'}</button>
                ) : (
                  <button
                    onClick={() => { if (chatStreaming) chatAbortRef.current?.abort(); setChatMessages([]); setChatError(null) }}
                    className={`h-10 w-24 border text-sm transition-colors ${(chatMessages.some(m => m.content.trim().length > 0) || chatStreaming)
                      ? (light ? 'border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-500 hover:text-red-700' : 'border-white/20 text-white/90 hover:bg-red-600/20 hover:border-red-600/60')
                      : (light ? 'border-gray-200 text-gray-400 hover:bg-gray-100' : 'border-white/10 text-white/40 hover:bg-red-600/10 hover:border-red-600/30')}`}
                  >Tøm</button>
                )}
            </div>
            {/* Output region with smooth height transitions */}
            {/* Ensure research/chat output wrapper only mounts when there's content or activity */}
            {(() => {
              const hasResearchContent = Boolean(researchText || translatedResearchText || researchStructured || researchError || researchStatus === 'running' || researchStatus === 'queued')
              const hasChatContent = chatMessages.some(m => m.content.trim().length > 0) || chatStreaming || chatError
              const showOutputWrapper = uiMode === 'research' ? hasResearchContent : hasChatContent
              return showOutputWrapper
            })() && (
              <div className="relative mt-3">
                {uiMode === 'research' ? (
                  <div>
                    {researchError && (
                      <div className="text-sm text-red-400">{researchError}</div>
                    )}
                    {(researchRunId || lastRunStatus) && (
                      <div className="mt-2 text-[11px] text-gray-400">
                        {(() => {
                          void infoTick
                          const bits: string[] = []
                          const base = String(lastRunStatus || researchStatus)
                          const hasOutput = Boolean(researchStructured || translatedResearchText || researchText)
                          const derived = (() => {
                            if (isComposing) return 'composing'
                            if (researchStatus === 'queued' || researchStatus === 'running') return base
                            return base
                          })()
                          bits.push(`Info: runId=${researchRunId || '—'} • status=${derived}`)
                          if (lastPollAt && !hasOutput) bits.push(`polled ${Math.max(0, Math.round((Date.now() - lastPollAt) / 1000))}s ago`)
                          return bits.join(' • ')
                        })()}
                      </div>
                    )}
                    {(researchStatus === 'running' || researchStatus === 'queued') && (
                      <div className={`flex items-center gap-3 text-sm mt-3 ${light ? 'text-gray-600' : 'text-gray-300'}`}>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                        Hugin søker… Dette kan ta litt tid.
                      </div>
                    )}
                    {researchStructured && (
                      <div className={`mt-4 text-sm leading-6 ${light ? 'text-gray-800' : 'text-gray-100'}`}>
                        {renderStructuredResearch(researchStructured)}
                      </div>
                    )}
                    {!researchStructured && (translatedResearchText || researchText) && (
                      <div className={`mt-4 text-sm leading-6 ${light ? 'text-gray-800' : 'text-gray-100'}`}>
                        {renderResearchWithLinksAndBasis(translatedResearchText || researchText, researchBasis)}
                      </div>
                    )}
                  </div>
                ) : (
                  (() => {
                    const hasChatContentInner = chatMessages.some(m => m.content.trim().length > 0)
                    if (!hasChatContentInner && !chatStreaming && !chatError) return null
                    return (
                      <div className={`text-sm leading-6 ${light ? 'text-gray-800' : 'text-gray-100'}`}>
                        <div className="relative">
                          <div
                            ref={chatScrollRef}
                            className={`max-h-[55vh] overflow-y-auto pr-2 transition-[min-height] duration-200 scrollbar-thin scrollbar-track-transparent ${light ? 'scrollbar-thumb-gray-300' : 'scrollbar-thumb-white/10'} ${chatMessages.filter(m=>m.content.trim()).length <= 2 ? 'min-h-[40px]' : 'min-h-[200px]'}`}
                            style={{ scrollbarWidth: 'thin' }}
                          >
                            {chatMessages.map((m, idx) => (
                              <div key={m.id} className={`pb-4 ${idx === chatMessages.length - 1 ? 'pb-0' : ''}`}>
                                {m.role === 'user' && <div className="text-[11px] uppercase tracking-wide mb-1 text-gray-500">Du</div>}
                                {m.role === 'assistant' && <div className="text-[11px] uppercase tracking-wide mb-1 text-gray-500">Hugin</div>}
                                <div className={`whitespace-pre-wrap leading-6 ${light ? 'text-gray-800' : 'text-gray-200'}`}>{m.content || (m.role === 'assistant' && chatStreaming ? <span className="opacity-60">Søker…</span> : '')}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {chatError && <div className="text-xs text-red-400 mt-3">{chatError}</div>}
                      </div>
                    )
                  })()
                )}
              </div>
            )}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
              <div className="text-lg text-gray-400">Laster selskapsdata...</div>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-lg text-red-400 mb-4">Feil</div>
              <div className="text-gray-400">{error}</div>
            </div>
          </div>
        ) : topCompany ? (
          <div className="w-full">
            {/* Company Details */}
            <div className="border border-white/10 p-6 mb-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">{topCompany.name}</h2>
                  {topCompany.summary && (
                    <p className="text-sm text-gray-300 max-w-3xl whitespace-pre-wrap">{topCompany.summary}</p>
                  )}
                </div>
                {topCompany.website && topCompany.website.trim() && (
                  <a 
                    href={topCompany.website.startsWith('http') ? topCompany.website : `https://${topCompany.website}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-4 py-2 border border-white/20 text-white/90 hover:bg-red-600/20 hover:border-red-600/60 focus:outline-none focus:ring-1 focus:ring-red-600/40 transition-colors"
                  >
                    Besøk nettside
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Grunnleggende informasjon</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-300">Organisasjonsnummer:</span>
                      <div className="text-white">{topCompany.orgNumber}</div>
                    </div>
                    {topCompany.registeredAtBrreg && (
                      <div>
                        <span className="font-medium text-gray-300">Registreringsdato:</span>
                        <div className="text-white">{formatDateEU(topCompany.registeredAtBrreg)}</div>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-gray-300">Daglig leder:</span>
                      <div className="text-white">{topCompany.ceo || '—'}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Antall ansatte:</span>
                      <div className="text-white">{topCompany.employees ?? '—'}</div>
                    </div>
                    
                  </div>
                </div>

                {/* Income Statement */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Resultatregnskap</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-300">Sum driftsinntekter:</span>
                      <div className="text-white">
                        {(topCompany.sumDriftsinntekter || topCompany.operatingIncome || topCompany.revenue) == null ? '—' : 
                         `${fmt(topCompany.sumDriftsinntekter || topCompany.operatingIncome || topCompany.revenue)} ${topCompany.valuta || 'NOK'}${topCompany.fiscalYear ? ` (${topCompany.fiscalYear})` : ''}`}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Driftsresultat:</span>
                      <div className="text-white">
                        {(topCompany.driftsresultat || topCompany.operatingResult) == null ? '—' : 
                         `${fmt(topCompany.driftsresultat || topCompany.operatingResult)} ${topCompany.valuta || 'NOK'}`}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Ordinært resultat før skatt:</span>
                      <div className="text-white">
                        {topCompany.profitBeforeTax == null ? '—' : 
                         `${fmt(topCompany.profitBeforeTax)} ${topCompany.valuta || 'NOK'}`}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Årsresultat:</span>
                      <div className="text-white">
                        {(topCompany.aarsresultat || topCompany.profit) == null ? '—' : 
                         `${fmt(topCompany.aarsresultat || topCompany.profit)} ${topCompany.valuta || 'NOK'}`}
                      </div>
                    </div>
                    
                  </div>
                </div>

                {/* Balance Sheet - Assets */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Balanse - Eiendeler</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-300">Sum eiendeler:</span>
                      <div className="text-white">
                        {(topCompany.sumEiendeler || topCompany.totalAssets) == null ? '—' : 
                         `${fmt(topCompany.sumEiendeler || topCompany.totalAssets)} ${topCompany.valuta || 'NOK'}`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Balance Sheet - Equity & Liabilities */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Balanse - Egenkapital og gjeld</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-300">Sum egenkapital:</span>
                      <div className="text-white">
                        {(topCompany.sumEgenkapital || topCompany.equity) == null ? '—' : 
                         `${fmt(topCompany.sumEgenkapital || topCompany.equity)} ${topCompany.valuta || 'NOK'}`}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Sum gjeld:</span>
                      <div className="text-white">
                        {topCompany.sumGjeld == null ? '—' : 
                         `${fmt(topCompany.sumGjeld)} ${topCompany.valuta || 'NOK'}`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Report Period */}
                {(topCompany.fraDato || topCompany.tilDato) && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Regnskapsperiode</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">Periode:</span>
                        <div className="text-white">
                          {topCompany.fraDato && topCompany.tilDato 
                            ? `${formatEventDate(topCompany.fraDato)} - ${formatEventDate(topCompany.tilDato)}`
                            : topCompany.fraDato 
                              ? `Fra ${formatEventDate(topCompany.fraDato)}`
                              : topCompany.tilDato
                                ? `Til ${formatEventDate(topCompany.tilDato)}`
                                : '—'
                          }
                        </div>
                      </div>
                      {topCompany.valuta && (
                        <div>
                          <span className="font-medium text-gray-300">Valuta:</span>
                          <div className="text-white">{topCompany.valuta}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {/* Location & Industry */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Lokasjon og bransje</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-300">Adresse:</span>
                      <div className="text-white">
                        {[
                          topCompany.addressStreet,
                          topCompany.addressPostalCode,
                          topCompany.addressCity,
                        ].filter(Boolean).join(', ') || '—'}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Primær bransje:</span>
                      <div className="text-white">
                        {topCompany.industryCode1 ? `${topCompany.industryCode1} ${topCompany.industryText1 || ''}`.trim() : '—'}
                      </div>
                    </div>
                    {topCompany.industryCode2 && (
                      <div>
                        <span className="font-medium text-gray-300">Sekundær bransje:</span>
                        <div className="text-white">
                          {`${topCompany.industryCode2} ${topCompany.industryText2 || ''}`.trim()}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-gray-300">Sektor:</span>
                      <div className="text-white">
                        {topCompany.sectorCode ? `${topCompany.sectorCode} ${topCompany.sectorText || ''}`.trim() : '—'}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Organisasjonsform:</span>
                      <div className="text-white">{topCompany.orgFormText || topCompany.orgFormCode || '—'}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">MVA-registrert:</span>
                      <div className="text-white">
                        {topCompany.vatRegistered === true ? 'Ja' : topCompany.vatRegistered === false ? 'Nei' : '—'}
                        {topCompany.vatRegisteredDate && ` (${formatEventDate(topCompany.vatRegisteredDate)})`}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* Events Section */}
            <div className="border border-white/10 p-6 mb-8 overflow-x-hidden">
              <h3 className="text-xl font-semibold mb-4">Siste nyheter og hendelser</h3>
              {events.length === 0 ? (
                <div className="text-gray-400">Ingen hendelser tilgjengelig</div>
              ) : (
                <div className="space-y-4">
                  {events.map((event, idx) => (
                    <div key={(event.id ?? idx) as React.Key} className="border border-white/10 p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-white mb-2 break-words">
                            {event.title || 'Untitled event'}
                          </h4>
                          {event.description && (
                            <p className="text-gray-300 text-sm mb-3 leading-relaxed break-words break-all overflow-x-hidden">
                              {event.description}
                            </p>
                          )}
                          {event.url && (
                            <a 
                              href={event.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-sky-400 hover:text-sky-300 underline text-sm break-all inline-block max-w-full overflow-x-hidden"
                            >
                              Les mer
                            </a>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 max-w-[40%] break-words">
                          <div className="text-xs text-gray-400 mb-2">
                            {formatEventDate(event.date)}
                          </div>
                          {event.source && (
                            <span className={`inline-block px-2 py-1 text-[11px] bg-white/5 border border-white/20 ${light ? 'text-black' : 'text-gray-200'}`}>
                              {event.source.replace(/_/g, ' ').charAt(0).toUpperCase() + event.source.replace(/_/g, ' ').slice(1)}
                            </span>
                          )}
                          {event.score !== null && event.score !== undefined && (
                            <div className="text-xs text-gray-400 mt-1">
                              Score: {numberFormatter.format(event.score as number)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Website Stats Section */}
            {topCompany.website && (topCompany.webFinalUrl || topCompany.webStatus || topCompany.webTlsValid !== null) && (
              <div className="border border-white/10 p-6 mb-8">
                <h3 className="text-xl font-semibold mb-4">Nettstedsanalyse</h3>
                <p className="text-sm text-gray-400 mb-4">Webanalyse-data er tilgjengelig for denne bedriften</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  
                  {/* Basic Web Info */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">Grunnleggende informasjon</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">URL:</span>
                        <div className="text-white break-all">{topCompany.webFinalUrl || topCompany.website || '—'}</div>
                    </div>
                      <div>
                        <span className="font-medium text-gray-300">Status:</span>
                        <div className="text-white">{topCompany.webStatus || '—'}</div>
                  </div>
                      <div>
                        <span className="font-medium text-gray-300">Response tid:</span>
                        <div className="text-white">{topCompany.webElapsedMs ? `${topCompany.webElapsedMs}ms` : '—'}</div>
                    </div>
                      <div>
                        <span className="font-medium text-gray-300">IP-adresse:</span>
                        <div className="text-white">{topCompany.webIp || '—'}</div>
                  </div>
                      <div>
                        <span className="font-medium text-gray-300">HTML størrelse:</span>
                        <div className="text-white">{topCompany.webHtmlKb ? `${topCompany.webHtmlKb}KB` : '—'}</div>
                    </div>
                  </div>
                </div>
                
                  {/* TLS/Security */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">Sikkerhet & TLS</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">TLS gyldig:</span>
                        <div className="text-white">
                          {topCompany.webTlsValid === true ? 'Ja' : topCompany.webTlsValid === false ? 'Nei' : '—'}
                    </div>
                  </div>
                      <div>
                        <span className="font-medium text-gray-300">TLS utsteder:</span>
                        <div className="text-white">{topCompany.webTlsIssuer || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Dager til utløp:</span>
                        <div className="text-white">{topCompany.webTlsDaysToExpiry || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">HSTS:</span>
                        <div className="text-white">
                          {topCompany.webSecurityHsts === true ? 'Ja' : topCompany.webSecurityHsts === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">CSP:</span>
                        <div className="text-white">
                          {topCompany.webSecurityCsp === true ? 'Ja' : topCompany.webSecurityCsp === false ? 'Nei' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CMS & Technology */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">CMS & Teknologi</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">Primær CMS:</span>
                        <div className="text-white">{topCompany.webPrimaryCms || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">WordPress:</span>
                        <div className="text-white">
                          {topCompany.webCmsWordpress === true ? 'Ja' : topCompany.webCmsWordpress === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Shopify:</span>
                        <div className="text-white">
                          {topCompany.webCmsShopify === true ? 'Ja' : topCompany.webCmsShopify === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">React:</span>
                        <div className="text-white">
                          {topCompany.webJsReact === true ? 'Ja' : topCompany.webJsReact === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Next.js:</span>
                        <div className="text-white">
                          {topCompany.webJsNextjs === true ? 'Ja' : topCompany.webJsNextjs === false ? 'Nei' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Analytics & Marketing */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">Analytics & Markedsføring</h4>
                    <div className="space-y-3 text-sm">
                                           <div>
                        <span className="font-medium text-gray-300">Google Analytics 4:</span>
                                               <div className="text-white">
                          {topCompany.webAnalyticsGa4 === true ? 'Ja' : topCompany.webAnalyticsGa4 === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Google Tag Manager:</span>
                        <div className="text-white">
                          {topCompany.webAnalyticsGtm === true ? 'Ja' : topCompany.webAnalyticsGtm === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Facebook Pixel:</span>
                        <div className="text-white">
                          {topCompany.webAnalyticsFbPixel === true ? 'Ja' : topCompany.webAnalyticsFbPixel === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">LinkedIn Insight:</span>
                        <div className="text-white">
                          {topCompany.webAnalyticsLinkedin === true ? 'Ja' : topCompany.webAnalyticsLinkedin === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Hotjar:</span>
                        <div className="text-white">
                          {topCompany.webAnalyticsHotjar === true ? 'Ja' : topCompany.webAnalyticsHotjar === false ? 'Nei' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* E-commerce & Payments */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">E-handel & Betalinger</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">WooCommerce:</span>
                        <div className="text-white">
                          {topCompany.webEcomWoocommerce === true ? 'Ja' : topCompany.webEcomWoocommerce === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Magento:</span>
                        <div className="text-white">
                          {topCompany.webEcomMagento === true ? 'Ja' : topCompany.webEcomMagento === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Stripe:</span>
                        <div className="text-white">
                          {topCompany.webPayStripe === true ? 'Ja' : topCompany.webPayStripe === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">PayPal:</span>
                        <div className="text-white">
                          {topCompany.webPayPaypal === true ? 'Ja' : topCompany.webPayPaypal === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Klarna:</span>
                        <div className="text-white">
                          {topCompany.webPayKlarna === true ? 'Ja' : topCompany.webPayKlarna === false ? 'Nei' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Server & Headers */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">Server & Headers</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">Server:</span>
                        <div className="text-white">{topCompany.webHeaderServer || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">X-Powered-By:</span>
                        <div className="text-white">{topCompany.webHeaderXPoweredBy || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">CDN Hint:</span>
                        <div className="text-white">{topCompany.webCdnHint || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Server Hint:</span>
                        <div className="text-white">{topCompany.webServerHint || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Cookies:</span>
                        <div className="text-white">
                          {topCompany.webCookiesPresent === true ? 'Ja' : topCompany.webCookiesPresent === false ? 'Nei' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact & Content */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">Kontakt & Innhold</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">E-post på nettside:</span>
                        <div className="text-white">
                          {topCompany.webHasEmailText === true ? 'Ja' : topCompany.webHasEmailText === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Telefon på nettside:</span>
                        <div className="text-white">
                          {topCompany.webHasPhoneText === true ? 'Ja' : topCompany.webHasPhoneText === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">HTML &gt; 500KB:</span>
                        <div className="text-white">
                          {topCompany.webHtmlKbOver500 === true ? 'Ja' : topCompany.webHtmlKbOver500 === false ? 'Nei' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Risk Assessment */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">Risikovurdering</h4>
                    <div className="space-y-3 text-sm">
                      
                      <div>
                        <span className="font-medium text-gray-300">Placeholder nettside:</span>
                        <div className="text-white">
                          {topCompany.webRiskPlaceholderKw === true ? 'Ja' : topCompany.webRiskPlaceholderKw === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Parkert domene:</span>
                        <div className="text-white">
                          {topCompany.webRiskParkedKw === true ? 'Ja' : topCompany.webRiskParkedKw === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Suspendert:</span>
                        <div className="text-white">
                          {topCompany.webRiskSuspendedKw === true ? 'Ja' : topCompany.webRiskSuspendedKw === false ? 'Nei' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Website Data Not Available */}
            {topCompany.website && !(topCompany.webFinalUrl || topCompany.webStatus || topCompany.webTlsValid !== null) && (
              <div className="border border-white/10 p-6 mb-8">
                <h3 className="text-xl font-semibold mb-4">Nettstedsanalyse</h3>
                <p className="text-sm text-gray-400">Webanalyse-data er ikke tilgjengelig for denne bedriften ennå.</p>
                <p className="text-sm text-gray-500 mt-2">
                  Nettsted: 
                  <a 
                    href={topCompany.website.startsWith('http') ? topCompany.website : `https://${topCompany.website}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-sky-400 hover:text-sky-300 underline"
                  >
                    {topCompany.website}
                  </a>
                </p>
              </div>
            )}

          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-lg text-gray-400 mb-2">Ingen selskapsdata</div>
              <div className="text-sm text-gray-500">Søk etter et selskap for å starte.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompanyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
        <div className="text-lg text-gray-400">Loading...</div>
      </div>
    </div>}>
      <CompanyPageContent />
    </Suspense>
  )
}
