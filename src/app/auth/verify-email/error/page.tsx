'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Hugin from '../../../../../public/hugin.svg'

function VerifyEmailErrorContent() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [email, setEmail] = useState('')
  
  // Countdown state
  const [countdownTime, setCountdownTime] = useState<number>(0)
  const [resendAttempts, setResendAttempts] = useState<number>(0)
  const [isCountdownActive, setIsCountdownActive] = useState(false)

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(errorParam)
    }
  }, [searchParams])

  // Load countdown state from localStorage when email changes
  useEffect(() => {
    if (!email) return
    
    const storageKey = `resend_countdown_${email}`
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      try {
        const { endTime, attempts } = JSON.parse(stored)
        const now = Date.now()
        const timeLeft = Math.max(0, endTime - now)
        
        if (timeLeft > 0) {
          setCountdownTime(Math.ceil(timeLeft / 1000))
          setResendAttempts(attempts)
          setIsCountdownActive(true)
        } else {
          // Cleanup expired countdown
          localStorage.removeItem(storageKey)
          setResendAttempts(attempts)
        }
      } catch {
        // Invalid stored data, ignore
      }
    }
  }, [email])

  // Countdown timer effect
  useEffect(() => {
    if (!isCountdownActive || countdownTime <= 0) {
      setIsCountdownActive(false)
      return
    }

    const timer = setInterval(() => {
      setCountdownTime(prev => {
        if (prev <= 1) {
          setIsCountdownActive(false)
          // Clear from localStorage when countdown ends
          if (email) {
            const storageKey = `resend_countdown_${email}`
            localStorage.removeItem(storageKey)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isCountdownActive, countdownTime, email])

  // Helper function to format countdown time
  const formatCountdownTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleResendVerification = async () => {
    if (!email.trim()) {
      alert('Please enter your email address')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      })

      if (response.ok) {
        setResendSuccess(true)
        
        // Start countdown: 2 minutes for first attempt, then double each time
        const newAttempts = resendAttempts + 1
        const baseTime = 2 * 60 // 2 minutes in seconds
        const countdownSeconds = baseTime * Math.pow(2, resendAttempts) // Double each time
        
        setResendAttempts(newAttempts)
        setCountdownTime(countdownSeconds)
        setIsCountdownActive(true)
        
        // Store countdown state in localStorage
        const storageKey = `resend_countdown_${email.trim()}`
        const endTime = Date.now() + (countdownSeconds * 1000)
        localStorage.setItem(storageKey, JSON.stringify({
          endTime,
          attempts: newAttempts
        }))
        
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to resend verification email')
      }
    } catch (error) {
      console.error('Resend verification error:', error)
      alert('An error occurred while resending the verification email')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Hugin logo in bottom left corner */}
      <div className="absolute bottom-6 left-6">
        <Hugin className="w-6 h-6" />
      </div>

      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* Error Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-900/50 border border-red-500">
            <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Verification Failed
          </h2>
          
          <p className="mt-2 text-sm text-gray-300">
            There was a problem verifying your email address.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-red-900/20 border border-red-500/30 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-300">
                  Error Details
                </h3>
                <div className="mt-1 text-sm text-red-200">
                  <p>
                    {error || 'The verification link is invalid or has expired.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {!resendSuccess ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-300 text-center">
                Need a new verification email?
              </p>
              
              <div>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>

              <button
                onClick={handleResendVerification}
                disabled={isLoading || isCountdownActive || !email.trim()}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium text-white bg-red-800 hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading 
                  ? 'Sending...' 
                  : isCountdownActive 
                    ? `Wait ${formatCountdownTime(countdownTime)}` 
                    : `Resend Verification Email${resendAttempts > 0 ? ` (Attempt ${resendAttempts + 1})` : ''}`
                }
              </button>

              
            </div>
          ) : (
            <div className="bg-green-900/20 border border-green-500/30 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-300">
                    Email Sent
                  </h3>
                  <div className="mt-1 text-sm text-green-200">
                    <p>
                      A new verification email has been sent to your address. Please check your inbox and spam folder.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Link
              href="/auth/signin"
              className="group relative w-full flex justify-center py-3 px-4 border border-gray-600 text-sm font-medium text-gray-300 bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
            >
              Back to Sign In
            </Link>

            <Link
              href="/auth/signup"
              className="group relative w-full flex justify-center py-3 px-4 border border-gray-600 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
            >
              Create New Account
            </Link>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Having trouble? Contact our support team for assistance.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <VerifyEmailErrorContent />
    </Suspense>
  )
}
