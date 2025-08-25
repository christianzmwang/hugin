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
  debug: process.env.NODE_ENV === 'development',
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
            'SELECT id, email, name, password_hash FROM users WHERE email = $1',
            [credentials.email]
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
  },
  
  session: {
    strategy: 'jwt',
  },
  
  callbacks: {
    async signIn({ user, account, profile }: { user: any; account: any; profile?: any }) {
      // Log OAuth signin attempts for debugging
      if (process.env.NODE_ENV === 'production') {
        console.log('OAuth signin attempt:', {
          provider: account?.provider,
          user: user?.email,
          timestamp: new Date().toISOString()
        })
      }
      return true
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
