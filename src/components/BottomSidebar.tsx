'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Search, Eye, Building2, Settings, Download, FlaskConical } from 'lucide-react'

type BottomSidebarProps = {
  onClearFilters?: () => void
  showGoToTop?: boolean
  showClearFilters?: boolean
}

export default function BottomSidebar({ onClearFilters, showGoToTop, showClearFilters }: BottomSidebarProps) {
  const pathname = usePathname()
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-none">
      <div className="pointer-events-auto bg-black/90 backdrop-blur border-t border-white/10">
        <div className="px-3 md:px-6 py-3">
          <div className="flex items-center gap-2">
            {/* Left: nav buttons */}
            <nav className="flex items-center gap-3">
              <Link
                href="/"
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 text-white/80 hover:text-white`}
              >
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-white/70 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
              <Link
                href="/search"
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 text-white/80 hover:text-white`}
              >
                <Search size={16} />
                <span>Search</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-white/70 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/search') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
              <Link
                href="/company"
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 text-white/80 hover:text-white`}
              >
                <Building2 size={16} />
                <span>Company</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-white/70 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/company') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
              <Link
                href="/watchlist"
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 text-white/80 hover:text-white`}
              >
                <Eye size={16} />
                <span>Watchlist</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-white/70 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/watchlist') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
              <Link
                href="/configuration"
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 text-white/80 hover:text-white`}
              >
                <Settings size={16} />
                <span>Configuration</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-white/70 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/configuration') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
              <Link
                href="/sandbox"
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 text-white/80 hover:text-white`}
              >
                <FlaskConical size={16} />
                <span>Sandbox</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-white/70 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/sandbox') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
              <Link
                href="/export"
                className={`group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 text-white/80 hover:text-white`}
              >
                <Download size={16} />
                <span>Export</span>
                <span
                  className={`pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-white/70 to-transparent opacity-0 transition-opacity duration-200 ${
                    isActive('/export') ? 'opacity-100' : 'group-hover:opacity-100'
                  }`}
                />
              </Link>
            </nav>

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-3">
              {showGoToTop ? (
                <button
                  className="group relative px-2 py-2 text-xs md:text-sm inline-flex items-center gap-2 text-white/80 hover:text-white"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  Go to top
                  <span className="pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-t from-white/70 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </button>
              ) : null}
              {showClearFilters && onClearFilters ? null : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


