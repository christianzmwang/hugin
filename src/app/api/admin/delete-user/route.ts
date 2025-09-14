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

    // Allow admin and manager roles
    const actorRole = (session.user as any).role as string | undefined
    if (actorRole !== 'admin' && actorRole !== 'manager') {
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

    // Get user details first to check deletion constraints
    const userResult = await query<{
      id: string
      email: string
      role: string | null
    }>(`
      SELECT id, email, role
      FROM users 
      WHERE id = $1
    `, [userId])

    if (userResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'User not found'
      })
    }

    const userToDelete = userResult.rows[0]

    // Prevent deletion of the admin user by anyone
    if (userToDelete.email === 'christian@allvitr.com') {
      return NextResponse.json({
        success: false,
        message: 'Cannot delete admin user'
      })
    }

    // If actor is manager, they cannot delete admins or managers
    const targetRole = (userToDelete as any).role || 'user'
    if (actorRole === 'manager' && (targetRole === 'manager' || targetRole === 'admin')) {
      return NextResponse.json({ success: false, message: 'Managers cannot delete admins or other managers' }, { status: 403 })
    }

    // Delete related records first (due to foreign key constraints)
    // Delete verification tokens
    await query(`
      DELETE FROM verification_tokens 
      WHERE identifier = $1
    `, [userToDelete.email])

    // Delete sessions
    await query(`
      DELETE FROM sessions 
      WHERE "userId" = $1
    `, [userId])

    // Delete accounts (OAuth connections)
    await query(`
      DELETE FROM accounts 
      WHERE "userId" = $1
    `, [userId])

    // Finally delete the user
    const deleteResult = await query<{
      id: string
      email: string
    }>(`
      DELETE FROM users 
      WHERE id = $1
      RETURNING id, email
    `, [userId])

    if (deleteResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Failed to delete user'
      })
    }

    console.log(`🗑️ Deleted user: ${deleteResult.rows[0].email}`)

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
      deletedUser: deleteResult.rows[0]
    })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { 
        success: false,
        message: 'Failed to delete user',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
