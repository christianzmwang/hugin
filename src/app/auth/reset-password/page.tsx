'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')

  useEffect(() => {
    const t = searchParams.get('token') || ''
    setToken(t)
  }, [searchParams])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError('Missing or invalid token')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setStatus('submitting')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to reset password')
        setStatus('idle')
        return
      }
      setStatus('done')
      // Redirect to sign in after short delay
      setTimeout(() => router.push('/auth/signin?reset=success'), 1000)
    } catch (e) {
      console.error(e)
      setError('Failed to reset password')
      setStatus('idle')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-white">Reset password</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-500 text-red-200 text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-transparent border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-red-600"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="confirm">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full px-3 py-2 bg-transparent border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-red-600"
            />
          </div>
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full py-2.5 bg-red-800 hover:bg-red-900 text-white text-sm font-medium disabled:opacity-50"
          >
            {status === 'submitting' ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
        <div className="text-sm text-gray-400">
          <Link href="/auth/signin" className="text-red-400 hover:text-red-300">Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  )
}
