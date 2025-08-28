import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { sendVerificationEmail, getHostFromRequest } from '@/lib/email'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      )
    }

    // Get user details
    const userResult = await query<{
      id: string
      name: string | null
      email: string
      emailVerified: Date | null
    }>(`
      SELECT id, name, email, "emailVerified"
      FROM users 
      WHERE LOWER(email) = LOWER($1)
    `, [email.trim()])

    if (userResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No account found with this email address'
      })
    }

    const user = userResult.rows[0]

    if (user.emailVerified) {
      return NextResponse.json({
        success: false,
        message: 'Email is already verified'
      })
    }

    // Check for recent verification tokens (cooldown: 2 minutes)
    const recentToken = await query<{
      expires: Date
    }>(`
      SELECT expires FROM verification_tokens 
      WHERE identifier = $1 
      AND expires > NOW()
      ORDER BY expires DESC 
      LIMIT 1
    `, [user.email])

    if (recentToken.rows.length > 0) {
      const tokenExpires = new Date(recentToken.rows[0].expires)
      // If token expires in more than 23 hours and 58 minutes, it was created recently (within 2 minutes)
      const recentlyCreated = tokenExpires.getTime() > Date.now() + (23 * 60 + 58) * 60 * 1000
      
      if (recentlyCreated) {
        return NextResponse.json({
          success: false,
          message: `Please wait 2 minutes before requesting another verification email.`
        })
      }
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Delete any existing verification tokens for this user
    await query(`
      DELETE FROM verification_tokens 
      WHERE identifier = $1
    `, [user.email])

    // Insert new verification token
    await query(`
      INSERT INTO verification_tokens (identifier, token, expires)
      VALUES ($1, $2, $3)
    `, [user.email, verificationToken, expires])

    // Send verification email with the actual domain the user is visiting
    const requestHost = getHostFromRequest(request)
    const emailSent = await sendVerificationEmail({
      email: user.email,
      name: user.name || undefined,
      verificationToken,
      baseUrl: requestHost
    })

    if (!emailSent) {
      return NextResponse.json({
        success: false,
        message: 'Failed to send verification email'
      })
    }

    console.log(`📧 Resent verification email to: ${user.email}`)

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully'
    })

  } catch (error) {
    console.error('Error resending verification email:', error)
    return NextResponse.json(
      { 
        success: false,
        message: 'Failed to resend verification email',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}