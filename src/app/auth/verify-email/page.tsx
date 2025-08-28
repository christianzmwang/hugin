'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Munin from '../../../../public/munin.svg'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    const token = searchParams.get('token')
    
    if (!token) {
      setStatus('error')
      setMessage('No verification token provided')
      return
    }

    // Verify the token
    const verifyToken = async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        })

        const data = await response.json()

        if (data.success) {
          setStatus('success')
          setMessage('Your email has been successfully verified!')
          // Redirect to success page after a short delay
          setTimeout(() => {
            router.push('/auth/verify-email/success')
          }, 2000)
        } else {
          setStatus('error')
          setMessage(data.message || 'Verification failed')
          // Redirect to error page after a short delay
          setTimeout(() => {
            router.push(`/auth/verify-email/error?message=${encodeURIComponent(data.message || 'Verification failed')}`)
          }, 3000)
        }
      } catch (error) {
        console.error('Verification error:', error)
        setStatus('error')
        setMessage('An error occurred during verification')
        setTimeout(() => {
          router.push('/auth/verify-email/error?message=An%20error%20occurred%20during%20verification')
        }, 3000)
      }
    }

    verifyToken()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Munin logo in bottom left corner */}
      <div className="absolute bottom-6 left-6">
        <Munin className="w-6 h-6" />
      </div>

      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* Status Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 bg-gray-900/50 border border-gray-500">
            {status === 'loading' && (
              <svg className="animate-spin h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {status === 'success' && (
              <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {status === 'error' && (
              <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          <h2 className="mt-6 text-3xl font-extrabold text-white">
            {status === 'loading' && 'Verifying Email...'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </h2>
          
          <p className="mt-2 text-sm text-gray-300">
            {message}
          </p>

          {status === 'loading' && (
            <p className="mt-4 text-xs text-gray-500">
              Please wait while we verify your email address...
            </p>
          )}

          {status === 'success' && (
            <p className="mt-4 text-xs text-gray-500">
              Redirecting you to the success page...
            </p>
          )}

          {status === 'error' && (
            <p className="mt-4 text-xs text-gray-500">
              Redirecting you to the error page for more details...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
