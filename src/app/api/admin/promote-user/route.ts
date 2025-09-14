import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { Session } from 'next-auth'

export async function POST(request: Request) {
  try {
    const session = (await getServerSession(authOptions)) as Session | null
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized - Authentication required' }, { status: 401 })
    }

    const actorRole = (session.user as any).role as string | undefined
    // Only admins can promote users to manager
    if (actorRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 })
    }

    // Ensure role column exists (idempotent)
    try {
      await query(
        `DO $$
         BEGIN
           IF NOT EXISTS (
             SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
           ) THEN
             ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
           END IF;
         END$$;`
      )
    } catch (e) {
      console.error('[promote-user] Failed ensuring role column:', e)
      // continue; the next queries may still succeed if column exists
    }

    // Fetch target user
    const target = await query<{ id: string; email: string; role: string | null }>(
      'SELECT id, email, role FROM users WHERE id = $1',
      [userId]
    )
    if (target.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }
    const targetUser = target.rows[0]

    // Do not modify the root admin
    if (targetUser.email === 'christian@allvitr.com') {
      return NextResponse.json({ success: false, message: 'Cannot change role of root admin' }, { status: 403 })
    }

    // If already manager or admin, return gracefully
    const currentRole = (targetUser.role as string | null) ?? 'user'
    if (currentRole === 'manager') {
      return NextResponse.json({ success: true, message: 'User is already a manager', user: { id: targetUser.id, role: 'manager' } })
    }
    if (currentRole === 'admin') {
      return NextResponse.json({ success: false, message: 'Cannot promote an admin' }, { status: 400 })
    }

    const updated = await query<{ id: string; role: string }>(
      'UPDATE users SET role = $2 WHERE id = $1 RETURNING id, role',
      [userId, 'manager']
    )

    if (updated.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Failed to promote user' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'User promoted to manager', user: updated.rows[0] })
  } catch (error) {
    console.error('[promote-user] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to promote user', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
