import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest } from 'next/server'

// Enhanced handler with domain logging
async function authHandler(req: NextRequest) {
  // Log the domain being used for OAuth
  const host = req.headers.get('host')
  const protocol = req.headers.get('x-forwarded-proto') || 'https'
  const fullUrl = `${protocol}://${host}`
  
  if (req.url.includes('/callback/google')) {
    console.log('🌐 OAuth callback from domain:', {
      host,
      fullUrl,
      userAgent: req.headers.get('user-agent')?.substring(0, 100),
      timestamp: new Date().toISOString()
    })
  }
  
  // @ts-expect-error NextAuth v4 typing issue in app router handler signature
  const handler = NextAuth(authOptions)
  return handler(req)
}

export { authHandler as GET, authHandler as POST }
