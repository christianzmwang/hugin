import { NextRequest, NextResponse } from 'next/server'
import { createUser, validateEmail, validatePassword } from '@/lib/auth-helpers'

// Function to verify Cloudflare Turnstile token
async function verifyTurnstile(token: string): Promise<boolean> {
  try {
    const secretKey = process.env.TURNSTILE_SECRET_KEY
    
    if (!secretKey) {
      console.error('Turnstile secret key missing')
      return false
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    })

    if (!response.ok) {
      console.error('Turnstile API error:', response.status, response.statusText)
      return false
    }

    const data = await response.json()
    
    // Check if the token is valid
    // Turnstile returns a simple success/failure response
    const isValid = data.success === true
    
    console.log('Turnstile verification result:', {
      success: isValid,
      challenge_ts: data.challenge_ts,
      hostname: data.hostname,
      error_codes: data['error-codes'] || []
    })
    
    if (!isValid && data['error-codes']) {
      console.error('Turnstile validation failed:', data['error-codes'])
    }
    
    return isValid
  } catch (error) {
    console.error('Turnstile verification error:', error)
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, name, turnstileToken } = body

    console.log('Signup attempt:', { 
      hasEmail: !!email, 
      hasPassword: !!password, 
      hasName: !!name,
      hasTurnstileToken: !!turnstileToken,
      email: email?.substring(0, 3) + '***' // Only show first 3 chars for privacy
    })

    // Validate required fields
    if (!email || !password) {
      console.log('Missing email or password:', { email: !!email, password: !!password })
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Verify Turnstile token
    if (!turnstileToken) {
      return NextResponse.json(
        { error: 'Security verification is required' },
        { status: 400 }
      )
    }

    const isTurnstileValid = await verifyTurnstile(turnstileToken)
    if (!isTurnstileValid) {
      return NextResponse.json(
        { error: 'Security verification failed' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!validateEmail(email)) {
      console.log('Email validation failed for:', email)
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      console.log('Password validation failed:', passwordValidation.errors)
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: passwordValidation.errors },
        { status: 400 }
      )
    }

    // Create the user
    console.log('Creating user with email:', email.toLowerCase().trim())
    const user = await createUser({
      email: email.toLowerCase().trim(),
      password,
      name: name?.trim() || undefined
    })
    
    if (!user) {
      console.log('User creation failed - user already exists or database error')
      return NextResponse.json(
        { error: 'Failed to create user. Email may already be in use.' },
        { status: 400 }
      )
    }
    
    console.log('User created successfully:', user.id)

    // Return user data (without password)
    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: user?.id,
        email: user?.email,
        name: user?.name
      }
    }, { status: 201 })

  } catch (error: unknown) {
    console.error('Signup error:', error)
    
    if (error instanceof Error && error.message === 'User already exists with this email') {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}
