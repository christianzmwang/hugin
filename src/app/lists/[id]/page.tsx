'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { useDashboardMode } from '@/components/DashboardThemeProvider'

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
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [rowDeleting, setRowDeleting] = useState<string | null>(null)
  const { mode } = useDashboardMode()

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
  setSelectionMode(false)
  setSelected(new Set())
  }, [item?.id])

  // (Search link removed) previously used normalizeQuery helper not needed anymore

  // Toggle a body class specific to lists + light mode to guarantee style switch
  useEffect(() => {
    if (typeof document === 'undefined') return
    const body = document.body
    if (mode === 'light') {
      body.classList.add('lists-light')
    } else {
      body.classList.remove('lists-light')
    }
    return () => { body.classList.remove('lists-light') }
  }, [mode])

  const isLight = mode === 'light'

  return (
  <div className={`min-h-screen ${isLight ? 'bg-white text-gray-900' : 'bg-black text-white'}`}>
        <div className="w-full px-6 py-8">
          <div className="mb-1 flex items-start justify-between gap-4 flex-wrap">
            <h1 className="text-2xl font-semibold leading-tight">{item?.name || 'List'}</h1>
            {item && (
              <div className="flex flex-col items-end gap-1">
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
                  className={`text-xs px-3 py-1 border disabled:opacity-50 ${isLight ? 'border-red-500/60 text-red-600 hover:bg-red-50' : 'border-red-600/60 text-red-400 hover:bg-red-600/10'}`}
                >
                  {deleting ? 'Deleting…' : 'Delete List'}
                </button>
              </div>
            )}
          </div>
          {/* Selection controls moved under Delete List button */}
        {error && <div className="text-xs text-red-400 mb-4">{error}</div>}
        {loading ? (
          <div className="text-gray-400">Loading…</div>
        ) : !item ? (
          <div className="text-gray-400">List not found.</div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center w-full gap-2 text-xs text-gray-500 dark:text-gray-400 mb-4">
              <span className="mr-2">{new Date(item.createdAt).toLocaleString()} • {item.items.length} companies</span>
              {item.items.length > 0 && (
                !selectionMode ? (
                  <button
                    onClick={() => setSelectionMode(true)}
                    className={`ml-auto px-3 py-1 border transition-colors disabled:opacity-50 ${isLight ? 'text-black border-gray-300 hover:border-red-500 hover:bg-red-50' : 'border-white/15 hover:border-red-600/50 hover:bg-red-600/10'}`}
                  >
                    Select
                  </button>
                ) : (
                  <div className="flex items-center gap-2 ml-auto">
                    {selected.size > 0 && (
                      <button
                        disabled={bulkDeleting}
                        onClick={async () => {
                          if (!item) return
                          if (!confirm(`Remove ${selected.size} compan${selected.size === 1 ? 'y' : 'ies'} from this list?`)) return
                          setBulkDeleting(true)
                          try {
                            const orgNumbers = Array.from(selected)
                            const res = await fetch(`/api/lists/${item.id}/items`, {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ orgNumbers })
                            })
                            if (res.ok) {
                              const removedSet = new Set(orgNumbers)
                              setItem(prev => prev ? { ...prev, items: prev.items.filter(i => !removedSet.has(i.orgNumber)) } : prev)
                              setSelected(new Set())
                              setSelectionMode(false)
                            } else {
                              setError('Failed to remove selected companies')
                            }
                          } catch {
                            setError('Failed to remove selected companies')
                          } finally { setBulkDeleting(false) }
                        }}
                        className={`px-3 py-1 border disabled:opacity-50 ${isLight ? 'border-red-500/60 text-red-600 hover:bg-red-50' : 'border-red-600/60 text-red-400 hover:bg-red-600/10'}`}
                      >
                        {bulkDeleting ? 'Removing…' : `Remove Selected (${selected.size})`}
                      </button>
                    )}
                    <button
                      onClick={() => { setSelectionMode(false); setSelected(new Set()) }}
                      className={`px-3 py-1 border transition-colors disabled:opacity-50 ${isLight ? 'text-black border-gray-300 hover:border-red-500 hover:bg-red-50' : 'border-white/15 hover:border-red-600/50 hover:bg-red-600/10'}`}
                    >
                      Cancel Selection
                    </button>
                  </div>
                )
              )}
            </div>
            {/* Removed "Open Search with filters" button as requested */}
            {item.items.length === 0 ? (
              <div className="text-gray-400">No companies saved in this list.</div>
            ) : (
              <>
  <div className={`divide-y overflow-hidden ${isLight ? 'divide-gray-200 border border-gray-200 bg-white' : 'divide-white/10 border border-white/10 bg-black'}` }>
      {item.items.slice(0, Math.max(0, visibleCount)).map((c) => {
                    const isSelected = selected.has(c.orgNumber)
                    return (
                      <div
                        key={c.orgNumber}
        className={`relative flex items-center justify-between gap-4 px-4 py-3 group cursor-pointer ${isSelected ? (isLight ? 'bg-red-100' : 'bg-red-600/15') : (isLight ? 'hover:bg-red-50' : 'hover:bg-red-600/10')} focus:outline-none scroll-margin-btm`}
                        style={selectionMode && isSelected ? { borderTopWidth: 0 } : undefined}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (selectionMode) {
                            setSelected(prev => {
                              const next = new Set(prev)
                              if (next.has(c.orgNumber)) { next.delete(c.orgNumber) } else { next.add(c.orgNumber) }
                              return next
                            })
                          } else {
                            router.push(`/company?orgNumber=${encodeURIComponent(c.orgNumber)}`)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            if (selectionMode) {
                              setSelected(prev => {
                                const next = new Set(prev)
                                if (next.has(c.orgNumber)) { next.delete(c.orgNumber) } else { next.add(c.orgNumber) }
                                return next
                              })
                            } else {
                              router.push(`/company?orgNumber=${encodeURIComponent(c.orgNumber)}`)
                            }
                          }
                        }}
                        title={selectionMode ? (isSelected ? 'Selected' : 'Select company') : `View ${c.name || c.orgNumber}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="min-w-0">
                            <div className={`font-medium truncate max-w-[50vw] md:max-w-[40vw] ${isLight ? 'text-gray-900' : 'text-white'}`}>{c.name || c.orgNumber}</div>
                            {c.name && <div className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>{c.orgNumber}</div>}
                          </div>
                        </div>
                        {selectionMode && (
                          <input
                            type="checkbox"
                            aria-label={isSelected ? 'Selected' : 'Not selected'}
                            className="checkbox-tech ml-2"
                            checked={isSelected}
                            readOnly
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelected(prev => {
                                const next = new Set(prev)
                                if (next.has(c.orgNumber)) next.delete(c.orgNumber); else next.add(c.orgNumber)
                                return next
                              })
                            }}
                          />
                        )}
                        {!selectionMode && (
                          <button
                            disabled={rowDeleting === c.orgNumber}
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (!item) return
                              if (!confirm(`Remove ${c.name || c.orgNumber} from this list?`)) return
                              setRowDeleting(c.orgNumber)
                              try {
                                const res = await fetch(`/api/lists/${item.id}/items`, {
                                  method: 'DELETE',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ orgNumbers: [c.orgNumber] })
                                })
                                if (res.ok) {
                                  setItem(prev => prev ? { ...prev, items: prev.items.filter(i => i.orgNumber !== c.orgNumber) } : prev)
                                } else {
                                  setError('Failed to remove company')
                                }
                              } catch {
                                setError('Failed to remove company')
                              } finally { setRowDeleting(null) }
                            }}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] px-2 py-1 border disabled:opacity-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity backdrop-blur-sm ${isLight ? 'border-gray-300 hover:border-red-500 hover:bg-red-50 bg-white/60' : 'border-white/15 hover:border-red-600/60 hover:bg-red-600/10 bg-transparent'}`}
                            title="Remove from list"
                          >
                            {rowDeleting === c.orgNumber ? '…' : 'Remove'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
        {visibleCount < item.items.length && (
                  <div className="mt-6">
                    <button
                      onClick={() => setVisibleCount((prev) => Math.min(prev + 50, item.items.length))}
          className={`w-full px-4 py-2 border focus:outline-none focus:ring-1 text-sm transition-colors duration-200 scroll-margin-btm ${isLight ? 'border-gray-200 hover:border-red-500 hover:bg-red-50 focus:ring-red-600/20' : 'border-white/10 hover:bg-red-600/10 hover:border-red-600/60 focus:ring-red-600/40'}`}
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
