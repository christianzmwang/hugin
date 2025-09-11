'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'

type ListSummary = { id: number; name: string; itemCount: number }
type ListItem = { orgNumber: string; name: string | null }
type FullList = { id: number; name: string; items: ListItem[] }

// Shape of a business detail object we read minimal fields from. Extra dynamic keys allowed.
interface BusinessDetail {
  orgNumber: string
  name?: string | null
  website?: string | null
  employees?: number | null
  revenue?: number | null
  profit?: number | null
  addressStreet?: string | null
  addressPostalCode?: string | null
  addressCity?: string | null
  industryCode1?: string | null
  industryText1?: string | null
  sectorCode?: string | null
  sectorText?: string | null
  ceo?: string | null
  [k: string]: unknown
}

// Basic fields we allow user to pick for CSV export (UI only)
const FIELD_OPTIONS: { key: string; label: string; default?: boolean }[] = [
  { key: 'orgNumber', label: 'Org number', default: true },
  { key: 'name', label: 'Name', default: true },
  { key: 'website', label: 'Website' },
  { key: 'employees', label: 'Employees' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'profit', label: 'Profit' },
  { key: 'address', label: 'Address' },
  { key: 'industry', label: 'Industry' },
  { key: 'sector', label: 'Sector' },
  { key: 'ceo', label: 'CEO' },
]

function ExportPageInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const sp = useSearchParams()
  const listIdParam = sp?.get('listId') || ''
  const listId = listIdParam ? parseInt(listIdParam, 10) : null
  const [lists, setLists] = useState<ListSummary[]>([])
  const [listsLoading, setListsLoading] = useState(false)
  const [activeList, setActiveList] = useState<FullList | null>(null)
  const [activeLoading, setActiveLoading] = useState(false)
  const [fieldState, setFieldState] = useState<Record<string, boolean>>(() => FIELD_OPTIONS.reduce((acc, f) => { acc[f.key] = !!f.default; return acc }, {} as Record<string, boolean>))
  const [csvGenerating, setCsvGenerating] = useState(false)
  const [csvBlobUrl, setCsvBlobUrl] = useState<string | null>(null)
  const [emailMode, setEmailMode] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailPhase, setEmailPhase] = useState<'idle' | 'processing' | 'fetching' | 'done'>('idle')
  const businessCacheRef = useRef<Record<string, BusinessDetail>>({})
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [progressTotal, setProgressTotal] = useState(0)
  const [progressDone, setProgressDone] = useState(0)
  // Precompute percentage string to avoid complex template nesting in JSX
  const progressPercent = useMemo(() => {
    if (!progressTotal || progressTotal <= 0) return '0%'
    const pct = Math.min(100, (progressDone / progressTotal) * 100)
    return pct.toFixed(2) + '%'
  }, [progressDone, progressTotal])
  // CSV import related state
  const [importParsing, setImportParsing] = useState(false)
  const [importOrgNumbers, setImportOrgNumbers] = useState<string[] | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importFileName, setImportFileName] = useState('')
  const [importListName, setImportListName] = useState('')
  const [importCreating, setImportCreating] = useState(false)
  const IMPORT_MAX = 5000

  // Guard auth
  useEffect(() => {
    if (status === 'loading') return
    if (!session) router.push('/auth/signin')
  }, [status, session, router])

  const selectList = useCallback(async (id: number) => {
    setActiveLoading(true)
    setActiveList(null)
    setCsvBlobUrl(null)
    try {
      const res = await fetch(`/api/lists/${id}`)
      const json = await res.json()
      if (json?.item) {
        setActiveList({ id: json.item.id, name: json.item.name, items: json.item.items || [] })
      }
    } finally { setActiveLoading(false) }
  }, [])

  // Fetch lists (refactored so we can reuse after import)
  const loadLists = useCallback(async (opts?: { selectId?: number }) => {
    if (!session) return
    setListsLoading(true)
    try {
      const res = await fetch('/api/lists', { cache: 'no-store' })
      const json = await res.json()
      const arr = Array.isArray(json) ? json : json.items || []
      const mapped: ListSummary[] = arr.map((r: Partial<ListSummary>) => ({ id: Number(r.id), name: String(r.name), itemCount: Number(r.itemCount) }))
      setLists(mapped)
      if (opts?.selectId) {
        const found = mapped.find(l => l.id === opts.selectId)
        if (found) selectList(found.id)
      } else if (listId) {
        const found = mapped.find(l => l.id === listId)
        if (found) selectList(found.id)
      }
    } finally { setListsLoading(false) }
  }, [session, listId, selectList])

  useEffect(() => { if (session) { loadLists() } }, [session, loadLists])

  // moved selectList earlier

  const toggleField = (k: string) => setFieldState(s => ({ ...s, [k]: !s[k] }))

  const selectedFields = useMemo(() => FIELD_OPTIONS.filter(f => fieldState[f.key]).map(f => f.key), [fieldState])

  const neededExtraFields = useMemo(() => selectedFields.filter(f => !['orgNumber','name'].includes(f)), [selectedFields])

  const fetchBusinessDetail = async (org: string): Promise<BusinessDetail | null> => {
    // If already cached return
    if (businessCacheRef.current[org]) return businessCacheRef.current[org]
    try {
      const res = await fetch(`/api/businesses?orgNumber=${encodeURIComponent(org)}&skipCount=1&limit=1`)
      const json = await res.json()
      const item = Array.isArray(json) ? json[0] : (json.items?.[0])
      if (item && item.orgNumber) {
        businessCacheRef.current[org] = item
        return item
      }
    } catch {}
    return null
  }

  const fetchAllDetails = async (orgNumbers: string[]) => {
    setDetailsLoading(true)
    const missing = orgNumbers.filter(o => !businessCacheRef.current[o])
    const limit = 5
    let idx = 0
    await Promise.all(new Array(limit).fill(0).map(async () => {
      while (true) {
        let current: string | undefined
        if (idx < missing.length) {
          current = missing[idx++]
        } else break
        await fetchBusinessDetail(current)
        setProgressDone(d => d + 1)
      }
    }))
    setDetailsLoading(false)
  }

  const csvEscape = (val: unknown) => {
    if (val == null) return ''
    const s = String(val)
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"'
    return s
  }

  const getFieldValue = (field: string, base: ListItem, detail: BusinessDetail | undefined): string => {
    if (field === 'orgNumber') return base.orgNumber
    if (field === 'name') return base.name || (detail?.name ?? '') || ''
    if (!detail) return ''
    switch (field) {
      case 'website': return detail.website || ''
      case 'employees': return detail.employees == null ? '' : String(detail.employees)
      case 'revenue': return detail.revenue == null ? '' : String(detail.revenue)
      case 'profit': return detail.profit == null ? '' : String(detail.profit)
      case 'address': return [detail.addressStreet, detail.addressPostalCode, detail.addressCity].filter(Boolean).join(', ')
      case 'industry': return detail.industryCode1 ? `${detail.industryCode1} ${detail.industryText1 || ''}`.trim() : ''
      case 'sector': return detail.sectorCode ? `${detail.sectorCode} ${detail.sectorText || ''}`.trim() : ''
      case 'ceo': return detail.ceo || ''
      default: return ''
    }
  }

  const generateCsv = async () => {
    if (!activeList) return
    setCsvGenerating(true)
    setCsvBlobUrl(null)
    if (neededExtraFields.length > 0) {
  setProgressTotal(activeList.items.length)
  setProgressDone(0)
      await fetchAllDetails(activeList.items.map(i => i.orgNumber))
    } else {
      // brief delay for consistent UX
      await new Promise(r => setTimeout(r, 150))
    }
    const header = selectedFields.join(',')
    const lines: string[] = []
    for (const it of activeList.items) {
      const detail = businessCacheRef.current[it.orgNumber]
      const row = selectedFields.map(f => csvEscape(getFieldValue(f, it, detail))).join(',')
      lines.push(row)
    }
    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    setCsvBlobUrl(url)
    setCsvGenerating(false)
  }

  // --- CSV IMPORT LOGIC ---
  const parseCsvText = (text: string): string[] => {
    // Basic CSV parser supporting quoted values. Returns array of all cells (flattened by rows)
    const rows: string[][] = []
    let cur: string[] = []
    let field = ''
    let inQuotes = false
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
        } else { field += ch }
      } else {
        if (ch === '"') { inQuotes = true }
        else if (ch === ',' || ch === ';') { cur.push(field); field = '' }
        else if (ch === '\n' || ch === '\r') {
          if (field.length > 0 || cur.length > 0) { cur.push(field); field = '' }
          if (cur.length > 0) { rows.push(cur); cur = [] }
        } else { field += ch }
      }
    }
    if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur) }
    // If single column header looks like orgNumber remove it
    const flat: string[] = []
    for (const r of rows) {
      for (const c of r) flat.push(c.trim())
    }
    return flat
  }

  const extractOrgNumbers = (cells: string[]): string[] => {
    const out: string[] = []
    for (const raw of cells) {
      if (!raw) continue
      const cleaned = raw.replace(/[^0-9]/g, '')
      if (cleaned.length >= 5 && cleaned.length <= 20) out.push(cleaned)
    }
    // Deduplicate preserve order
    const seen = new Set<string>()
    const uniq: string[] = []
    for (const o of out) { if (!seen.has(o)) { seen.add(o); uniq.push(o) } }
    return uniq
  }

  const handleCsvFile = async (file: File) => {
    setImportParsing(true)
    setImportError(null)
    setImportOrgNumbers(null)
    try {
      const text = await file.text()
      const cells = parseCsvText(text)
      let orgs = extractOrgNumbers(cells)
      // Drop header if first looks like non-numeric
      if (orgs.length > 0 && /[a-zA-Z]/.test(cells[0]) && cells[0].toLowerCase().includes('org')) {
        // Already handled by numeric extraction; nothing to do.
      }
      if (orgs.length === 0) {
        setImportError('No org numbers found in file.')
        return
      }
      if (orgs.length > IMPORT_MAX) {
        orgs = orgs.slice(0, IMPORT_MAX)
        setImportError(`Trimmed to first ${IMPORT_MAX} org numbers.`)
      }
      setImportOrgNumbers(orgs)
      const baseName = file.name.replace(/\.[^.]+$/, '')
      setImportFileName(file.name)
      setImportListName(baseName.slice(0, 60))
    } catch (e) {
      setImportError('Failed to parse CSV.')
    } finally { setImportParsing(false) }
  }

  const handleCreateImportedList = async () => {
    if (!importOrgNumbers || importOrgNumbers.length === 0 || !importListName || importCreating) return
    setImportCreating(true)
    try {
      const res = await fetch('/api/lists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: importListName, orgNumbers: importOrgNumbers }) })
      const json = await res.json()
      if (json?.ok && json.id) {
        // Refresh lists and select new one
        await loadLists({ selectId: Number(json.id) })
        // Reset import state
        setImportOrgNumbers(null)
        setImportListName('')
        setImportFileName('')
      } else {
        setImportError('Failed to create list.')
      }
    } catch { setImportError('Error during creation.') }
    finally { setImportCreating(false) }
  }

  const handleSendEmails = async () => {
    if (!activeList || emailSending) return
    setEmailSending(true)
    setEmailPhase('processing')
    // Persist campaign to backend so admin can view it
    try {
      const payload = {
        subject: emailSubject,
        body: emailBody,
        listId: activeList.id,
        orgNumbers: activeList.items.map(i => i.orgNumber)
      }
      await fetch('/api/email-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } catch {}
    // First phase: processing (queueing) 2-4s
    const firstDelay = 2000 + Math.random() * 2000
    await new Promise(r => setTimeout(r, firstDelay))
    // Second phase: fetching emails 2-6s
    setEmailPhase('fetching')
    const secondDelay = 2000 + Math.random() * 4000
    await new Promise(r => setTimeout(r, secondDelay))
    setEmailPhase('done')
    setEmailSending(false)
  }

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>
  }
  if (!session) return null

  return (
    <div className="h-full overflow-hidden flex flex-col app-export">
      <div className="flex-1 overflow-auto overflow-x-hidden p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-1 space-y-4">
          <div className="border border-white/10 bg-gray-900/60 p-4 export-panel">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-sm export-heading">Your Lists</h2>
              {listsLoading && <span className="text-[10px] text-gray-400">Loading…</span>}
            </div>
            <div className="space-y-1 max-h-72 overflow-auto text-sm">
              {lists.length === 0 && !listsLoading && <div className="text-gray-500 text-xs">No lists.</div>}
              {lists.map(l => (
                <button key={l.id} onClick={() => selectList(l.id)} className={`w-full text-left px-2 py-1 border border-transparent hover:border-red-600/40 hover:bg-red-600/10 ${activeList?.id === l.id ? 'bg-red-600/20 border-red-600/60' : ''}`}>
                  <div className="flex justify-between"><span className="truncate">{l.name}</span><span className="text-[10px] text-gray-400 ml-2">{l.itemCount}</span></div>
                </button>
              ))}
            </div>
          </div>
          <div className="border border-white/10 bg-gray-900/60 p-4 space-y-3 export-panel">
            <h3 className="font-medium text-sm">Import CSV</h3>
            <div className="text-[11px] text-gray-400 leading-relaxed">Upload a CSV containing org numbers (any column). Max {IMPORT_MAX} will be used. After import the list appears above.</div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvFile(f) }}
              className="block w-full text-xs text-gray-300 file:mr-2 file:py-1 file:px-2 file:border file:border-white/20 file:bg-black/40 file:text-xs file:hover:border-red-600/60"
            />
            {importParsing && <div className="text-[10px] text-gray-400">Parsing…</div>}
            {importError && <div className="text-[10px] text-red-400">{importError}</div>}
            {importOrgNumbers && !importParsing && (
              <div className="space-y-2">
                <div className="text-[10px] text-green-400">Found {importOrgNumbers.length} org numbers.</div>
                <input
                  type="text"
                  value={importListName}
                  onChange={e => setImportListName(e.target.value)}
                  placeholder="List name"
                  className="w-full bg-black/40 border border-white/10 px-2 py-1 text-xs focus:outline-none focus:border-red-600/60"
                />
                <button
                  disabled={!importListName || importOrgNumbers.length === 0 || importCreating}
                  onClick={handleCreateImportedList}
                  className="w-full text-xs px-3 py-1.5 border border-red-600/60 hover:bg-red-600/20 disabled:opacity-50"
                >
                  {importCreating ? 'Creating…' : 'Create List'}
                </button>
                <button
                  onClick={() => { setImportOrgNumbers(null); setImportListName(''); setImportFileName(''); setImportError(null) }}
                  className="w-full text-[10px] px-2 py-1 border border-white/10 hover:border-red-600/40"
                >Clear</button>
              </div>
            )}
          </div>
          {activeList && (
            <div className="border border-white/10 bg-gray-900/60 p-4 export-panel">
              <h3 className="font-medium text-sm mb-3">Fields (CSV)</h3>
              <div className="space-y-2 text-xs max-h-56 overflow-auto pr-1">
                {FIELD_OPTIONS.map(f => (
                  <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox" checked={fieldState[f.key]} onChange={() => toggleField(f.key)} className="checkbox-tech" />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
              <button disabled={csvGenerating || selectedFields.length === 0} onClick={generateCsv} className="mt-4 w-full text-xs px-3 py-2 border border-red-600/60 hover:bg-red-600/20 disabled:opacity-50">
                {csvGenerating ? (detailsLoading ? 'Fetching data…' : 'Generating…') : 'Generate CSV'}
              </button>
              {csvBlobUrl && (
                <a href={csvBlobUrl} download={`${activeList.name.replace(/[^a-z0-9_-]/gi,'_') || 'list'}.csv`} className="block mt-3 text-center text-xs px-3 py-2 border border-sky-600/60 hover:bg-sky-600/20">
                  Download CSV
                </a>
              )}
              {neededExtraFields.length > 0 && !csvGenerating && !csvBlobUrl && (
                <div className="mt-3 text-[10px] text-gray-500 leading-relaxed">Extra company data will be fetched when generating the CSV.</div>
              )}
            </div>
          )}
        </div>
        <div className="lg:col-span-3 space-y-6">
          <div className="border border-white/10 bg-gray-900/60 p-6 min-h-[300px] export-panel">
            {!activeList ? (
              activeLoading ? <div className="text-sm text-gray-400">Loading list…</div> : <div className="text-sm text-gray-400">Select a list to start.</div>
            ) : (
              <div>
                  <div className="flex flex-wrap items-center gap-4 mb-6">
                  <h2 className="text-xl font-semibold">{activeList.name}</h2>
                  <span className="text-xs text-gray-400">{activeList.items.length} companies</span>
                  <div className="ml-auto flex items-center gap-3 text-xs">
                    <button onClick={() => setEmailMode(false)} className={`px-3 py-1 border ${!emailMode ? 'border-red-600/70 bg-red-600/20' : 'border-white/20 hover:border-red-600/50'}`}>CSV Export</button>
                    <button onClick={() => setEmailMode(true)} className={`px-3 py-1 border ${emailMode ? 'border-red-600/70 bg-red-600/20' : 'border-white/20 hover:border-red-600/50'}`}>Email</button>
                  </div>
                </div>
                {!emailMode ? (
                  <div className="space-y-4 text-sm">
                    <p className="text-gray-300">Use the panel on the left to choose which fields you want to include. Then generate and download the CSV.</p>
                    {csvBlobUrl ? <div className="text-xs text-green-400">CSV ready. Use the download button.</div> : csvGenerating ? <div className="text-xs text-gray-400 animate-pulse">{detailsLoading ? 'Fetching company details…' : 'Building file…'}</div> : null}
                    {csvGenerating && neededExtraFields.length > 0 && progressTotal > 0 && (
                      <div className="space-y-1">
                        <div className="h-1 bg-white/10 overflow-hidden">
                          <div className="h-full bg-red-500 transition-all" style={{ width: progressPercent }} />
                        </div>
                        <div className="text-[10px] text-gray-400">{progressDone} / {progressTotal} companies</div>
                      </div>
                    )}
                    <div className="text-xs text-gray-500">All selected fields will be included.</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Subject" className="w-full bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-red-600/60" />
                    <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Write your message…" rows={10} className="w-full resize-y bg-black/40 border border-white/10 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:border-red-600/60" />
                    <div className="flex items-center gap-3">
                      <button
                        disabled={emailSending || !emailSubject || !emailBody}
                        onClick={handleSendEmails}
                        className="px-4 py-2 border border-red-600/60 text-sm hover:bg-red-600/20 disabled:opacity-50"
                      >
                        {emailPhase === 'processing' ? 'Queuing…' : emailPhase === 'fetching' ? 'Fetching…' : emailPhase === 'done' ? 'Send again' : 'Send'}
                      </button>
                      {emailPhase === 'processing' && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Loader2 className="animate-spin" size={14} />
                          <span>Preparing</span>
                        </span>
                      )}
                      {emailPhase === 'fetching' && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Loader2 className="animate-spin" size={14} />
                          <span className="animate-pulse">Fetching emails…</span>
                        </span>
                      )}
                      {emailPhase === 'done' && (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <Check size={14} className="animate-scale-in" />
                          <span>They will be queued and start sending from tomorrow.</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {activeList && !emailMode && (
            <div className="border border-white/5 bg-black/40 p-4 overflow-auto max-h-[300px] text-xs export-table-wrap">
              <table className="w-full border-collapse export-table">
                <thead>
                  <tr className="text-gray-400">
                    {selectedFields.map(f => <th key={f} className="text-left font-medium pb-2 pr-4">{f}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {activeList.items.slice(0, 25).map(row => {
                    const detail = businessCacheRef.current[row.orgNumber]
                    return (
                      <tr key={row.orgNumber} className="odd:bg-white/5">
                        {selectedFields.map(f => (
                          <td key={f} className="py-1 pr-4">
                            {getFieldValue(f, row, detail) || <span className="text-gray-600">—</span>}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {activeList.items.length > 25 && <div className="mt-2 text-gray-500">Showing first 25 / {activeList.items.length}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  )
}

// Wrap in Suspense to satisfy Next.js requirement for hooks like useSearchParams during prerender.
export default function ExportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>}>
      <ExportPageInner />
    </Suspense>
  )
}
