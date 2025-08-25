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
  trustHost: true, // Allow multiple domains
  providers: [
    // Google OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
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
    async signIn({ user, account, profile, credentials }: { user: any; account: any; profile?: any; credentials?: any }) {
      // Enhanced logging for OAuth debugging
      console.log('🔐 SignIn callback:', {
        provider: account?.provider,
        user_email: user?.email,
        user_id: user?.id,
        account_type: account?.type,
        profile_email: profile?.email,
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV
      })
      
      if (account?.provider === 'google') {
        console.log('🟢 Google OAuth details:', {
          access_token: account.access_token ? 'present' : 'missing',
          id_token: account.id_token ? 'present' : 'missing',
          expires_at: account.expires_at
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
  
  // Enhanced error logging
  events: {
    async signIn(message: any) {
      console.log('✅ SignIn event:', message)
    },
    async signOut(message: any) {
      console.log('🚪 SignOut event:', message)
    },
    async createUser(message: any) {
      console.log('👤 CreateUser event:', message)
    },
    async linkAccount(message: any) {
      console.log('🔗 LinkAccount event:', message)
    },
    async session(message: any) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📋 Session event:', message)
      }
    },
    async error(message: any) {
      console.error('❌ NextAuth Error:', message)
    }
  },
}

// NextAuth instance is created in the route handler
