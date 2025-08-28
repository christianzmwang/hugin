import { Resend } from 'resend'

// Initialize Resend with API key - use dummy key during build if not set
const resend = new Resend(process.env.RESEND_API_KEY || 'dummy-key-for-build')

/**
 * Get the base URL for the application with fallbacks
 */
function getBaseUrl(): string {
  // First try NEXTAUTH_URL (most reliable)
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
  }
  
  // Fallback for Vercel production
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  // Fallback to known production domain
  if (process.env.NODE_ENV === 'production') {
    return 'https://hugin.allvitr.no'
  }
  
  // Development fallback
  return 'http://localhost:3000'
}

export interface EmailVerificationData {
  email: string
  name?: string
  verificationToken: string
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

    const verificationUrl = `${getBaseUrl()}/auth/verify-email?token=${data.verificationToken}`
    
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
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to Hugin</h1>
            <p style="color: #cccccc; margin: 10px 0 0 0; font-size: 16px;">Real-time market research platform by Allvitr</p>
          </div>
          
          <div style="background: #ffffff; padding: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
            
            <p>Hi${data.name ? ` ${data.name}` : ''},</p>
            
            <p>Thank you for signing up for Hugin! To complete your registration and secure your account, please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 16px;">
                Verify Email Address
              </a>
            </div>
            
            <p>If the button above doesn't work, you can also click on this link:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; font-family: monospace; font-size: 14px;">
              <a href="${verificationUrl}" style="color: #dc2626;">${verificationUrl}</a>
            </p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>Important:</strong> This verification link will expire in 24 hours for security reasons. If you didn't create an account with us, you can safely ignore this email.
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              If you have any questions, please contact our support team at info@allvitr.com.
            </p>
            
            <p style="color: #666; font-size: 14px;">
              Best regards,<br>
              The Allvitr Team
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Allvitr. All rights reserved.</p>
            <p>This email was sent to ${data.email}. If you did not request this verification, please ignore this email.</p>
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

    const verificationUrl = `${getBaseUrl()}/auth/verify-email?token=${data.verificationToken}`
    
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
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Hugin</h1>
            <p style="color: #cccccc; margin: 10px 0 0 0; font-size: 16px;">Email Verification Reminder</p>
          </div>
          
          <div style="background: #ffffff; padding: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #333; margin-top: 0;">Please Verify Your Email</h2>
            
            <p>Hi${data.name ? ` ${data.name}` : ''},</p>
            
            <p>We noticed you haven't verified your email address yet. To access your Hugin account and start using our platform, please verify your email by clicking the button below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 16px;">
                Verify Email Address
              </a>
            </div>
            
            <p>If the button above doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; font-family: monospace; font-size: 14px;">
              <a href="${verificationUrl}" style="color: #dc2626;">${verificationUrl}</a>
            </p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>Note:</strong> Your account access is limited until you verify your email address.
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              If you have any questions, please contact our support team at info@allvitr.com.
            </p>
            
            <p style="color: #666; font-size: 14px;">
              Best regards,<br>
              The Allvitr Team
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Allvitr. All rights reserved.</p>
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
