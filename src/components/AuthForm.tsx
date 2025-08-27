'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import RedDotWave from './RedDotWave'
import Munin from '../../public/munin.svg'

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
  

  
  // Cloudflare Turnstile state
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileLoaded, setTurnstileLoaded] = useState(false)
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string | null>(null)

  // Load Cloudflare Turnstile script
  useEffect(() => {
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
      if (existingScript && existingScript.parentNode) {
        try {
          existingScript.parentNode.removeChild(existingScript)
        } catch (error) {
          console.warn('Failed to remove Turnstile script:', error)
        }
      }
    }
  }, [mode])

  // Auto-render invisible Turnstile widget when loaded
  useEffect(() => {
    if (turnstileLoaded && !turnstileWidgetId) {
      // Use a timeout to ensure DOM is ready
      const timer = setTimeout(() => {
        const container = document.getElementById('turnstile-container')
        if (container && window.turnstile) {
          const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
          if (siteKey) {
            try {
              // Clear any existing widget first
              if (container.children.length > 0) {
                container.innerHTML = ''
              }
              
              const widgetId = window.turnstile.render(container, {
                sitekey: siteKey,
                size: 'invisible',
                callback: (token: string) => {
                  console.log('Invisible Turnstile token received:', token ? 'Present' : 'Missing')
                  setTurnstileToken(token)
                },
                'error-callback': () => {
                  console.error('Turnstile error occurred')
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
              setTurnstileToken(null)
            }
          } else {
            console.error('Turnstile site key not configured')
          }
        } else {
          console.warn('Turnstile container or API not available')
        }
      }, 100)
      
      return () => clearTimeout(timer)
    }
    
    // Cleanup widget when component unmounts or mode changes
    return () => {
      if (turnstileWidgetId && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetId)
        } catch (error) {
          console.warn('Failed to remove Turnstile widget:', error)
        }
      }
    }
  }, [mode, turnstileLoaded, turnstileWidgetId])

  // Cleanup widget on component unmount
  useEffect(() => {
    return () => {
      if (turnstileWidgetId && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetId)
          setTurnstileWidgetId(null)
          setTurnstileToken(null)
        } catch (error) {
          console.warn('Failed to cleanup Turnstile widget on unmount:', error)
        }
      }
    }
  }, [turnstileWidgetId])

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
          // Wait for the callback to set the token with a timeout
          let attempts = 0
          const maxAttempts = 100 // 10 seconds max wait
          const checkToken = () => {
            if (turnstileToken) {
              resolve(turnstileToken)
            } else if (attempts >= maxAttempts) {
              console.error('Turnstile execution timeout')
              resolve(null)
            } else {
              attempts++
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

  // Password generator function
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

  // Password validation for real-time feedback
  const validatePasswordRequirements = (password: string) => {
    return {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSymbol: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)
    }
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
            email: formData.email,
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
          email: formData.email,
          password: formData.password,
          redirect: false,
        })

        if (signInResult?.error) {
          setError('Registration successful, but sign-in failed. Please try signing in manually.')
        } else {
          // Redirect to countdown page after successful signup and sign-in
          router.push('/countdown')
        }
        
        // Reset Turnstile token state
        setTurnstileToken(null)
        if (turnstileWidgetId && window.turnstile) {
          try {
            window.turnstile.reset(turnstileWidgetId)
          } catch (error) {
            console.warn('Failed to reset Turnstile widget:', error)
          }
        }
      } else {
        // Execute invisible Turnstile verification for signin
        console.log('Executing invisible Turnstile verification for signin...')
        const token = await executeTurnstile()
        
        if (!token) {
          setError('Security verification failed. Please try again.')
          setIsLoading(false)
          return
        }
        
        console.log('Turnstile verification successful for signin')

        // Sign in existing user
        const result = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        })

        if (result?.error) {
          setError('Invalid email or password')
        } else {
          router.push('/countdown')
        }
        
        // Reset Turnstile token state
        setTurnstileToken(null)
        if (turnstileWidgetId && window.turnstile) {
          try {
            window.turnstile.reset(turnstileWidgetId)
          } catch (error) {
            console.warn('Failed to reset Turnstile widget:', error)
          }
        }
      }
    } catch {
      setError('An unexpected error occurred')
      // Reset Turnstile token state on error
      setTurnstileToken(null)
      if (turnstileWidgetId && window.turnstile) {
        try {
          window.turnstile.reset(turnstileWidgetId)
        } catch (error) {
          console.warn('Failed to reset Turnstile widget on error:', error)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn('google', { callbackUrl: '/countdown' })
    } catch {
      setError('Google sign-in failed')
      setIsLoading(false)
    }
  }



  return (
    <div className="h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-black relative">
      {/* Munin image in bottom left corner */}
      <div className="absolute bottom-6 left-6">
        <Munin className="w-6 h-6" />
      </div>

      {/* Two-column layout with wave image */}
      <div className="flex w-full h-full">
        {/* Left side - RedDotWave (50% width, 100% height) */}
        <div className="hidden lg:flex w-1/2 h-full">
          <RedDotWave 
            showControls={false}
            color="#ff2d20"
            background="#000000"
            amplitude={4}
            speed={0.8}
            gridSize={80}
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
          
          <div className="shadow-sm space-y-6">
            <div className="relative">
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full px-1 py-2 bg-transparent border-0 border-b border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-red-600 focus:ring-0 focus:z-10 sm:text-sm"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
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
                className={`relative block w-full px-1 py-2 ${mode === 'signup' ? 'pr-16' : 'pr-10'} bg-transparent border-0 border-b border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-red-600 focus:ring-0 focus:z-10 sm:text-sm`}
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              
              {/* Password visibility toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute inset-y-0 ${mode === 'signup' ? 'right-8' : 'right-0'} pr-3 flex items-center text-gray-400 hover:text-white z-20`}
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

            {/* Password requirements for signup */}
            {mode === 'signup' && (
              <div className="mt-3">
                <div className="text-xs text-gray-400">
                  {(() => {
                    const requirements = validatePasswordRequirements(formData.password)
                    return (
                      <div className="w-full flex justify-between">
                        <div className={`flex items-center ${requirements.minLength ? 'text-green-400' : 'text-red-400'}`}>
                          {requirements.minLength ? (
                            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          8+ chars
                        </div>
                        <div className={`flex items-center ${requirements.hasUppercase ? 'text-green-400' : 'text-red-400'}`}>
                          {requirements.hasUppercase ? (
                            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          A-Z
                        </div>
                        <div className={`flex items-center ${requirements.hasLowercase ? 'text-green-400' : 'text-red-400'}`}>
                          {requirements.hasLowercase ? (
                            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          a-z
                        </div>
                        <div className={`flex items-center ${requirements.hasNumber ? 'text-green-400' : 'text-red-400'}`}>
                          {requirements.hasNumber ? (
                            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          0-9
                        </div>
                        <div className={`flex items-center ${requirements.hasSymbol ? 'text-green-400' : 'text-red-400'}`}>
                          {requirements.hasSymbol ? (
                            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          special char
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Invisible Turnstile widget container */}
          <div id="turnstile-container" className="hidden"></div>

          <div>
            <button
              type="submit"
              disabled={isLoading || !turnstileLoaded}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium text-white bg-red-800 hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
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
