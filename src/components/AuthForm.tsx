'use client'

import { useState, useRef, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface AuthFormProps {
  mode: 'signin' | 'signup'
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  })

  // State for password visibility
  const [showPassword, setShowPassword] = useState(false)
  
  // reCAPTCHA state
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false)

  // Load reCAPTCHA Enterprise script
  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
    if (!siteKey) {
      console.error('reCAPTCHA site key not configured')
      return
    }

    // Check if script is already loaded
    if (window.grecaptcha?.enterprise) {
      setRecaptchaLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${siteKey}`
    script.async = true
    script.defer = true
    script.onload = () => {
      setRecaptchaLoaded(true)
    }
    script.onerror = () => {
      console.error('Failed to load reCAPTCHA Enterprise script')
    }

    document.head.appendChild(script)

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector(`script[src*="recaptcha/enterprise.js"]`)
      if (existingScript) {
        document.head.removeChild(existingScript)
      }
    }
  }, [])

  // Function to execute reCAPTCHA Enterprise
  const executeRecaptcha = async (): Promise<string | null> => {
    if (!recaptchaLoaded || !window.grecaptcha?.enterprise) {
      console.error('reCAPTCHA Enterprise not loaded')
      return null
    }

    try {
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
      if (!siteKey) {
        console.error('reCAPTCHA site key not configured')
        return null
      }

      return new Promise((resolve) => {
        window.grecaptcha!.enterprise!.ready(async () => {
          try {
            const token = await window.grecaptcha!.enterprise!.execute(siteKey, {
              action: 'LOGIN'
            })
            resolve(token)
          } catch (error) {
            console.error('reCAPTCHA execution error:', error)
            resolve(null)
          }
        })
      })
    } catch (error) {
      console.error('reCAPTCHA Enterprise error:', error)
      return null
    }
  }

  // Crypto-grade randomness helper
  const getRandomInt = (max: number) => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const array = new Uint32Array(1)
      window.crypto.getRandomValues(array)
      return array[0] % max
    }
    return Math.floor(Math.random() * max)
  }

  // High-grade generator functions for signup
  const generateUsername = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    
    // Variable length between 8-16 characters for username
    const length = getRandomInt(9) + 8 // 8-16 chars
    const minComplexity = Math.floor(length / 3) // Scale complexity with length
    
    let username = ''
    
    // Ensure complexity with multiple chars from each category (no symbols for username)
    for (let i = 0; i < minComplexity; i++) {
      username += uppercase[getRandomInt(uppercase.length)]
      username += lowercase[getRandomInt(lowercase.length)]
      username += numbers[getRandomInt(numbers.length)]
    }
    
    // Add additional random characters to reach target length
    const allChars = uppercase + lowercase + numbers
    for (let i = username.length; i < length; i++) {
      username += allChars[getRandomInt(allChars.length)]
    }
    
    // Shuffle using Fisher-Yates algorithm
    const chars = username.split('')
    for (let i = chars.length - 1; i > 0; i--) {
      const j = getRandomInt(i + 1)
      ;[chars[i], chars[j]] = [chars[j], chars[i]]
    }
    
    return chars.join('')
  }

  const generatePassword = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'
    
    // Variable length between 12-20 characters
    const length = getRandomInt(9) + 12 // 12-20 chars
    const minComplexity = Math.floor(length / 4) // Scale complexity with length
    
    let password = ''
    
    // Ensure complexity with multiple chars from each category
    for (let i = 0; i < minComplexity; i++) {
      password += uppercase[getRandomInt(uppercase.length)]
      password += lowercase[getRandomInt(lowercase.length)]
      password += numbers[getRandomInt(numbers.length)]
      password += symbols[getRandomInt(symbols.length)]
    }
    
    // Add additional random characters to reach target length
    const allChars = uppercase + lowercase + numbers + symbols
    for (let i = password.length; i < length; i++) {
      password += allChars[getRandomInt(allChars.length)]
    }
    
    // Shuffle using Fisher-Yates algorithm
    const chars = password.split('')
    for (let i = chars.length - 1; i > 0; i--) {
      const j = getRandomInt(i + 1)
      ;[chars[i], chars[j]] = [chars[j], chars[i]]
    }
    
    return chars.join('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (mode === 'signup') {
        // Execute reCAPTCHA Enterprise for signup
        const token = await executeRecaptcha()
        if (!token) {
          setError('reCAPTCHA verification failed. Please try again.')
          setIsLoading(false)
          return
        }

        // Register new user
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            recaptchaToken: token
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Registration failed')
          setIsLoading(false)
          return
        }

        // After successful registration, sign in the user
        const signInResult = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        })

        if (signInResult?.error) {
          setError('Registration successful, but sign-in failed. Please try signing in manually.')
        } else {
          router.push('/')
        }
        
        // Reset reCAPTCHA token state
        setRecaptchaToken(null)
      } else {
        // Sign in existing user
        const result = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        })

        if (result?.error) {
          setError('Invalid email or password')
        } else {
          router.push('/')
        }
      }
    } catch {
      setError('An unexpected error occurred')
      // Reset reCAPTCHA token state on error
      if (mode === 'signup') {
        setRecaptchaToken(null)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn('google', { callbackUrl: '/' })
    } catch {
      setError('Google sign-in failed')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-black relative">
      {/* Munin image in bottom left corner */}
      <div className="absolute bottom-6 left-6 w-6 h-6">
        <img 
          src="/whitemunin.jpg" 
          alt="Munin" 
          className="w-full h-full object-contain"
        />
      </div>

      {/* Two-column layout with wave image */}
      <div className="flex w-full h-full">
        {/* Left side - Wave image (50% width) */}
        <div className="hidden lg:flex w-1/2 items-center justify-center">
          <img 
            src="/wave.png" 
            alt="Wave" 
            className="max-w-full max-h-[80vh] object-contain mt-16"
          />
        </div>
        
        {/* Right side - Form (50% width) */}
        <div className="w-full lg:w-1/2 flex items-center justify-center">
          <div className="max-w-lg w-full space-y-8 px-8">
        <div>
          <h2 className="mt-6 text-2xl lg:text-3xl font-extrabold text-white text-left whitespace-nowrap">
            {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
          </h2>
          <p className="mt-2 text-sm text-gray-300 text-left">
            {mode === 'signin' ? (
              <>
                Don&apos;t have an account?{' '}
                <a href="/auth/signup" className="font-medium text-red-400 hover:text-red-300">
                  Sign up
                </a>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <a href="/auth/signin" className="font-medium text-red-400 hover:text-red-300">
                  Sign in
                </a>
              </>
            )}
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="p-4 bg-red-900/50 border border-red-500">
              <div className="text-sm text-red-200">{error}</div>
            </div>
          )}
          
          <div className="shadow-sm -space-y-px">
            <div className="relative">
              <label htmlFor="email" className="sr-only">
                Username
              </label>
              <input
                id="email"
                name="email"
                type="text"
                autoComplete="username"
                required
                readOnly={mode === 'signup'}
                className={`relative block w-full px-3 py-2 pr-12 border border-gray-600 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-red-600 focus:border-red-600 focus:z-10 sm:text-sm ${
                  mode === 'signup' ? 'cursor-pointer' : ''
                }`}
                placeholder={mode === 'signup' ? 'Use generator to create username' : 'Username'}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              {mode === 'signup' && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, email: generateUsername() })}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                  title="Generate username"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>
            
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                readOnly={mode === 'signup'}
                className={`relative block w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-red-600 focus:border-red-600 focus:z-10 sm:text-sm ${
                  mode === 'signup' ? 'pr-20 cursor-pointer' : 'pr-12'
                }`}
                placeholder={mode === 'signup' ? 'Use generator to create password' : 'Password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              
              {/* Password visibility toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute inset-y-0 flex items-center text-gray-400 hover:text-white ${
                  mode === 'signup' ? 'right-8' : 'right-0'
                } pr-3`}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>

              {/* Password generator for signup */}
              {mode === 'signup' && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, password: generatePassword() })}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                  title="Generate password"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* reCAPTCHA Enterprise runs invisibly during form submission */}

          <div>
            <button
              type="submit"
              disabled={isLoading || (mode === 'signup' && !recaptchaLoaded)}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-black text-gray-400">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-600 bg-gray-900 text-gray-300 hover:bg-gray-800 shadow-sm text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="ml-2">Google</span>
              </button>
            </div>
          </div>
        </form>
          </div>
        </div>
      </div>
    </div>
  )
}
