'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Search, Eye, Building2, Settings, Download, FlaskConical, List as ListIcon, Bell, Sun, Moon } from 'lucide-react'
import { useDashboardMode } from '@/components/DashboardThemeProvider'
import { useEffect } from 'react'

type BottomSidebarProps = {
  onClearFilters?: () => void
  showGoToTop?: boolean
  showClearFilters?: boolean
}

export default function BottomSidebar({ onClearFilters, showGoToTop, showClearFilters }: BottomSidebarProps) {
  const pathname = usePathname()
  const { mode, toggle } = useDashboardMode()
  // Standardize: light styling applies globally when user selects light mode.
  // (Keep potential hook structure if future per-page overrides are needed.)
  useEffect(() => { /* placeholder reserved for future dynamic logic */ }, [])
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }
  const light = mode === 'light'
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-none">
      <div className={`pointer-events-auto backdrop-blur border-t transition-colors duration-300 ${light ? 'bg-white/90 border-gray-200' : 'bg-black/90 border-white/10'}` }>
        <div className="px-3 md:px-6 py-3">
          <div className="flex items-center gap-2">
            {/* Left: nav buttons */}
            <nav className="flex items-center gap-3">
              <Link
                href="/"
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 ${light ? (isActive('/') ? 'text-gray-900' : 'text-gray-700') : (isActive('/') ? 'text-white/90' : 'text-white/80')}`}
              >
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-red-600/90 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
              <Link
                href="/search"
                prefetch={false}
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 ${light ? (isActive('/search') ? 'text-gray-900' : 'text-gray-700') : (isActive('/search') ? 'text-white/90' : 'text-white/80')}`}
              >
                <Search size={16} />
                <span>Search</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-red-600/90 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/search') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
              <Link
                href="/company"
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 ${light ? (isActive('/company') ? 'text-gray-900' : 'text-gray-700') : (isActive('/company') ? 'text-white/90' : 'text-white/80')}`}
              >
                <Building2 size={16} />
                <span>Company</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-red-600/90 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/company') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
              {/* Lists placed to the left of Watchlist */}
              <Link
                href="/lists"
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 ${light ? (isActive('/lists') ? 'text-gray-900' : 'text-gray-700') : (isActive('/lists') ? 'text-white/90' : 'text-white/80')}`}
              >
                <ListIcon size={16} />
                <span>Lists</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-red-600/90 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/lists') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
              <Link
                href="/watchlist"
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 ${light ? (isActive('/watchlist') ? 'text-gray-900' : 'text-gray-700') : (isActive('/watchlist') ? 'text-white/90' : 'text-white/80')}`}
              >
                <Eye size={16} />
                <span>Watchlist</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-red-600/90 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/watchlist') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
              <Link
                href="/configuration"
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 ${light ? (isActive('/configuration') ? 'text-gray-900' : 'text-gray-700') : (isActive('/configuration') ? 'text-white/90' : 'text-white/80')}`}
                title="Configuration"
              >
                <Settings size={16} />
                <span>Configuration</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-red-600/90 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/configuration') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
              <Link
                href="/sandbox"
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 ${light ? (isActive('/sandbox') ? 'text-gray-900' : 'text-gray-700') : (isActive('/sandbox') ? 'text-white/90' : 'text-white/80')}`}
              >
                <FlaskConical size={16} />
                <span>Sandbox</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-red-600/90 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/sandbox') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
              <Link
                href="/export"
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 ${light ? (isActive('/export') ? 'text-gray-900' : 'text-gray-700') : (isActive('/export') ? 'text-white/90' : 'text-white/80')}`}
              >
                <Download size={16} />
                <span>Export</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-red-600/90 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/export') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
              <Link
                href="/notifications"
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 ${light ? (isActive('/notifications') ? 'text-gray-900' : 'text-gray-700') : (isActive('/notifications') ? 'text-white/90' : 'text-white/80')}`}
              >
                <Bell size={16} />
                <span>Notifications</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-red-600/90 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/notifications') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
            </nav>

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-3">
              {showGoToTop ? (
                <button
                  className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 ${light ? 'text-gray-700 hover:text-gray-900' : 'text-white/80 hover:text-white/90'}`}
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  Go to top
                  <span className="pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-red-600/90 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </button>
              ) : null}
              {showClearFilters && onClearFilters ? null : null}
              <button
                onClick={toggle}
                aria-label="Toggle light/dark"
                className={`group relative px-2 py-2 inline-flex items-center ${light ? 'text-gray-700 hover:text-gray-900' : 'text-white/80 hover:text-white/90'}`}
                title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              >
                {mode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                <span className="pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-red-600/90 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
