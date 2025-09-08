'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

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
    <div className="min-h-screen bg-black text-white">
      <div className="w-full px-6 py-8">
        {error && <div className="text-xs text-red-400 mb-4">{error}</div>}
        {loading ? (
          <div className="text-gray-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-gray-400">No saved lists yet.</div>
        ) : (
          <div className="divide-y divide-white/10 border border-white/10">
            {items.map((it) => (
              <div key={it.id} className="px-4 py-3 flex items-center justify-between gap-4 group hover:bg-white/5">
                <div className="cursor-pointer flex-1" onClick={() => router.push(`/lists/${it.id}`)}>
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-gray-400">{new Date(it.createdAt).toLocaleString()} • {it.itemCount} companies</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/export?listId=${it.id}`) }}
                    className="text-[10px] px-2 py-1 border border-sky-600/60 text-sky-300 hover:bg-sky-600/10"
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
                    // Optimistic remove
                    const previous = items
                    setItems(prev => prev.filter(p => p.id !== it.id))
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
                  className="text-[10px] px-2 py-1 border border-red-600/60 text-red-400 hover:bg-red-600/10 disabled:opacity-50"
                >
                  {deletingId === it.id ? 'Deleting…' : 'Delete'}
                </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
