"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useDashboardMode } from '@/components/DashboardThemeProvider'

function summarize(filterQuery: string | null): string {
  if (!filterQuery) return 'All companies'
  try {
    const sp = new URLSearchParams(filterQuery.replace(/^\?/, ''))
    const parts: string[] = []
    const inds = sp.getAll('industries').filter(Boolean)
    if (inds.length) parts.push(`Industries: ${inds.join(', ')}`)
    const areas = sp.getAll('areas').filter(Boolean)
    if (areas.length) parts.push(`Areas: ${areas.join(', ')}`)
    const ct = sp.getAll('orgFormCode').filter(Boolean)
    if (ct.length) parts.push(`Types: ${ct.join(', ')}`)
    const revMin = sp.get('revenueMin'); const revMax = sp.get('revenueMax')
    if (revMin || revMax) parts.push(`Revenue ${revMin||'…'}-${revMax||'…'}`)
    const pMin = sp.get('profitMin'); const pMax = sp.get('profitMax')
    if (pMin || pMax) parts.push(`Profit ${pMin||'…'}-${pMax||'…'}`)
    const regFrom = sp.get('registeredFrom'); const regTo = sp.get('registeredTo')
    if (regFrom || regTo) parts.push(`Reg ${regFrom||'…'}→${regTo||'…'}`)
    const events = sp.get('events')
    if (events) parts.push(events === 'with' ? 'With events' : 'Without events')
    const evTypes = (sp.get('eventTypes') || '').split(',').map(s=>s.trim()).filter(Boolean)
    if (evTypes.length) parts.push(`Event types: ${evTypes.join(', ')}`)
    if (sp.has('webCmsShopify')) parts.push('Shopify')
    if (sp.has('webEcomWoocommerce')) parts.push('Woo')
    const q = sp.get('q'); if (q) parts.push(`Search:"${q}"`)
    return parts.join(' · ') || 'All companies'
  } catch { return 'All companies' }
}

type NotificationItem = {
  id: number | string
  name: string
  filterQuery: string | null
  createdAt: string | number | Date
}

export default function NotificationsPage() {
  const { data: session } = useSession()
  useDashboardMode() // ensure theme sync via context (no local usage now)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const load = async () => {
    setLoading(true); setErr(false)
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      const j = await res.json()
      setItems(Array.isArray(j.items) ? j.items : [])
    } catch { setErr(true) } finally { setLoading(false) }
  }
  useEffect(() => { if (session) load() }, [session])
  if (!session) {
    return (
  <div className="app-notifications no-rounded-panels flex items-center justify-center py-24">
        <div className="text-center">
          <p className="text-sm mb-4 notify-muted">Please sign in to view notifications.</p>
          <Link href="/auth/signin" className="text-red-500 underline">Sign in</Link>
        </div>
      </div>
    )
  }
  return (
    <div className="app-notifications no-rounded-panels">
      <div className="w-full px-6 pt-6 pb-8">
        {loading ? <div className="notify-muted text-sm">Loading…</div> : items.length === 0 ? (
          <div className="notify-muted text-sm">No notifications saved yet. Go to Search and add one.</div>
        ) : err ? <div className="notify-error text-sm">Failed to load notifications.</div> : (
      <ul className="space-y-4">
            {items.map((n) => (
        <li key={n.id} className="p-4 notify-panel">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold">{n.name}</div>
                    <div className="text-[11px] notify-muted mt-1">{new Date(n.createdAt).toLocaleString()} • {summarize(n.filterQuery)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (!confirm('Delete this notification?')) return
                        try { await fetch(`/api/notifications/${n.id}`, { method: 'DELETE' }); load() } catch {}
                      }}
            className="notify-delete-btn text-[11px] px-2 py-1"
                    >Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
