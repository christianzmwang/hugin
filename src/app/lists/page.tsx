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
  const { mode } = useDashboardMode()
  const light = mode === 'light'
  // (Removed dynamic height measurement; revert to natural page height)

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
    <div
      className={`flex-1 min-h-0 p-4 md:p-6 flex flex-col overflow-hidden transition-colors duration-300`}
      style={{ height: 'calc(100dvh - 92px)' }}
    >
      <h2 className={`text-lg font-semibold mb-4 ${light ? 'text-gray-900' : ''}`}>Lists</h2>
      {error && <div className={`text-xs mb-3 ${light ? 'text-red-600' : 'text-red-400'}`}>{error}</div>}
      {loading ? (
        <div className={`text-sm ${light ? 'text-gray-600' : 'text-gray-400'}`}>Loading…</div>
      ) : items.length === 0 ? (
        <div className={`text-sm ${light ? 'text-gray-600' : 'text-gray-400'}`}>No saved lists yet.</div>
      ) : (
        <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden border backdrop-blur-sm rounded ${light ? 'border-gray-200 bg-gray-100' : 'border-white/5 bg-white/5'}`}>
          <ul className={`divide-y w-full ${light ? 'divide-gray-200' : 'divide-white/10'}`}>
            {items.map(it => (
              <li
                key={it.id}
                className={`px-4 py-3 flex items-center justify-between gap-4 group ${light ? 'hover:bg-gray-200' : 'hover:bg-white/10'}`}
              >
                <div className="cursor-pointer flex-1" onClick={() => router.push(`/lists/${it.id}`)}>
                  <div className={`font-medium ${light ? 'text-gray-900' : 'text-white'}`}>{it.name}</div>
                  <div className={`text-xs ${light ? 'text-gray-600' : 'text-gray-400'}`}>{new Date(it.createdAt).toLocaleString()} • {it.itemCount} companies</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/export?listId=${it.id}`) }}
                    className={`text-[10px] px-2 py-1 border transition-colors ${light ? 'border-sky-500 text-sky-600 hover:bg-sky-100' : 'border-sky-600/60 text-sky-300 hover:bg-sky-600/10'}`}
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
                    className={`text-[10px] px-2 py-1 border disabled:opacity-50 transition-colors ${light ? 'border-red-500 text-red-600 hover:bg-red-50' : 'border-red-600/60 text-red-400 hover:bg-red-600/10'}`}
                  >
                    {deletingId === it.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
