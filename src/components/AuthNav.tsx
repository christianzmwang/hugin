'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'

export default function AuthNav() {
  const { data: session, status } = useSession()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center space-x-2 text-white hover:text-gray-300 px-3 py-2 text-sm font-medium focus:outline-none w-full"
      >
        {session.user?.image && (
          <Image
            src={session.user.image}
            alt={session.user.name || 'User'}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full"
          />
        )}
        <span>{session.user?.name || session.user?.email}</span>
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
        <div className="absolute right-0 mt-2 w-full bg-black shadow-lg ring-1 ring-white ring-opacity-20 z-50">
          <div className="py-1">
            <button
              onClick={() => {
                setDropdownOpen(false)
                // Add profile navigation here if needed
              }}
              className="flex items-center px-4 py-2 text-sm text-white hover:bg-gray-800 w-full text-left"
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </button>
            <hr className="border-gray-600" />
            <button
              onClick={() => {
                setDropdownOpen(false)
                signOut({ callbackUrl: '/' })
              }}
              className="flex items-center px-4 py-2 text-sm text-white hover:bg-gray-800 w-full text-left"
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
