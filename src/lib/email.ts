import { Resend } from 'resend'

// Initialize Resend with API key - use dummy key during build if not set
const resend = new Resend(process.env.RESEND_API_KEY || 'dummy-key-for-build')

/**
 * Get the base URL from request host or fallback to environment
 */
function getBaseUrl(requestHost?: string): string {
  // If request host is provided, use it (this captures the actual domain user is visiting)
  if (requestHost) {
    // Handle localhost for development
    if (requestHost.includes('localhost') || requestHost.includes('127.0.0.1')) {
      return `http://${requestHost}`
    }
    // Production domains (ensure HTTPS)
    return `https://${requestHost}`
  }
  
  // Fallback to Vercel URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  // If no URL is available, throw an error
  throw new Error('Base URL not configured. Please ensure VERCEL_URL is available or pass request host.')
}

/**
 * Extract host from NextRequest for email URL generation
 */
export function getHostFromRequest(request: Request): string | undefined {
  // Try to get host from headers
  const host = request.headers.get('host')
  if (host) {
    return host
  }
  
  // Try to get from x-forwarded-host (common in proxied environments)
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) {
    return forwardedHost
  }
  
  return undefined
}

export interface EmailVerificationData {
  email: string
  name?: string
  verificationToken: string
  baseUrl?: string // Optional: override base URL (e.g., from request host)
}

/**
 * Send email verification email to user
 */
