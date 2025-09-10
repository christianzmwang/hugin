'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useDashboardMode } from '@/components/DashboardThemeProvider'

type SavedList = {
  id: number
  name: string
  filterQuery?: string | null
  createdAt: string
  itemCount: number
}

export default function ListsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [items, setItems] = useState<SavedList[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  useDashboardMode() // ensure theme sync via context (no local usage)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/auth/signin'); return }
    const hasDbAccess = Boolean(session.user?.mainAccess)
    if (!hasDbAccess) { router.push('/noaccess'); return }
  }, [session, status, router])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/lists', { cache: 'no-store' })
        const json = await res.json()
        const arr = Array.isArray(json) ? json : json.items || []
        if (!cancelled) setItems(arr)
      } catch {
        if (!cancelled) setItems([])
      } finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // (Search link removed) normalizeQuery no longer needed

  return (
    <div className="app-notifications no-rounded-panels">
      <div className="w-full px-6 pt-6 pb-8">
        {error && <div className="notify-error text-xs mb-3">{error}</div>}
        {loading ? (
          <div className="notify-muted text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="notify-muted text-sm">No saved lists yet.</div>
        ) : (
          <ul className="space-y-4">
            {items.map((it) => (
              <li
                key={it.id}
                className="p-4 notify-panel cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/lists/${it.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    router.push(`/lists/${it.id}`)
                  }
                }}
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold">{it.name}</div>
                    <div className="text-[11px] notify-muted mt-1">{new Date(it.createdAt).toLocaleString()} • {it.itemCount} companies</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/export?listId=${it.id}`) }}
                      className="notify-btn text-[11px] px-2 py-1"
                    >
                      Export
                    </button>
                    <button
                      disabled={deletingId === it.id}
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (!confirm('Delete this list? This cannot be undone.')) return
                        setDeletingId(it.id)
                        setError(null)
                        const previous = items
                        setItems((prev) => prev.filter((p) => p.id !== it.id))
                        try {
                          const res = await fetch(`/api/lists/${it.id}`, { method: 'DELETE' })
                          if (!res.ok) {
                            setItems(previous)
                            setError('Failed to delete list')
                          }
                        } catch {
                          setItems(previous)
                          setError('Failed to delete list')
                        } finally {
                          setDeletingId(null)
                        }
                      }}
                      className="notify-delete-btn text-[11px] px-2 py-1 disabled:opacity-50"
                    >
                      {deletingId === it.id ? 'Deleting…' : 'Delete'}
                    </button>
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
