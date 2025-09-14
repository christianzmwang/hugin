import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import type { Session } from 'next-auth'

export async function POST() {
  try {
    // Check if user is authenticated and authorized
    const session = await getServerSession(authOptions) as Session | null
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    // Allow admin and manager roles
    const role = (session.user as any).role as string | undefined
    if (role !== 'admin' && role !== 'manager') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    console.log('Starting user verification migration...')

    // Mark all existing users as email verified
    const result = await query<{
      id: string
      name: string | null
      email: string
      emailVerified: Date
    }>(`
      UPDATE users 
      SET "emailVerified" = NOW() 
      WHERE "emailVerified" IS NULL 
        AND email IS NOT NULL
      RETURNING id, name, email, "emailVerified"
    `)

    const verifiedCount = result.rows.length
    console.log(`✅ Verified ${verifiedCount} existing users`)

    // Get all users for reporting
    const allUsers = await query<{
      id: string
      name: string | null
      email: string
      emailVerified: Date | null
      created_at: Date
    }>(`
      SELECT 
        id, 
        name, 
        email, 
        "emailVerified",
        created_at
      FROM users 
      ORDER BY created_at DESC
    `)

    return NextResponse.json({
      success: true,
      verifiedCount,
      verifiedUsers: result.rows,
      allUsers: allUsers.rows,
      message: `Successfully verified ${verifiedCount} existing users`
    })

  } catch (error) {
    console.error('Error verifying users:', error)
    return NextResponse.json(
      { 
        error: 'Failed to verify users',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
