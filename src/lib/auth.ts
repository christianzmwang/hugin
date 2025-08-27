/* eslint-disable @typescript-eslint/no-explicit-any */
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import PostgresAdapter from '@auth/pg-adapter'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import { query } from './db'

// Create a separate pool for NextAuth adapter
const authPool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_POOLING_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
})

export const authOptions: any = {
  adapter: PostgresAdapter(authPool),
  debug: false, // Disable debug to avoid console errors
  trustHost: true, // Allow multiple domains
  
  // Security: Configure shorter token expiry times
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days (default: 30 days)
  },
  
  providers: [
    // Google OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    
    // Email/Password Provider
    CredentialsProvider({
      id: 'credentials',
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Find user by email
          const result = await query<{
            id: string
            email: string
            name: string | null
            password_hash: string | null
          }>(
            'SELECT id, email, name, password_hash FROM users WHERE lower(email) = lower($1)',
            [credentials.email.trim()]
          )

          const user = result.rows[0]
          
          if (!user || !user.password_hash) {
            return null
          }

          // Verify password
          const isValidPassword = await bcrypt.compare(credentials.password, user.password_hash)
          
          if (!isValidPassword) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          }
        } catch (error) {
          console.error('Authentication error:', error)
          return null
        }
      }
    })
  ],
  
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error', // Custom error page
  },
  
  callbacks: {
    async createVerificationToken({ identifier, expires, token }) {
      // Override default 24-hour expiry with 30 minutes
      const shortExpiry = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      return {
        identifier,
        token,
        expires: shortExpiry < expires ? shortExpiry : expires
      }
    },
    
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    
    async session({ session, token }: { session: any; token: any }) {
      if (token && session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  
  secret: process.env.NEXTAUTH_SECRET,
}

// NextAuth instance is created in the route handler
