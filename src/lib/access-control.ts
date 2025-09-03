import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth'
import type { Session } from 'next-auth'

/**
 * Get the current authenticated session and check if user is allowed
 * Returns the session if user is allowed, null otherwise
 */
export async function getAuthorizedSession(): Promise<Session | null> {
  try {
    const session = await getServerSession(authOptions) as Session | null
    
    if (!session || !session.user || !session.user.email) {
      return null
    }
    
    // Check email verification status
    if (!session.user.emailVerified) {
      console.log('User session found but email not verified:', session.user.email)
      return null
    }
    
    // Enforce access by DB flag (mainAccess) only
    const hasDbAccess = Boolean((session.user as { mainAccess?: boolean }).mainAccess)
    if (!hasDbAccess) {
      return null
    }
    
    return session
  } catch (error) {
    console.error('Error getting authorized session:', error)
    return null
  }
}

/**
 * Middleware to check API access - returns error response if unauthorized
 */
export async function checkApiAccess(): Promise<Response | null> {
  const session = await getAuthorizedSession()
  
  if (!session) {
    return new Response(
      JSON.stringify({ 
        error: 'Unauthorized access. Authentication required.',
        message: 'This API endpoint requires authentication from an authorized user.'
      }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
  
  return null // No error, access is allowed
}
