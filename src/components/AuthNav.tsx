'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useDashboardMode } from '@/components/DashboardThemeProvider'
// All pages now use light styling when global dashboard mode is light

export default function AuthNav() {
  const { data: session, status } = useSession()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const { mode } = useDashboardMode()
  const light = mode === 'light'

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  if (status === 'loading') {
    return (
      <div className="flex items-center space-x-4">
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center space-x-4">
        <Link
          href="/auth/signin"
          className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Sign In
        </Link>
        <Link
          href="/auth/signup"
          className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Sign Up
        </Link>
      </div>
    )
  }

  return (
  <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={`flex items-center space-x-2 px-3 py-4 -my-2 text-sm font-medium focus:outline-none transition-colors ${light ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100' : 'text-white hover:text-gray-300 hover:bg-white/5'}`}
        id="profile-btn"
      >
        {(() => {
          const displayName = session.user?.name || session.user?.email || 'User'
          const imageSrc = session.user?.image || ''
          const canUseNextImage = typeof imageSrc === 'string' && /^(https?:\/\/|data:image\/)/.test(imageSrc)
          if (canUseNextImage) {
            return (
              <Image
                src={imageSrc}
                alt={displayName}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full ring-1 ring-black/5"
              />
            )
          }
          // Fallback placeholder to keep consistent height
          const initial = String(displayName).trim().charAt(0).toUpperCase() || 'U'
          return (
            <div
              aria-hidden="true"
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${light ? 'bg-gray-200 text-gray-600' : 'bg-white/10 text-white/80'}`}
              title={displayName}
            >
              {initial}
            </div>
          )
        })()}
        <span className={light ? 'text-gray-800' : ''}>{session.user?.name || session.user?.email}</span>
        <svg
          className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {dropdownOpen && (
        <div
          className={`absolute left-0 top-full mt-2 z-50 overflow-hidden shadow-lg box-border w-full ${light ? 'bg-white shadow-gray-200/70' : 'bg-black'}`}
        >
          <div>
            <Link
              href="/profile"
              onClick={() => setDropdownOpen(false)}
              className={`flex items-center px-4 py-2 text-sm w-full text-left transition-colors ${light ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-gray-800'}`}
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </Link>
            {session.user?.email === 'christian@allvitr.com' && (
              <>
                <hr className={`${light ? 'border-gray-200' : 'border-red-600/90'}`} />
                <Link
                  href="/admin"
                  onClick={() => setDropdownOpen(false)}
                  className={`flex items-center px-4 py-2 text-sm w-full text-left transition-colors ${light ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-gray-800'}`}
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin Panel
                </Link>
              </>
            )}
            <hr className={`${light ? 'border-gray-200' : 'border-red-600/90'}`} />
            <button
              onClick={() => {
                setDropdownOpen(false)
                signOut({ callbackUrl: '/' })
              }}
              className={`flex items-center px-4 py-2 text-sm w-full text-left transition-colors ${light ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-gray-800'}`}
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
