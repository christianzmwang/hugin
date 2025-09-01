import { NextResponse } from 'next/server'
import { dbConfigured, query, hasErrorCode } from '@/lib/db'
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

    // Ensure DB configured
    if (!dbConfigured) {
      return NextResponse.json(
        { success: false, error: 'Database not configured', message: 'DB connection unsuccessful' },
        { status: 503 }
      )
    }

    // Detect whether main_access column exists
    const colCheck = await query<{ exists: number }>(
      `SELECT 1 as exists FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'main_access' 
       LIMIT 1`
    )
    const hasMainAccess = colCheck.rows.length > 0

    // Get all users (include main_access if present; else return false as placeholder)
    const result = await query<{
      id: string
      name: string | null
      email: string
      emailVerified: Date | null
      created_at: Date
      updated_at: Date
      main_access: boolean | null
    }>(
      hasMainAccess
        ? `
      SELECT 
        id, 
        name, 
        email, 
        "emailVerified",
        main_access,
        created_at,
        updated_at
      FROM users 
      ORDER BY created_at DESC
    `
        : `
      SELECT 
        id, 
        name, 
        email, 
        "emailVerified",
        false as main_access,
        created_at,
        updated_at
      FROM users 
      ORDER BY created_at DESC
    `
    )



    return NextResponse.json({
      success: true,
      users: result.rows
    })

  } catch (error) {
    console.error('Error fetching users:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
  const status = hasErrorCode(error) && error.code === 'DB_NOT_CONFIGURED' ? 503 : 500
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users', message },
      { status }
    )
  }
}
