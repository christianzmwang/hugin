import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

// @ts-expect-error NextAuth v4 typing issue in app router handler signature
const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
