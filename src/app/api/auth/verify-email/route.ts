import { NextRequest, NextResponse } from 'next/server'
import { verifyEmailToken } from '@/lib/auth-helpers'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      )
    }

    console.log('Email verification attempt with token:', token.substring(0, 8) + '...')

    const result = await verifyEmailToken(token)

    if (result.success) {
      console.log('Email verification successful for:', result.email)
      
      // Redirect to verification success page
      const successUrl = new URL('/auth/verify-email/success', req.url)
      successUrl.searchParams.set('email', result.email || '')
      
      return NextResponse.redirect(successUrl)
    } else {
      console.log('Email verification failed:', result.error)
      
      // Redirect to verification error page
      const errorUrl = new URL('/auth/verify-email/error', req.url)
      errorUrl.searchParams.set('error', result.error || 'Unknown error')
      
      return NextResponse.redirect(errorUrl)
    }
  } catch (error) {
    console.error('Email verification error:', error)
    
    // Redirect to verification error page
    const errorUrl = new URL('/auth/verify-email/error', req.url)
    errorUrl.searchParams.set('error', 'Internal server error')
    
    return NextResponse.redirect(errorUrl)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Verification token is required' },
        { status: 400 }
      )
    }

    console.log('Email verification attempt with token:', token.substring(0, 8) + '...')

    const result = await verifyEmailToken(token)

    if (result.success) {
      console.log('Email verification successful for:', result.email)
      
      return NextResponse.json({
        success: true,
        message: 'Email verified successfully',
        email: result.email
      })
    } else {
      console.log('Email verification failed:', result.error)
      
      return NextResponse.json({
        success: false,
        message: result.error || 'Verification failed'
      })
    }
  } catch (error) {
    console.error('Email verification error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        message: 'Internal server error'
      },
      { status: 500 }
    )
  }
}
