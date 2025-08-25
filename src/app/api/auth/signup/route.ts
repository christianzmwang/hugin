import { NextRequest, NextResponse } from 'next/server'
import { createUser, validateEmail, validatePassword } from '@/lib/auth-helpers'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, name } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
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
