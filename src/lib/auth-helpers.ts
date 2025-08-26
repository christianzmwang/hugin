import bcrypt from 'bcryptjs'
import { query } from './db'

export interface CreateUserData {
  username: string
  password: string
  name?: string
}

export interface User {
  id: string
  username: string
  email?: string | null
  name: string | null
  emailVerified: Date | null
  image: string | null
  created_at: Date
  updated_at: Date
}

/**
 * Creates a new user with username and password
 */
export async function createUser(userData: CreateUserData): Promise<User | null> {
  try {
    // Normalize username to lowercase and trim whitespace
    const normalizedUsername = userData.username.toLowerCase().trim()

    // Check if user already exists (case-insensitive)
    const existingUser = await query<{ id: string }>(
      'SELECT id FROM users WHERE lower(username) = lower($1)',
      [normalizedUsername]
    )

    if (existingUser.rows.length > 0) {
      throw new Error('User already exists with this username')
    }

    // Hash the password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(userData.password, saltRounds)

    // Create the user
    const result = await query<User>(
      `INSERT INTO users (username, password_hash, name) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, name, "emailVerified", image, created_at, updated_at`,
      [normalizedUsername, passwordHash, userData.name || null]
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

/**
 * Validates username format (3-50 chars, alphanumeric + underscore)
 */
export function validateUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/
  return usernameRegex.test(username)
}

/**
 * Finds a user by username
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const result = await query<User>(
      'SELECT id, username, name, "emailVerified", image, created_at, updated_at FROM users WHERE lower(username) = lower($1)',
      [username.toLowerCase().trim()]
    )

    return result.rows[0] || null
  } catch (error) {
    console.error('Error finding user by username:', error)
    return null
  }
}
