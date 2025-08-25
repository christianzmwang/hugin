import bcrypt from 'bcryptjs'
import { query } from './db'

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
 * Creates a new user with email and password
 */
export async function createUser(userData: CreateUserData): Promise<User | null> {
  try {
    // Check if user already exists
    const existingUser = await query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [userData.email]
    )

    if (existingUser.rows.length > 0) {
      throw new Error('User already exists with this email')
    }

    // Hash the password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(userData.password, saltRounds)

    // Create the user
    const result = await query<User>(
      `INSERT INTO users (email, password_hash, name) 
       VALUES ($1, $2, $3) 
       RETURNING id, email, name, "emailVerified", image, created_at, updated_at`,
      [userData.email, passwordHash, userData.name || null]
    )

    return result.rows[0] || null
  } catch (error) {
    console.error('Error creating user:', error)
    throw error
  }
}

/**
 * Finds a user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const result = await query<User>(
      'SELECT id, email, name, "emailVerified", image, created_at, updated_at FROM users WHERE email = $1',
      [email]
    )

    return result.rows[0] || null
  } catch (error) {
    console.error('Error finding user by email:', error)
    return null
  }
}

/**
 * Validates password strength
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

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
