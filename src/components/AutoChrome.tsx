'use client'

import { usePathname } from 'next/navigation'
import TopBar from '@/components/TopBar'
import BottomSidebar from '@/components/BottomSidebar'

type AutoChromeProps = {
  children: React.ReactNode
  title?: string
}

export default function AutoChrome({ children, title }: AutoChromeProps) {
  const pathname = usePathname()
  const hideChrome = pathname?.startsWith('/auth/') || pathname === '/countdown'
  const path = pathname || '/'
  const isDashboard = path === '/' || path === '/dashboard'

  const computedTitle = (() => {
    if (title) return title
    if (path === '/' || path === '/dashboard') return 'Dashboard'
    const map: Record<string, string> = {
      '/search': 'Search',
      '/watchlist': 'Watchlist',
      '/export': 'Export',
      '/sandbox': 'Sandbox',
    }
    for (const key of Object.keys(map)) {
      if (path === key || path.startsWith(key + '/')) return map[key]
    }
    const parts = path.split('/').filter(Boolean)
    if (parts.length === 0) return 'Hugin'
    const name = parts[0]
    return name.charAt(0).toUpperCase() + name.slice(1)
  })()

  return (
    <div className={`min-h-screen bg-black text-white ${isDashboard ? '' : 'pb-20 md:pb-24'} flex flex-col`}>
      {!hideChrome && <TopBar title={computedTitle} />}
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      {!hideChrome && (
        <BottomSidebar showGoToTop={pathname === '/search' || pathname?.startsWith('/search/')} />
      )}
    </div>
  )
}


