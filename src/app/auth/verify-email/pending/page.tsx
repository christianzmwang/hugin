'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Munin from '../../../../../public/munin.svg'

function VerifyEmailPendingContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState<string>('')
  
  // Countdown state
  const [countdownTime, setCountdownTime] = useState<number>(0)
  const [resendAttempts, setResendAttempts] = useState<number>(0)
  const [isCountdownActive, setIsCountdownActive] = useState(false)

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
      
      // Load countdown state from localStorage for this email
      const storageKey = `resend_countdown_${emailParam}`
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
    }
  }, [searchParams])

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
    if (!email) {
      setResendError('Email address is required')
      return
    }

    setIsLoading(true)
    setResendError('')
    setResendSuccess(false)

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()
      
      if (data.success) {
        setResendSuccess(true)
        
        // Start countdown: 2 minutes for first attempt, then double each time
        const newAttempts = resendAttempts + 1
        const baseTime = 2 * 60 // 2 minutes in seconds
        const countdownSeconds = baseTime * Math.pow(2, resendAttempts) // Double each time
        
        setResendAttempts(newAttempts)
        setCountdownTime(countdownSeconds)
        setIsCountdownActive(true)
        
        // Store countdown state in localStorage
        const storageKey = `resend_countdown_${email}`
        const endTime = Date.now() + (countdownSeconds * 1000)
        localStorage.setItem(storageKey, JSON.stringify({
          endTime,
          attempts: newAttempts
        }))
        
      } else {
        setResendError(data.message || data.error || 'Failed to resend verification email')
      }
    } catch (error) {
      console.error('Resend verification error:', error)
      setResendError('An error occurred while resending the verification email')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Munin logo in bottom left corner */}
      <div className="absolute bottom-6 left-6">
        <Munin className="w-6 h-6" />
      </div>

      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* Email Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 bg-red-900/50 border border-red-500">
            <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.945a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Check Your Email
          </h2>
          
          <p className="mt-2 text-sm text-gray-300">
            We&apos;ve sent a verification link to your email address.
          </p>

          {email && (
            <p className="mt-1 text-sm font-medium text-red-400">
              {email}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-red-900/20 border border-red-500/30 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-300">
                  Next Steps
                </h3>
                <div className="mt-1 text-sm text-red-200">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Check your email inbox for the verification link</li>
                    <li>Don&apos;t forget to check your spam/junk folder</li>
                    <li>Click the verification link to activate your account</li>
                    <li>The link will expire in 24 hours</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {resendSuccess && (
            <div className="bg-green-900/20 border border-green-500/30 p-4">
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
                      A new verification email has been sent to your address.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {resendError && (
            <div className="bg-red-900/20 border border-red-500/30 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-300">
                    Error
                  </h3>
                  <div className="mt-1 text-sm text-red-200">
                    <p>{resendError}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm text-gray-400 text-center">
              Didn&apos;t receive the email?
            </p>

            <button
              onClick={handleResendVerification}
              disabled={isLoading || !email || isCountdownActive}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium text-white bg-red-800 hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading 
                ? 'Sending...' 
                : isCountdownActive 
                  ? `Wait ${formatCountdownTime(countdownTime)}` 
                  : `Resend Verification Email${resendAttempts > 0 ? ` (Attempt ${resendAttempts + 1})` : ''}`
              }
            </button>

            

            <Link
              href="/auth/signin"
              className="group relative w-full flex justify-center py-3 px-4 border border-gray-600 text-sm font-medium text-gray-300 bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            The verification link will expire in 24 hours for security reasons.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPendingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <VerifyEmailPendingContent />
    </Suspense>
  )
}
