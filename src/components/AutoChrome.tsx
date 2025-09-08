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
  const hideChrome = pathname?.startsWith('/auth/') || pathname === '/noaccess'
  const path = pathname || '/'
  const isDashboard = path === '/' || path === '/dashboard'
  const isCompany = path === '/company' || path.startsWith('/company/')
  const isProfile = path === '/profile' || path.startsWith('/profile/')

  const computedTitle = (() => {
    if (title) return title
    if (path === '/' || path === '/dashboard') return 'Dashboard'
    const map: Record<string, string> = {
      '/search': 'Search',
      '/watchlist': 'Watchlist',
      '/company': 'Company',
      '/configuration': 'Configuration',
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

  // Container should not include bottom padding to avoid forcing page scroll.
  // Instead, apply bottom padding to the scrollable content area when needed.
  const containerClass = hideChrome
    ? 'h-[100dvh] min-h-0 overflow-hidden bg-black text-white flex flex-col'
    : 'min-h-screen bg-black text-white flex flex-col'

  const contentPadding = !hideChrome && !(isDashboard || isCompany || isProfile)
    ? 'pb-20 md:pb-24'
    : ''

  return (
    <div className={containerClass}>
      {!hideChrome && <TopBar title={computedTitle} />}
      <div className={`flex-1 min-h-0 overflow-hidden ${contentPadding}`}>{children}</div>
      {!hideChrome && (
        <BottomSidebar showGoToTop={pathname === '/search' || pathname?.startsWith('/search/')} />
      )}
    </div>
  )
}

