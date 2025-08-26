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
  providers: [
    // Google OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    
    // Email/Password Provider
    CredentialsProvider({
      id: 'credentials',
      name: 'Username and Password',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        try {
          // Find user by username
          const result = await query<{
            id: string
            username: string
            name: string | null
            password_hash: string | null
          }>(
            'SELECT id, username, name, password_hash FROM users WHERE lower(username) = lower($1)',
            [credentials.username.trim()]
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
            username: user.username,
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
  
  session: {
    strategy: 'jwt',
  },
  
  callbacks: {
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
