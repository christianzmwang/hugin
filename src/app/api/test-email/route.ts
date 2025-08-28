import { NextRequest, NextResponse } from 'next/server'
import { sendVerificationEmail } from '@/lib/email'
import { generateVerificationToken } from '@/lib/auth-helpers'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Generate a test verification token
    const verificationToken = generateVerificationToken()
    
    console.log('Testing email send to:', email)
    console.log('Environment check:', {
      hasResendKey: !!process.env.RESEND_API_KEY,
      resendKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 8) + '...',
      fromEmail: process.env.FROM_EMAIL,
      nextAuthUrl: process.env.NEXTAUTH_URL
    })

    // Attempt to send test email
    const emailSent = await sendVerificationEmail({
      email,
      name: 'Test User',
      verificationToken
    })

    if (emailSent) {
      console.log('✅ Test email sent successfully to:', email)
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully!',
        details: {
          email,
          fromEmail: process.env.FROM_EMAIL || 'Hugin <noreply@allvitr.com>',
          hasApiKey: !!process.env.RESEND_API_KEY
        }
      })
    } else {
      console.error('❌ Failed to send test email to:', email)
      return NextResponse.json({
        success: false,
        message: 'Failed to send test email',
        details: {
          email,
          hasApiKey: !!process.env.RESEND_API_KEY,
          fromEmail: process.env.FROM_EMAIL || 'Hugin <noreply@allvitr.com>'
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint with {"email": "your@email.com"} to test email sending',
    environmentCheck: {
      hasResendKey: !!process.env.RESEND_API_KEY,
      fromEmail: process.env.FROM_EMAIL || 'Not set (using default)',
      nextAuthUrl: process.env.NEXTAUTH_URL || 'Not set'
    }
  })
}
