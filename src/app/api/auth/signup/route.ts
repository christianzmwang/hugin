import { NextRequest, NextResponse } from 'next/server'
import { createUser, validateEmail, validatePassword } from '@/lib/auth-helpers'

// Function to verify reCAPTCHA Enterprise token
async function verifyRecaptcha(token: string): Promise<boolean> {
  try {
    const projectId = process.env.RECAPTCHA_PROJECT_ID
    const apiKey = process.env.RECAPTCHA_API_KEY
    
    if (!projectId || !apiKey) {
      console.error('reCAPTCHA Enterprise configuration missing')
      return false
    }

    const response = await fetch(
      `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: {
            token: token,
            expectedAction: 'LOGIN',
            siteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
          },
        }),
      }
    )

    if (!response.ok) {
      console.error('reCAPTCHA Enterprise API error:', response.status, response.statusText)
      return false
    }

    const data = await response.json()
    
    // Check if the token is valid and the score is acceptable
    // reCAPTCHA Enterprise returns a risk score (0.0-1.0)
    // Higher scores indicate lower risk
    const isValid = data.tokenProperties?.valid === true
    const score = data.riskAnalysis?.score || 0
    const actionMatches = data.tokenProperties?.action === 'LOGIN'
    
    // You can adjust the threshold (0.5) based on your security needs
    const scoreThreshold = 0.5
    
    console.log('reCAPTCHA Enterprise result:', {
      valid: isValid,
      score: score,
      action: data.tokenProperties?.action,
      reasons: data.riskAnalysis?.reasons
    })
    
    return isValid && actionMatches && score >= scoreThreshold
  } catch (error) {
    console.error('reCAPTCHA verification error:', error)
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, name, recaptchaToken } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Verify reCAPTCHA token
    if (!recaptchaToken) {
      return NextResponse.json(
        { error: 'reCAPTCHA verification is required' },
        { status: 400 }
      )
    }

    const isRecaptchaValid = await verifyRecaptcha(recaptchaToken)
    if (!isRecaptchaValid) {
      return NextResponse.json(
        { error: 'reCAPTCHA verification failed' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: passwordValidation.errors },
        { status: 400 }
      )
    }

    // Create the user
    const user = await createUser({
      email: email.toLowerCase().trim(),
      password,
      name: name?.trim() || undefined
    })

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
