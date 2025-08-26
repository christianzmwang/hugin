'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface AuthFormProps {
  mode: 'signin' | 'signup'
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: ''
  })

  // State for password visibility
  const [showPassword, setShowPassword] = useState(false)
  
  // State for successful signup
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [signupCredentials, setSignupCredentials] = useState({
    username: '',
    password: ''
  })
  
  // Cloudflare Turnstile state
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileLoaded, setTurnstileLoaded] = useState(false)
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string | null>(null)

  // Load Cloudflare Turnstile script
  useEffect(() => {
    if (mode !== 'signup') return // Only load for signup

    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!siteKey) {
      console.error('Turnstile site key not configured')
      return
    }

    // Check if script is already loaded
    if (window.turnstile?.ready) {
      setTurnstileLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = () => {
      setTurnstileLoaded(true)
    }
    script.onerror = () => {
      console.error('Failed to load Turnstile script')
    }

    document.head.appendChild(script)

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector(`script[src*="challenges.cloudflare.com/turnstile"]`)
      if (existingScript) {
        document.head.removeChild(existingScript)
      }
    }
  }, [mode])

  // Auto-render invisible Turnstile widget when loaded
  useEffect(() => {
    if (mode === 'signup' && turnstileLoaded && !turnstileWidgetId) {
      // Use a timeout to ensure DOM is ready
      const timer = setTimeout(() => {
        const container = document.getElementById('turnstile-container')
        if (container && window.turnstile) {
          const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
          if (siteKey) {
            try {
              const widgetId = window.turnstile.render(container, {
                sitekey: siteKey,
                size: 'invisible',
                callback: (token: string) => {
                  console.log('Invisible Turnstile token received:', token ? 'Present' : 'Missing')
                  setTurnstileToken(token)
                },
                'error-callback': () => {
                  console.error('Turnstile error')
                  setTurnstileToken(null)
                },
                'expired-callback': () => {
                  console.log('Turnstile token expired')
                  setTurnstileToken(null)
                }
              })
              setTurnstileWidgetId(widgetId)
            } catch (error) {
              console.error('Failed to render Turnstile widget:', error)
            }
          }
        }
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [mode, turnstileLoaded, turnstileWidgetId])

  // Function to execute invisible Turnstile challenge
  const executeTurnstile = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!turnstileLoaded || !window.turnstile || !turnstileWidgetId) {
        console.error('Turnstile not ready for execution')
        resolve(null)
        return
      }

      try {
        // Execute the invisible challenge
        window.turnstile.execute(turnstileWidgetId)
        
        // The token will be delivered via the callback we set during render
        // If we already have a token, resolve immediately
        if (turnstileToken) {
          resolve(turnstileToken)
        } else {
          // Wait for the callback to set the token
          const checkToken = () => {
            if (turnstileToken) {
              resolve(turnstileToken)
            } else {
              setTimeout(checkToken, 100)
            }
          }
          checkToken()
        }
      } catch (error) {
        console.error('Turnstile execution error:', error)
        resolve(null)
      }
    })
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
        // Execute invisible Turnstile verification
        console.log('Executing invisible Turnstile verification...')
        const token = await executeTurnstile()
        
        if (!token) {
          setError('Security verification failed. Please try again.')
          setIsLoading(false)
          return
        }
        
        console.log('Turnstile verification successful')

        // Register new user
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: formData.username,
            password: formData.password,
            name: formData.name,
            turnstileToken: token
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
          username: formData.username,
          password: formData.password,
          redirect: false,
        })

        if (signInResult?.error) {
          setError('Registration successful, but sign-in failed. Please try signing in manually.')
        }
        
        // Show success screen with credentials and let the user proceed
        setSignupCredentials({ username: formData.username, password: formData.password })
        setSignupSuccess(true)
        
        // Reset Turnstile token state
        setTurnstileToken(null)
        if (turnstileWidgetId && window.turnstile) {
          window.turnstile.reset(turnstileWidgetId)
        }
      } else {
        // Sign in existing user
        const result = await signIn('credentials', {
          username: formData.username,
          password: formData.password,
          redirect: false,
        })

        if (result?.error) {
          setError('Invalid username or password')
        } else {
          router.push('/')
        }
      }
    } catch {
      setError('An unexpected error occurred')
      // Reset Turnstile token state on error
      if (mode === 'signup') {
        setTurnstileToken(null)
        if (turnstileWidgetId && window.turnstile) {
          window.turnstile.reset(turnstileWidgetId)
        }
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

  // Copy to clipboard function
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-black relative">
      {/* Munin image in bottom left corner */}
      <div className="absolute bottom-6 left-6 w-6 h-6">
        <Image 
          src="/whitemunin.jpg" 
          alt="Munin" 
          width={24}
          height={24}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Two-column layout with wave image */}
      <div className="flex w-full h-full">
        {/* Left side - Wave image (50% width) */}
        <div className="hidden lg:flex w-1/2 items-center justify-center">
          <Image 
            src="/wave.png" 
            alt="Wave" 
            width={800}
            height={600}
            className="max-w-full max-h-[80vh] object-contain mt-16"
          />
        </div>
        
        {/* Right side - Form (50% width) */}
        <div className="w-full lg:w-1/2 flex items-center justify-center">
          <div className="max-w-lg w-full space-y-8 px-8">
        {!signupSuccess && (
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
        )}
        
        {signupSuccess ? (
          // Success view with credentials display
          <div className="mt-8 space-y-6">
            <div className="text-left">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-white text-left">Account Created Successfully!</h3>
                <p className="mt-1 text-sm text-gray-400 text-left">Your credentials are shown below. Please save them securely.</p>
              </div>

              {/* Username display with copy */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2 text-left">Username</label>
                <div className="flex items-stretch space-x-2">
                  <div className="flex-1 bg-transparent border-0 border-b border-gray-600 px-1 py-2 text-white font-mono text-sm overflow-x-auto text-left">
                    {signupCredentials.username}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(signupCredentials.username)}
                    className="px-3 py-2 text-white text-sm font-medium transition-colors bg-transparent hover:bg-transparent"
                    title="Copy username"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Password display with copy */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2 text-left">Password</label>
                <div className="flex items-stretch space-x-2">
                  <div className="flex-1 bg-transparent border-0 border-b border-gray-600 px-1 py-2 text-white font-mono text-sm overflow-x-auto text-left">
                    {signupCredentials.password}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(signupCredentials.password)}
                    className="px-3 py-2 text-white text-sm font-medium transition-colors bg-transparent hover:bg-transparent"
                    title="Copy password"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Security message */}
              <div className="bg-yellow-900/50 border border-yellow-500 p-4 mb-6 text-left">
                <div className="flex">
                  <svg className="h-5 w-5 text-yellow-400 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-yellow-400">Important Security Notice</h4>
                    <p className="mt-1 text-sm text-yellow-200">
                      Please store your username and password securely. Consider using a password manager to keep your credentials safe.
                    </p>
                  </div>
                </div>
              </div>

              {/* Continue button */}
              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors mt-4"
              >
                Get started
              </button>
            </div>
          </div>
        ) : (
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="p-4 bg-red-900/50 border border-red-500">
              <div className="text-sm text-red-200">{error}</div>
            </div>
          )}
          
          <div className="shadow-sm space-y-6">
            <div className="relative">
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                readOnly={mode === 'signup'}
                className={`relative block w-full px-1 py-2 pr-20 bg-transparent border-0 border-b border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-red-600 focus:ring-0 focus:z-10 sm:text-sm ${
                  mode === 'signup' ? 'caret-transparent' : ''
                }`}
                placeholder={mode === 'signup' ? 'Use generator to create username' : 'Username'}
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
              {mode === 'signup' && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, username: generateUsername() })}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white z-20"
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
                className={`relative block w-full px-1 py-2 pr-20 bg-transparent border-0 border-b border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-red-600 focus:ring-0 focus:z-10 sm:text-sm ${
                  mode === 'signup' ? 'caret-transparent' : ''
                }`}
                placeholder={mode === 'signup' ? 'Use generator to create password' : 'Password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              
              {/* Password visibility toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute inset-y-0 flex items-center text-gray-400 hover:text-white z-20 ${
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
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white z-20"
                  title="Generate password"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Invisible Turnstile widget container */}
          {mode === 'signup' && (
            <div id="turnstile-container" className="hidden"></div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading || (mode === 'signup' && !turnstileLoaded)}
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
        )}
          </div>
        </div>
      </div>
    </div>
  )
}
