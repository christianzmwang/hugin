'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'

type ListItem = { orgNumber: string; name: string | null }

type SavedListDetail = {
  id: number
  name: string
  filterQuery?: string | null
  createdAt: string
  items: ListItem[]
}

export default function ListDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [item, setItem] = useState<SavedListDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState<number>(50)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/auth/signin'); return }
    const hasDbAccess = Boolean(session.user?.mainAccess)
    if (!hasDbAccess) { router.push('/noaccess'); return }
  }, [session, status, router])

  useEffect(() => {
    let cancelled = false
    const id = Number(params.id)
    if (!Number.isFinite(id)) return
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/lists/${id}`, { cache: 'no-store' })
        const json = await res.json()
        const it = json?.item || null
        if (!cancelled) setItem(it)
      } catch {
        if (!cancelled) setItem(null)
      } finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [params.id])

  // Reset visible items when a new list is loaded
  useEffect(() => {
    setVisibleCount(50)
  }, [item?.id])

  // (Search link removed) previously used normalizeQuery helper not needed anymore

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="w-full px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">{item?.name || 'List'}</h1>
          {item && (
            <button
              disabled={deleting}
              onClick={async () => {
                if (!item) return
                if (!confirm('Delete this list? This cannot be undone.')) return
                setDeleting(true)
                setError(null)
                try {
                  const res = await fetch(`/api/lists/${item.id}`, { method: 'DELETE' })
                  if (!res.ok) {
                    setError('Failed to delete list')
                  } else {
                    router.push('/lists')
                    router.refresh?.()
                  }
                } catch {
                  setError('Failed to delete list')
                } finally {
                  setDeleting(false)
                }
              }}
              className="text-xs px-3 py-1 border border-red-600/60 text-red-400 hover:bg-red-600/10 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
        {error && <div className="text-xs text-red-400 mb-4">{error}</div>}
        {loading ? (
          <div className="text-gray-400">Loading…</div>
        ) : !item ? (
          <div className="text-gray-400">List not found.</div>
        ) : (
          <div>
            <div className="text-xs text-gray-400 mb-4">{new Date(item.createdAt).toLocaleString()} • {item.items.length} companies</div>
            {/* Removed "Open Search with filters" button as requested */}
            {item.items.length === 0 ? (
              <div className="text-gray-400">No companies saved in this list.</div>
            ) : (
              <>
                <div className="divide-y divide-white/10 border border-white/10">
                  {item.items.slice(0, Math.max(0, visibleCount)).map((c) => (
                    <div
                      key={c.orgNumber}
                      className="px-4 py-3 hover:bg-red-600/10 cursor-pointer focus:outline-none focus:ring-1 focus:ring-red-600/40"
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/company?orgNumber=${encodeURIComponent(c.orgNumber)}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          router.push(`/company?orgNumber=${encodeURIComponent(c.orgNumber)}`)
                        }
                      }}
                      title={`View ${c.name || c.orgNumber}`}
                    >
                      <div>
                        <div className="font-medium">{c.name || c.orgNumber}</div>
                        {c.name && <div className="text-xs text-gray-400">{c.orgNumber}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {visibleCount < item.items.length && (
                  <div className="mt-6">
                    <button
                      onClick={() => setVisibleCount((prev) => Math.min(prev + 50, item.items.length))}
                      className="w-full px-4 py-2 border border-white/10 hover:bg-red-600/10 hover:border-red-600/60 focus:outline-none focus:ring-1 focus:ring-red-600/40 text-sm transition-colors duration-200"
                    >
                      Load more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
