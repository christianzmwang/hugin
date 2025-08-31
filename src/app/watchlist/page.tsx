'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useWatchlist } from '@/app/watchlist/useWatchlist'
 

export default function WatchlistPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { items, isLoading: loading, error, remove } = useWatchlist()

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
      <div className="h-full p-6">
        <div className="h-full overflow-auto">
          <WatchlistList items={items} loading={loading} error={error} removeItem={remove} />
        </div>
      </div>
  )
}


function WatchlistList({
  items,
  loading,
  error,
  removeItem,
}: {
  items: Array<{ orgNumber: string; name: string | null }>
  loading: boolean
  error: string | null
  removeItem: (orgNumber: string) => void | Promise<void>
}) {

  if (loading) {
    return <div className="text-sm text-gray-400">Loading watchlist…</div>
  }
  if (error) {
    return <div className="text-sm text-red-400">{error}</div>
  }
  if (!items || items.length === 0) {
    return <div className="text-sm text-gray-400">Your watchlist is empty.</div>
  }
  return (
    <div>
      <ul className="divide-y divide-white/10">
        {items.map((it) => (
          <li key={it.orgNumber} className="py-3 flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">{it.name || 'Unnamed company'}</div>
              <div className="text-xs text-gray-400">{it.orgNumber}</div>
            </div>
            <div className="flex items-center gap-2">
              <a className="text-xs px-2 py-1 border border-white/20 hover:bg-white/10" href={`/search?q=${encodeURIComponent(it.name || it.orgNumber)}`}>Open</a>
              <button className="text-xs px-2 py-1 border border-white/20 hover:bg-white/10" onClick={() => removeItem(it.orgNumber)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

