'use client'

import Link from 'next/link'
import Munin from '../../public/munin.svg'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Munin logo in bottom left corner */}
      <div className="absolute bottom-6 left-6">
        <Munin className="w-6 h-6" />
      </div>

      <div className="max-w-md w-full space-y-8 text-center">
        {/* 404 Icon */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-900/50 border border-red-500">
          <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white mb-2">404</h1>
          <h2 className="text-xl font-semibold text-white mb-4">Page Not Found</h2>
          <p className="text-gray-300 mb-8">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/"
            className="block w-full py-3 px-4 border border-transparent text-sm font-medium text-white bg-red-800 hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
          >
            Go to Homepage
          </Link>
          
          <Link
            href="/auth/signin"
            className="block w-full py-3 px-4 border border-gray-600 text-sm font-medium text-gray-300 bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
          >
            Sign In
          </Link>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Hugin - Real-time market research platform by Allvitr
          </p>
        </div>
      </div>
    </div>
  )
}
