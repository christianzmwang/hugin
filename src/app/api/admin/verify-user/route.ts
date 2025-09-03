import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import type { Session } from 'next-auth'

export async function POST(request: Request) {
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

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      )
    }

    // Verify the specific user
    const result = await query<{
      id: string
      email: string
      emailVerified: Date
    }>(`
      UPDATE users 
      SET "emailVerified" = NOW() 
      WHERE id = $1 AND "emailVerified" IS NULL
      RETURNING id, email, "emailVerified"
    `, [userId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'User not found or already verified'
      })
    }

    console.log(`✅ Manually verified user: ${result.rows[0].email}`)

    return NextResponse.json({
      success: true,
      message: 'User verified successfully',
      user: result.rows[0]
    })

  } catch (error) {
    console.error('Error verifying user:', error)
    return NextResponse.json(
      { 
        success: false,
        message: 'Failed to verify user',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
