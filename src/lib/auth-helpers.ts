import bcrypt from 'bcryptjs'
import { query } from './db'
import crypto from 'crypto'

export interface CreateUserData {
  email: string
  password: string
  name?: string
}

export interface User {
  id: string
  email: string
  name: string | null
  emailVerified: Date | null
  image: string | null
  created_at: Date
  updated_at: Date
}

/**
 * Generate a secure verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Creates a new user with email and password (unverified)
 */
export async function createUser(userData: CreateUserData): Promise<User | null> {
  try {
    // Normalize email to lowercase and trim whitespace
    const normalizedEmail = userData.email.toLowerCase().trim()

    // Validate email format
    if (!validateEmail(normalizedEmail)) {
      throw new Error('Invalid email format')
    }

    // Check if user already exists (case-insensitive)
    const existingUser = await query<{ id: string }>(
      'SELECT id FROM users WHERE lower(email) = lower($1)',
      [normalizedEmail]
    )

    if (existingUser.rows.length > 0) {
      throw new Error('User already exists with this email')
    }

    // Hash the password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(userData.password, saltRounds)

    // Create the user (emailVerified is NULL, requiring verification)
    const result = await query<User>(
      `INSERT INTO users (email, password_hash, name, "emailVerified") 
       VALUES ($1, $2, $3, NULL) 
       RETURNING id, email, name, "emailVerified", image, created_at, updated_at`,
      [normalizedEmail, passwordHash, userData.name || null]
    )

    return result.rows[0] || null
  } catch (error) {
    console.error('Error creating user:', error)
    throw error
  }
}

/**
 * Store verification token in database
 */
export async function storeVerificationToken(email: string, token: string): Promise<boolean> {
  try {
    // Set expiration to 24 hours from now
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    
    // Delete any existing tokens for this email
    await query(
      'DELETE FROM verification_tokens WHERE identifier = $1',
      [email]
    )
    
    // Insert new token
    await query(
      'INSERT INTO verification_tokens (identifier, token, expires) VALUES ($1, $2, $3)',
      [email, token, expires]
    )
    
    return true
  } catch (error) {
    console.error('Error storing verification token:', error)
    return false
  }
}

/**
 * Verify email with token and mark user as verified
 */
export async function verifyEmailToken(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    // Find the token and check if it's still valid
    const tokenResult = await query<{ identifier: string; expires: Date }>(
      'SELECT identifier, expires FROM verification_tokens WHERE token = $1',
      [token]
    )

    if (tokenResult.rows.length === 0) {
      return { success: false, error: 'Invalid verification token' }
    }

    const { identifier: email, expires } = tokenResult.rows[0]

    // Check if token has expired
    if (new Date() > new Date(expires)) {
      // Clean up expired token
      await query('DELETE FROM verification_tokens WHERE token = $1', [token])
      return { success: false, error: 'Verification token has expired' }
    }

    // Update user's emailVerified status
    const userResult = await query<User>(
      'UPDATE users SET "emailVerified" = NOW() WHERE email = $1 RETURNING id, email, name, "emailVerified"',
      [email]
    )

    if (userResult.rows.length === 0) {
      return { success: false, error: 'User not found' }
    }

    // Clean up the used token
    await query('DELETE FROM verification_tokens WHERE token = $1', [token])

    return { success: true, email }
  } catch (error) {
    console.error('Error verifying email token:', error)
    return { success: false, error: 'Database error during verification' }
  }
}

/**
 * Check if user needs email verification
 */
export async function getUserVerificationStatus(email: string): Promise<{ verified: boolean; exists: boolean }> {
  try {
    const result = await query<{ emailVerified: Date | null }>(
      'SELECT "emailVerified" FROM users WHERE lower(email) = lower($1)',
      [email]
    )

    if (result.rows.length === 0) {
      return { verified: false, exists: false }
    }

    return { 
      verified: result.rows[0].emailVerified !== null, 
      exists: true 
    }
  } catch (error) {
    console.error('Error checking user verification status:', error)
    return { verified: false, exists: false }
  }
}

/**
 * Get verification token for user (if exists and not expired)
 */
export async function getValidVerificationToken(email: string): Promise<string | null> {
  try {
    const result = await query<{ token: string; expires: Date }>(
      'SELECT token, expires FROM verification_tokens WHERE identifier = $1 AND expires > NOW()',
      [email]
    )

    return result.rows.length > 0 ? result.rows[0].token : null
  } catch (error) {
    console.error('Error getting verification token:', error)
    return null
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}