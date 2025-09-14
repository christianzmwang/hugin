'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setStatus('submitting')
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      setStatus('sent')
    } catch (e) {
      console.error(e)
      setStatus('sent') // still generic
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-white">Forgot password</h1>
        {status !== 'sent' ? (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-900/50 border border-red-500 text-red-200 text-sm">{error}</div>
            )}
            <div>
              <label className="block text-sm text-gray-300 mb-1" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-transparent border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-red-600"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full py-2.5 bg-red-800 hover:bg-red-900 text-white text-sm font-medium disabled:opacity-50"
            >
              {status === 'submitting' ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        ) : (
          <div className="p-4 bg-gray-900 border border-gray-700 text-gray-200 text-sm">
            If an account exists for that email, we just sent a password reset link. Please check your inbox.
          </div>
        )}
        <div className="text-sm text-gray-400">
          <Link href="/auth/signin" className="text-red-400 hover:text-red-300">Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}
