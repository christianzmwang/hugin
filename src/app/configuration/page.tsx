'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ConfigurationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session) router.push('/auth/signin')
  }, [status, session, router])

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

  return (
    <div className="p-6 w-full">
      <div className="w-full border border-white/10 p-6">
        <h2 className="text-xl font-semibold mb-4">Company profile</h2>
        <BusinessContextEditor />
      </div>
    </div>
  )
}

function BusinessContextEditor() {
  type Bc = {
    businessName: string
    orgNumber: string
    delivers: string
    icp: string
  }
  // Local cache keys
  const CACHE_KEY = 'businessContext'
  const CACHE_TS_KEY = 'businessContextTs'
  const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

  // Seed state from localStorage synchronously to avoid reload flash on revisit
  const [form, setForm] = useState<Bc>(() => {
    if (typeof window === 'undefined') return { businessName: '', orgNumber: '', delivers: '', icp: '' }
    try {
      const raw = localStorage.getItem(CACHE_KEY) || ''
      if (raw && raw.startsWith('{')) {
        const v = JSON.parse(raw) as Partial<Bc>
        return {
          businessName: v.businessName ?? '',
          orgNumber: v.orgNumber ?? '',
          delivers: v.delivers ?? '',
          icp: v.icp ?? '',
        }
      }
    } catch {}
    return { businessName: '', orgNumber: '', delivers: '', icp: '' }
  })
  const [legacyText, setLegacyText] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try {
      const raw = localStorage.getItem(CACHE_KEY) || ''
      return raw && !raw.startsWith('{') ? raw : ''
    } catch {
      return ''
    }
  })
  const [saved, setSaved] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const tsRaw = localStorage.getItem(CACHE_TS_KEY)
      if (!tsRaw) return true
      const ts = Number(tsRaw)
      return !(Number.isFinite(ts) && Date.now() - ts < CACHE_TTL_MS)
    } catch {
      return true
    }
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchBc = async () => {
      // If we have fresh cache, skip network
      try {
        const tsRaw = typeof window !== 'undefined' ? localStorage.getItem(CACHE_TS_KEY) : null
        const ts = tsRaw ? Number(tsRaw) : NaN
        const hasFreshCache = Number.isFinite(ts) && Date.now() - ts < CACHE_TTL_MS
        if (hasFreshCache) {
          setLoading(false)
          return
        }
      } catch {}

      setLoading(true)
      try {
        const res = await fetch('/api/user/business-context', { cache: 'no-store' })
        if (!res.ok) throw new Error('Kunne ikke laste forretningskontekst')
        const data = await res.json()
        const shape = data?.shape as 'object' | 'string' | 'null' | undefined
        if (!cancelled) {
          if (shape === 'object' && data?.businessContext) {
            const v = data.businessContext as Partial<Bc>
            setForm({
              businessName: v.businessName ?? '',
              orgNumber: v.orgNumber ?? '',
              delivers: v.delivers ?? '',
              icp: v.icp ?? '',
            })
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify(v))
              localStorage.setItem(CACHE_TS_KEY, String(Date.now()))
            } catch {}
          } else if (shape === 'string' && typeof data?.businessContext === 'string') {
            const v = data.businessContext as string
            setLegacyText(v)
            try {
              localStorage.setItem(CACHE_KEY, v || '')
              localStorage.setItem(CACHE_TS_KEY, String(Date.now()))
            } catch {}
          } else {
            // null/unknown: try localStorage
            try {
              const raw = localStorage.getItem(CACHE_KEY) || ''
              if (raw.startsWith('{')) {
                const v = JSON.parse(raw) as Partial<Bc>
                setForm({
                  businessName: v.businessName ?? '',
                  orgNumber: v.orgNumber ?? '',
                  delivers: v.delivers ?? '',
                  icp: v.icp ?? '',
                })
              } else if (raw) {
                setLegacyText(raw)
              }
            } catch {}
          }
        }
      } catch {
        if (!cancelled) {
          // Fallback to localStorage if API fails
          try {
            const raw = localStorage.getItem(CACHE_KEY) || ''
            if (raw.startsWith('{')) {
              const v = JSON.parse(raw) as Partial<Bc>
              setForm({
                businessName: v.businessName ?? '',
                orgNumber: v.orgNumber ?? '',
                delivers: v.delivers ?? '',
                icp: v.icp ?? '',
              })
            } else if (raw) {
              setLegacyText(raw)
            }
          } catch {}
          setError('Kunne ikke hente lagret verdi fra server')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchBc()
    return () => { cancelled = true }
  }, [])

  const onSave = async () => {
    try {
      setError(null)
      const payload = { businessContext: form }
      const res = await fetch('/api/user/business-context', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('Lagring feilet')
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(form))
        localStorage.setItem(CACHE_TS_KEY, String(Date.now()))
      } catch {}
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch {
      setError('Kunne ikke lagre til server. Prøv igjen.')
    }
  }

  return (
    <div className="w-full">
      {loading && <div className="text-xs text-gray-400 mb-2">Laster...</div>}

      <div className="grid grid-cols-1 gap-6 w-full">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Business name</label>
          <input
            type="text"
            value={form.businessName}
            onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
            placeholder="Acme AS"
            className="w-full bg-transparent border border-white/20 text-sm px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Organization number</label>
          <input
            type="text"
            value={form.orgNumber}
            onChange={(e) => setForm((f) => ({ ...f, orgNumber: e.target.value }))}
            placeholder="999999999"
            className="w-full bg-transparent border border-white/20 text-sm px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">What the company delivers</label>
          <textarea
            value={form.delivers}
            onChange={(e) => setForm((f) => ({ ...f, delivers: e.target.value }))}
            rows={4}
            placeholder="Short description of your product/service."
            className="w-full bg-transparent border border-white/20 text-sm p-2 text-white"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">ICP (Ideal Customer Profile)</label>
          <textarea
            value={form.icp}
            onChange={(e) => setForm((f) => ({ ...f, icp: e.target.value }))}
            rows={4}
            placeholder="Who you sell to, key segments, company size, industry, etc."
            className="w-full bg-transparent border border-white/20 text-sm p-2 text-white"
          />
        </div>
      </div>

      {legacyText && (
        <div className="mt-4">
          <div className="text-xs text-gray-400 mb-1">Legacy note</div>
          <div className="text-xs text-gray-500">We found an older single-text business context. You can copy details into the fields above.</div>
          <pre className="mt-2 text-xs whitespace-pre-wrap bg-transparent border border-white/10 p-2 text-gray-300">{legacyText}</pre>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button onClick={onSave} className="px-3 py-2 border border-white/20 text-sm text-white/90 hover:bg-white/10">Save</button>
        {saved && <span className="text-xs text-green-400">Saved</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  )
}

