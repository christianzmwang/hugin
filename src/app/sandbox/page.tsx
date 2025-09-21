"use client"
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type ScanItem = { orgNumber: string; name?: string | null; website?: string | null; revenue?: number | null; webHtmlKb?: number | null; webStatus?: number | null; webFinalUrl?: string | null; stats: Record<string, { present: boolean; count: number; density: number }> }

export default function SandboxPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // All useState hooks must be at the top level
  const [kwInput, setKwInput] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState<ScanItem[]>([])
  const [sortKey, setSortKey] = useState<string | null>('org')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState<number>(500)
  const [progress, setProgress] = useState<string[]>([])
  const [progressRef, setProgressRef] = useState<HTMLDivElement | null>(null)
  const [scanProgress, setScanProgress] = useState<{percentage: number, processed: number, total: number} | null>(null)
  const [scanStartTime, setScanStartTime] = useState<number | null>(null)
  const [maxAvailable, setMaxAvailable] = useState<number | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) router.push('/auth/signin')
  }, [status, session, router])

  useEffect(() => {
    // Fetch the maximum available count of companies with websites
    const fetchMaxAvailable = async () => {
      try {
        const res = await fetch('/api/businesses/website-count')
        if (res.ok) {
          const data = await res.json()
          setMaxAvailable(data.maxAvailable)
        }
      } catch (e) {
        console.error('Failed to fetch max available count:', e)
      }
    }
    
    if (session) {
      fetchMaxAvailable()
    }
  }, [session])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <div className="text-lg text-gray-400">Loading...</div>
        </div>
      </div>
    )
  }

  if (!session) return null

  // Keyword scan (moved from search page)
  const TOP_REVENUE_DEFAULT = 40000
  const toggleSort = (col: string) => {
    if (sortKey !== col) {
      setSortKey(col)
      setSortDir(col === 'org' ? 'asc' : 'desc')
      return
    }
    // same column
    if (sortDir === 'desc') {
      setSortDir('asc')
    } else {
      // third click disables sorting
      setSortKey(null)
    }
  }

  // Auto-scroll progress log to bottom
  const addProgressLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `[${timestamp}] ${message}`
    setProgress(prev => {
      const newProgress = [...prev, logEntry]
      // Auto-scroll after state update
      setTimeout(() => {
        if (progressRef) {
          progressRef.scrollTop = progressRef.scrollHeight
        }
      }, 10)
      return newProgress
    })
  }

  const runScan = async () => {
    if (keywords.length === 0) return
    setScanning(true); setError(null); setProgress([]); setResults([])
    setScanProgress(null); setScanStartTime(Date.now())
    
    try {
      addProgressLog('Starting streaming scan request')
      const payload = { keywords, topRevenue: TOP_REVENUE_DEFAULT, limit }
      addProgressLog(`POST /api/businesses/web-keyword-scan-stream limit=${limit}`)
      
      const res = await fetch('/api/businesses/web-keyword-scan-stream', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      })
      
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || 'Scan failed')
      }
      
      if (!res.body) {
        throw new Error('No response body')
      }
      
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const allResults: ScanItem[] = []
      
      addProgressLog('Connected to streaming endpoint')
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        
        // Process complete SSE messages
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || '' // Keep incomplete message in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              switch (data.type) {
                case 'metadata':
                  addProgressLog(`Scan initialized: ${data.totalOrgNumbers} companies to process`)
                  addProgressLog(`Keywords: ${data.keywords.join(', ')}`)
                  if (data.maxAvailable) {
                    addProgressLog(`Total companies with websites available: ${data.maxAvailable.toLocaleString()}`)
                  }
                  setScanProgress({percentage: 0, processed: 0, total: data.totalOrgNumbers})
                  break
                  
                case 'progress':
                  allResults.push(...data.batchResults)
                  setResults([...allResults])
                  setScanProgress({
                    percentage: data.percentage, 
                    processed: data.processed, 
                    total: data.total
                  })
                  
                  const elapsed = Date.now() - (scanStartTime || Date.now())
                  const rate = data.processed / (elapsed / 1000) // items per second
                  const remaining = data.total - data.processed
                  const eta = remaining / rate // seconds
                  const etaText = eta < 60 ? `${Math.round(eta)}s` : `${Math.round(eta/60)}m`
                  
                  const hasMatches = data.batchResults.some((item: ScanItem) => 
                    keywords.some(kw => item.stats[kw]?.present)
                  )
                  const matchesText = hasMatches ? ` (${data.batchResults.filter((item: ScanItem) => 
                    keywords.some(kw => item.stats[kw]?.present)
                  ).length} matches)` : ''
                  addProgressLog(`Progress: ${data.percentage}% (${data.processed}/${data.total}) - With web data: ${data.totalFound || data.batchResults.length} items${matchesText} - ETA: ${etaText}`)
                  break
                  
                case 'warning':
                  addProgressLog(`⚠️ ${data.message}`)
                  break
                  
                case 'complete':
                  const totalMatches = allResults.filter((item: ScanItem) => 
                    keywords.some(kw => item.stats[kw]?.present)
                  ).length
                  const totalTime = ((Date.now() - (scanStartTime || Date.now())) / 1000).toFixed(1)
                  addProgressLog(`✅ Scan completed in ${totalTime}s! Processed: ${data.totalProcessed || data.totalResults}, With web data: ${data.totalResults}, Keyword matches: ${totalMatches}`)
                  setScanProgress(null)
                  setScanning(false)
                  break
                  
                case 'error':
                  throw new Error(data.message)
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE message:', line, parseError)
            }
          }
        }
      }
      
    } catch (e: unknown) {
      const error = e as Error
      addProgressLog('Error: ' + (error.message || String(e)))
      setError(error.message || 'Error')
      setScanProgress(null)
      setScanning(false)
    }
  }

  const downloadCsv = async () => {
    if (keywords.length === 0) return
    addProgressLog('Starting CSV export...')
    try {
      // Use the original endpoint for CSV export since it has the proper CSV formatting
      const res = await fetch('/api/businesses/web-keyword-scan', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ keywords, topRevenue: TOP_REVENUE_DEFAULT, limit, exportCsv: true }) 
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || 'CSV export failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'web_keyword_scan.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      addProgressLog('CSV export completed')
    } catch (e: unknown) {
      const error = e as Error
      addProgressLog('CSV export error: ' + (error.message || String(e)))
    }
  }

  return (
    <div className="h-full overflow-hidden flex flex-col app-sandbox">
      <div className="flex-1 overflow-auto overflow-x-hidden p-6 space-y-8 bg-transparent">
        <div className="bg-gray-900 border border-white/10 p-6 space-y-4 sandbox-panel">
        <h1 className="text-lg font-semibold sandbox-heading">Keyword Scanner</h1>
        <p className="text-xs text-gray-400 leading-relaxed sandbox-muted">
          Keyword scanner for companies with websites. Set limit to 0 for all available{maxAvailable ? ` (${maxAvailable.toLocaleString()} companies with websites)` : ''}.
        </p>
        <div className="flex flex-wrap gap-2 items-center text-xs">
          <input
            value={kwInput}
            onChange={e=>setKwInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter'){ const v=kwInput.trim().toLowerCase(); if(v && !keywords.includes(v)){ setKeywords(p=>[...p,v]); setKwInput('') } } }}
            placeholder="Add keyword"
            className="px-2 py-1 bg-black/40 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-red-600/70 sandbox-input"
          />
          <button type="button" className="px-2 py-1 border border-white/20 text-white/80 hover:border-red-600/60 hover:bg-red-600/10 sandbox-btn" onClick={()=>{ const v=kwInput.trim().toLowerCase(); if(v && !keywords.includes(v)){ setKeywords(p=>[...p,v]); setKwInput('') } }}>Add</button>
          <div className="flex items-center gap-2">
            <label className="text-gray-400 sandbox-muted">Limit</label>
            <input
              type="text"
              inputMode="numeric"
              value={String(limit)}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9]/g,'')
                if (raw === '') { setLimit(0); return }
                const v = Number(raw)
                setLimit(Math.min(maxAvailable || 40000, v))
              }}
              className="w-28 px-2 py-1 bg-black/40 border border-white/20 text-white text-xs sandbox-input"
              placeholder="0 (all)"
            />
          </div>
          <button type="button" disabled={keywords.length===0 || scanning} onClick={runScan} className={`px-2 py-1 border text-white/80 text-xs flex items-center gap-1 sandbox-btn ${scanning? 'opacity-50 cursor-not-allowed border-white/10':'border-white/20 hover:border-red-600/60 hover:bg-red-600/10'}`}>
            {scanning && <div className="animate-spin rounded-full h-3 w-3 border border-white/40 border-t-white"></div>}
            {scanning? 'Scanning...' : 'Scan'}
          </button>
          <button type="button" disabled={keywords.length===0 || scanning || results.length===0} onClick={downloadCsv} className="px-2 py-1 border border-white/20 text-white/80 text-xs hover:border-red-600/60 hover:bg-red-600/10 sandbox-btn">Export CSV</button>
          {keywords.length>0 && (
            <button type="button" className="px-2 py-1 border border-white/20 text-white/60 text-xs hover:border-yellow-500/60 hover:bg-yellow-500/10 sandbox-btn" onClick={()=> setKeywords([])}>Clear keywords</button>
          )}
        </div>
        {keywords.length>0 && (
          <div className="flex flex-wrap gap-1">
            {keywords.map(k=> (
              <span key={k} className="group inline-flex items-center gap-1 text-[10px] px-2 py-1 border border-white/20 text-white/80 sandbox-chip">
                <span>{k}</span>
                <button type="button" className="opacity-0 group-hover:opacity-100" onClick={()=> setKeywords(prev=> prev.filter(x=>x!==k))}>×</button>
              </span>
            ))}
          </div>
        )}
        {error && <div className="text-xs text-red-400 sandbox-error">{error}</div>}
        {scanProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Progress: {scanProgress.processed}/{scanProgress.total}</span>
              <span>{scanProgress.percentage}%</span>
            </div>
            <div className="w-full bg-gray-700 h-2">
              <div 
                className="bg-red-600/70 h-2 transition-all duration-300" 
                style={{width: `${scanProgress.percentage}%`}}
              ></div>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 space-y-6 overflow-y-auto">
        {progress.length>0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm text-gray-400 sandbox-muted">Progress Log</h3>
              <button 
                type="button" 
                onClick={() => setProgress([])}
                className="px-2 py-1 text-xs border border-white/20 text-white/60 hover:border-yellow-500/60 hover:bg-yellow-500/10 sandbox-btn"
              >
                Clear Log
              </button>
            </div>
            <div 
              ref={setProgressRef}
              className="bg-black/40 border border-white/10 p-3 max-h-80 overflow-auto text-[10px] font-mono whitespace-pre-wrap leading-relaxed scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent sandbox-log"
            >
              {progress.map((p,i)=>(<div key={i} className="mb-1">{p}</div>))}
            </div>
          </div>
        )}
        {results.length>0 ? (
          <div className="overflow-x-auto border border-white/10 sandbox-table-wrap">
            <table className="min-w-full text-xs sandbox-table">
              <thead className="bg-black/60">
                <tr>
                  <Sortable label="Org" col="org" sortKey={sortKey} sortDir={sortDir} setSort={(k)=> toggleSort(k)} />
                  <Sortable label="Name" col="name" sortKey={sortKey} sortDir={sortDir} setSort={(k)=> toggleSort(k)} />
                  <Sortable label="Revenue" col="revenue" sortKey={sortKey} sortDir={sortDir} setSort={(k)=> toggleSort(k)} />
                  <th className="px-2 py-2 text-left font-semibold">Website</th>
                  <th className="px-2 py-2 text-left font-semibold">Status</th>
                  <th className="px-2 py-2 text-left font-semibold">KB</th>
                  <Sortable label="Total kw count" col="kwCount" sortKey={sortKey} sortDir={sortDir} setSort={(k)=> toggleSort(k)} />
                  {keywords.map(k=> (
                    <Sortable key={k+':count'} label={`${k} count`} col={`kwCount:${k}`} sortKey={sortKey} sortDir={sortDir} setSort={(c)=>toggleSort(c)} />
                  ))}
                </tr>
              </thead>
              <tbody>
        {sortResults(results, keywords, sortKey, sortDir).map(r=> {
                  const totalCount = keywords.reduce((acc,k)=> acc + (r.stats[k]?.count||0),0)
                  return (
          <tr key={r.orgNumber} className={`odd:bg-black/30 even:bg-black/10 ${scanning ? 'opacity-60' : 'cursor-pointer hover:bg-red-600/10'} sandbox-row`} onClick={scanning ? undefined : () => router.push(`/company?orgNumber=${encodeURIComponent(r.orgNumber)}`)}>
                      <td className="px-2 py-1 whitespace-nowrap font-mono text-[11px]">{r.orgNumber}</td>
                      <td className="px-2 py-1">{r.name || ''}</td>
                      <td className="px-2 py-1">{r.revenue != null ? r.revenue : ''}</td>
                      <td className="px-2 py-1 max-w-[160px] truncate">{r.website ? <a href={r.website.startsWith('http')? r.website: `https://${r.website}`} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">{r.website}</a>: ''}</td>
                      <td className="px-2 py-1">{r.webStatus ?? ''}</td>
                      <td className="px-2 py-1">{r.webHtmlKb ?? ''}</td>
                      <td className="px-2 py-1">{totalCount}</td>
                      {keywords.map(k=> <td key={k} className="px-2 py-1">{r.stats[k]?.count ?? 0}</td>)}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-xs text-gray-500">No results yet. Add keywords and scan.</div>
        )}
        </div>
      </div>
    </div>
  )
}

// Sorting helpers
function sortResults(items: ScanItem[], kws: string[], key: (string|null), dir:'asc'|'desc') {
  if (!key) return items
  const mul = dir === 'asc' ? 1 : -1
  return [...items].sort((a,b)=> {
    const totalA = kws.reduce((acc,k)=> acc + (a.stats[k]?.count||0),0)
    const totalB = kws.reduce((acc,k)=> acc + (b.stats[k]?.count||0),0)
    const bestA = kws.reduce((mx,k)=> Math.max(mx, (a.stats[k]?.density||0)),0)
    const bestB = kws.reduce((mx,k)=> Math.max(mx, (b.stats[k]?.density||0)),0)
  const aHas = bestA > 0
  const bHas = bestB > 0
  if (aHas !== bHas) return aHas ? -1 : 1
    let va: string | number; let vb: string | number
    if (key === 'org') { va=a.orgNumber; vb=b.orgNumber }
    else if (key === 'name') { va=a.name||''; vb=b.name||'' }
    else if (key === 'revenue') { va=a.revenue??-Infinity; vb=b.revenue??-Infinity }
    else if (key === 'kwCount') { va=totalA; vb=totalB }
  else if (key.startsWith('kwCount:')) {
      const kw = key.split(':',2)[1]
      va = a.stats[kw]?.count||0; vb = b.stats[kw]?.count||0
    } else { return 0 }
    if (va < vb) return -1*mul
    if (va > vb) return 1*mul
    return 0
  })
}

type SortableProps = { label: string; col: string; sortKey: string | null; sortDir:'asc'|'desc'; setSort:(col: string)=> void }
function Sortable({ label, col, sortKey, sortDir, setSort }: SortableProps) {
  const active = sortKey === col
  return (
    <th
      onClick={()=> setSort(col)}
      className={`px-2 py-2 text-left font-semibold select-none cursor-pointer ${active? 'text-white':'text-white/90'}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (<span className="text-[9px] opacity-70">{sortDir==='asc'? '▲':'▼'}</span>)}
      </span>
    </th>
  )
}
