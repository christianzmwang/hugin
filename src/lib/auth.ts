/* eslint-disable @typescript-eslint/no-explicit-any */
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import PostgresAdapter from '@auth/pg-adapter'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import { query } from './db'

// Create a separate pool for NextAuth adapter
const authConnStr = process.env.DATABASE_URL || process.env.DATABASE_POOLING_URL
if (!authConnStr) {
  console.warn('[auth] No database URL set for NextAuth. Authentication DB operations will fail.')
}
const isLocalAuth = !!authConnStr && (authConnStr.includes('localhost') || authConnStr.includes('127.0.0.1'))
const authPool = new Pool({
  connectionString: authConnStr,
  // Supabase requires SSL even in dev; disable only for localhost
  ssl: isLocalAuth ? undefined : { rejectUnauthorized: false },
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
            emailVerified: Date | null
          }>(
            'SELECT id, email, name, password_hash, "emailVerified" FROM users WHERE lower(email) = lower($1)',
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

          // Check if email is verified
          if (!user.emailVerified) {
            console.log('Sign-in blocked: Email not verified for user:', user.email)
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
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
    async createVerificationToken({ identifier, expires, token }: { identifier: string; expires: Date; token: string }) {
      // Override default 24-hour expiry with 30 minutes
      const shortExpiry = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      return {
        identifier,
        token,
        expires: shortExpiry < expires ? shortExpiry : expires
      }
    },

    async signIn({ user, account }: { user: any; account: any; profile?: any }) {
      // Auto-verify email for Google OAuth users
      if (account?.provider === 'google' && user?.email) {
        try {
          // First, try to update existing user
          const updateResult = await query(
            'UPDATE users SET "emailVerified" = NOW() WHERE email = $1 AND "emailVerified" IS NULL RETURNING id',
            [user.email]
          )
          
          // If no rows were updated, the user might already be verified or doesn't exist yet
          // In case of new user creation through adapter, ensure they get verified
          if (updateResult.rows.length === 0) {
            // Try to verify by user ID if available
            if (user.id) {
              await query(
                'UPDATE users SET "emailVerified" = NOW() WHERE id = $1 AND "emailVerified" IS NULL',
                [user.id]
              )
            }
          }
          
          console.log('Auto-verified Google OAuth user:', user.email)
        } catch (error) {
          console.error('Error auto-verifying Google OAuth user:', error)
        }
      }
      return true
    },

    async linkAccount({ user, account }: { user: any; account: any }) {
      // Also verify when linking Google account to existing user
      if (account?.provider === 'google' && user?.email) {
        try {
          await query(
            'UPDATE users SET "emailVerified" = NOW() WHERE email = $1 AND "emailVerified" IS NULL',
            [user.email]
          )
          console.log('Auto-verified user during Google account linking:', user.email)
        } catch (error) {
          console.error('Error auto-verifying during account linking:', error)
        }
      }
      return true
    },
    
    async jwt({ token, user, account }: { token: any; user?: any; account?: any }) {
      if (user) {
        token.id = user.id
        token.emailVerified = user.emailVerified
        // Fetch mainAccess and businessContext from DB on initial login
        try {
          const res = await query<{ main_access: boolean | null; business_context: string | null }>(
            'SELECT main_access, business_context FROM users WHERE id = $1',
            [user.id]
          )
          token.mainAccess = Boolean(res.rows[0]?.main_access)
          token.businessContext = res.rows[0]?.business_context ?? null
        } catch (e) {
          token.mainAccess = false
          token.businessContext = null
        }
        
        // For Google OAuth users, ensure emailVerified is set
        if (account?.provider === 'google' && user.email && !user.emailVerified) {
          token.emailVerified = new Date()
        }
      }
      return token
    },
    
    async session({ session, token }: { session: any; token: any }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.emailVerified = token.emailVerified as Date | null
        // Always fetch latest main_access and business_context so admin toggles and context apply immediately
        try {
          const res = await query<{ main_access: boolean | null; business_context: string | null }>(
            'SELECT main_access, business_context FROM users WHERE id = $1',
            [token.id]
          )
          const current = Boolean(res.rows[0]?.main_access)
          session.user.mainAccess = current
          token.mainAccess = current
          const bc = res.rows[0]?.business_context ?? null
          session.user.businessContext = bc
          token.businessContext = bc
        } catch {
          session.user.mainAccess = Boolean(token.mainAccess)
          session.user.businessContext = (token.businessContext ?? null) as string | null
        }

        // Double-check: If this is a Google user without verified email, fix it
        if (!session.user.emailVerified && session.user.email) {
          try {
            // Check if user has Google account linked
            const hasGoogleAccount = await query(
              'SELECT 1 FROM accounts WHERE "userId" = $1 AND provider = $2',
              [token.id, 'google']
            )
            
            if (hasGoogleAccount.rows.length > 0) {
              // User has Google account but email not verified - fix it
              await query(
                'UPDATE users SET "emailVerified" = NOW() WHERE id = $1',
                [token.id]
              )
              session.user.emailVerified = new Date()
              console.log('Fixed verification status for Google user:', session.user.email)
            }
          } catch (error) {
            console.error('Error checking/fixing Google user verification:', error)
          }
        }
      }
      return session
    },
  },
  
  secret: process.env.NEXTAUTH_SECRET,
}

// NextAuth instance is created in the route handler
