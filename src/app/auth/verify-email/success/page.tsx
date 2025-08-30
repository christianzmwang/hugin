'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Hugin from '../../../../../public/hugin.svg'

function VerifyEmailSuccessContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState<string>('')

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [searchParams])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Hugin logo in bottom left corner */}
      <div className="absolute bottom-6 left-6">
        <Hugin className="w-6 h-6" />
      </div>

      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* Success Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 bg-green-900/50 border border-green-500">
            <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Email Verified!
          </h2>
          
          <p className="mt-2 text-sm text-gray-300">
            Your email address has been successfully verified.
          </p>

          {email && (
            <p className="mt-1 text-xs text-gray-400">
              {email}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-green-900/20 border border-green-500/30 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-300">
                  Account Activated
                </h3>
                <div className="mt-1 text-sm text-green-200">
                  <p>
                    Your account has been activated and you can now sign in to access Hugin.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              href="/auth/signin"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium text-white bg-red-800 hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
            >
              Sign In to Your Account
            </Link>

            <Link
              href="/"
              className="group relative w-full flex justify-center py-3 px-4 border border-gray-600 text-sm font-medium text-gray-300 bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
            >
              Go to Homepage
            </Link>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Welcome to Hugin - Real-time market research platform
          </p>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <VerifyEmailSuccessContent />
    </Suspense>
  )
}
