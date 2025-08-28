import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import type { Session } from 'next-auth'

export async function GET() {
  try {
    // Check if user is authenticated and authorized
    const session = await getServerSession(authOptions) as Session | null
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    // Only christian@allvitr.com can access this admin endpoint
    if (session.user.email !== 'christian@allvitr.com') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Get all users
    const result = await query<{
      id: string
      name: string | null
      email: string
      emailVerified: Date | null
      created_at: Date
      updated_at: Date
    }>(`
      SELECT 
        id, 
        name, 
        email, 
        "emailVerified",
        created_at,
        updated_at
      FROM users 
      ORDER BY created_at DESC
    `)



    return NextResponse.json({
      success: true,
      users: result.rows
    })

  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch users',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