export async function sendVerificationEmail(data: EmailVerificationData) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured')
      return false
    }

    const verificationUrl = `${getBaseUrl(data.baseUrl)}/auth/verify-email?token=${data.verificationToken}`
    
    const { data: emailResult, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Allvitr <noreply@send.allvitr.com>',
      to: [data.email],
      subject: 'Verify your email address - Hugin',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - Hugin</title>
        </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f9f9f9; width: 100%; margin: 0; padding: 0;">
          <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff;">
            <div style="background: #000000; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to Hugin</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px;">Real-time market research platform by Allvitr</p>
            </div>
            
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb;">
            <h2 style="color: #1f2937; margin-top: 0;">Verify Your Email Address</h2>
            
            <p style="color: #4b5563;">Hi${data.name ? ` ${data.name}` : ''},</p>
            
            <p style="color: #4b5563;">Thank you for signing up for Hugin! To complete your registration and secure your account, please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 16px; ">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #4b5563;">If the button above doesn't work, you can also click on this link:</p>
            <p style="word-break: break-all; background: #f3f4f6; padding: 10px; font-family: monospace; font-size: 14px; border: 1px solid #d1d5db; ">
              <a href="${verificationUrl}" style="color: #dc2626;">${verificationUrl}</a>
            </p>
            
            <div style="background: #f9fafb; border: 1px solid #d1d5db; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #000000;">
                <strong>Important:</strong> This verification link will expire in 24 hours for security reasons. If you didn't create an account with us, you can safely ignore this email.
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              If you have any questions, please contact our support team at info@allvitr.com.
            </p>
            
            <p style="color: #6b7280; font-size: 14px;">
              Best regards,<br>
              The Allvitr Team
            </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; background-color: #f9f9f9;">
              <p>© ${new Date().getFullYear()} Allvitr. All rights reserved.</p>
              <p>This email was sent to ${data.email}. If you did not request this verification, please ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to Hugin!
        
        Hi${data.name ? ` ${data.name}` : ''},
        
        Thank you for signing up for Hugin! To complete your registration and secure your account, please verify your email address by visiting this link:
        
        ${verificationUrl}
        
        This verification link will expire in 24 hours for security reasons.
        
        If you didn't create an account with us, you can safely ignore this email.
        
        If you have any questions, please contact our support team at info@allvitr.com.
        
        Best regards,
        The Allvitr Team
        
        © ${new Date().getFullYear()} Allvitr. All rights reserved.
      `
    })

    if (error) {
      console.error('Failed to send verification email:', error)
      return false
    }

    console.log('Verification email sent successfully:', emailResult?.id)
    return true
  } catch (error) {
    console.error('Error sending verification email:', error)
    return false
  }
}

/**
 * Send email verification reminder
 */
export async function sendVerificationReminder(data: EmailVerificationData) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured')
      return false
    }

    const verificationUrl = `${getBaseUrl(data.baseUrl)}/auth/verify-email?token=${data.verificationToken}`
    
    const { data: emailResult, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Allvitr <noreply@send.allvitr.com>',
      to: [data.email],
      subject: 'Reminder: Verify your email address - Hugin',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification Reminder - Hugin</title>
        </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f9f9f9; width: 100%; margin: 0; padding: 0;">
          <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff;">
            <div style="background: #000000; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Hugin</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px;">Email Verification Reminder</p>
            </div>
            
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb;">
            <h2 style="color: #1f2937; margin-top: 0;">Please Verify Your Email</h2>
            
            <p style="color: #4b5563;">Hi${data.name ? ` ${data.name}` : ''},</p>
            
            <p style="color: #4b5563;">We noticed you haven't verified your email address yet. To access your Hugin account and start using our platform, please verify your email by clicking the button below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 16px; ">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #4b5563;">If the button above doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f3f4f6; padding: 10px; font-family: monospace; font-size: 14px; border: 1px solid #d1d5db; ">
              <a href="${verificationUrl}" style="color: #dc2626;">${verificationUrl}</a>
            </p>
            
            <div style="background: #f9fafb; border: 1px solid #d1d5db; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #000000;">
                <strong>Note:</strong> Your account access is limited until you verify your email address.
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              If you have any questions, please contact our support team at info@allvitr.com.
            </p>
            
            <p style="color: #6b7280; font-size: 14px;">
              Best regards,<br>
              The Allvitr Team
            </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; background-color: #f9f9f9;">
              <p>© ${new Date().getFullYear()} Allvitr. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    })

    if (error) {
      console.error('Failed to send verification reminder:', error)
      return false
    }

    console.log('Verification reminder sent successfully:', emailResult?.id)
    return true
  } catch (error) {
    console.error('Error sending verification reminder:', error)
    return false
  }
}

export interface PasswordResetData {
  email: string
  name?: string
  resetToken: string
  baseUrl?: string
}

export async function sendPasswordResetEmail(data: PasswordResetData) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured')
      return false
    }

    const resetUrl = `${getBaseUrl(data.baseUrl)}/auth/reset-password?token=${data.resetToken}`

    const { data: emailResult, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Allvitr <noreply@send.allvitr.com>',
      to: [data.email],
      subject: 'Reset your password - Hugin',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password - Hugin</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f9f9f9; width: 100%; margin: 0; padding: 0;">
          <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff;">
            <div style="background: #000000; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Hugin</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px;">Password Reset</p>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb;">
              <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>
              <p style="color: #4b5563;">Hi${data.name ? ` ${data.name}` : ''},</p>
              <p style="color: #4b5563;">We received a request to reset your password for your Hugin account. Click the button below to set a new password. This link is valid for 30 minutes.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 16px;">Reset Password</a>
              </div>
              <p style="color: #4b5563;">If the button doesn’t work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #f3f4f6; padding: 10px; font-family: monospace; font-size: 14px; border: 1px solid #d1d5db;"><a href="${resetUrl}" style="color: #dc2626;">${resetUrl}</a></p>
              <p style="color: #6b7280; font-size: 14px;">If you didn’t request a password reset, you can safely ignore this email.</p>
            </div>
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; background-color: #f9f9f9;">
              <p>© ${new Date().getFullYear()} Allvitr. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Reset your Hugin password

        Hi${data.name ? ` ${data.name}` : ''},

        We received a request to reset your password. Use the link below to set a new password (valid for 30 minutes):

        ${resetUrl}

        If you did not request this, you can ignore this message.

        © ${new Date().getFullYear()} Allvitr.`
    })

    if (error) {
      console.error('Failed to send password reset email:', error)
      return false
    }

    console.log('Password reset email sent successfully:', emailResult?.id)
    return true
  } catch (error) {
    console.error('Error sending password reset email:', error)
    return false
  }
}
