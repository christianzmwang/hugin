'use client'

import { usePathname } from 'next/navigation'
import TopBar from '@/components/TopBar'
import BottomSidebar from '@/components/BottomSidebar'
import { useDashboardMode } from '@/components/DashboardThemeProvider'
// Path-based light chrome logic removed; light mode applies globally

type AutoChromeProps = {
  children: React.ReactNode
  title?: string
}

export default function AutoChrome({ children, title }: AutoChromeProps) {
  const pathname = usePathname()
  const isAuth = pathname?.startsWith('/auth/')
  const isNoAccess = pathname === '/noaccess'
  // Remove TopBar on auth and noaccess pages
  const hideTop = isAuth || isNoAccess
  // Hide bottom nav on auth pages and noaccess page
  const hideBottom = isAuth || isNoAccess
  const path = pathname || '/'
  const isDashboard = path === '/' || path === '/dashboard'
  // Pages that should use light chrome when the user selects light mode
  const isLightCandidate = true
  const isCompany = path === '/company' || path.startsWith('/company/')
  const isProfile = path === '/profile' || path.startsWith('/profile/')
  const isLists = path === '/lists' || path.startsWith('/lists/')
  const isExport = path === '/export' || path.startsWith('/export/')
  const isSandbox = path === '/sandbox' || path.startsWith('/sandbox/')

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
  const { mode } = useDashboardMode()
  const containerClass = (() => {
    const base = 'min-h-screen flex flex-col'
    if (isAuth) return `${base} bg-black text-white` // Force dark on auth pages
    const useLightChrome = isLightCandidate && mode === 'light'
    return `${base} ${useLightChrome ? 'bg-white text-gray-900' : 'bg-black text-white'}`
  })()

  const contentPadding = !(isDashboard || isCompany || isProfile || isLists || isExport || isSandbox) && !hideBottom
    ? 'pb-20 md:pb-24'
    : ''

  return (
    <div className={containerClass}>
      {!hideTop && <TopBar title={computedTitle} />}
      <div className={`flex-1 min-h-0 overflow-hidden ${contentPadding}`}>{children}</div>
      {!hideBottom && (
        <BottomSidebar showGoToTop={pathname === '/search' || pathname?.startsWith('/search/')} />
      )}
    </div>
  )
}
