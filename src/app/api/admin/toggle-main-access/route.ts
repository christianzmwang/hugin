import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import type { Session } from 'next-auth'

export async function POST(request: Request) {
  try {
    const session = (await getServerSession(authOptions)) as Session | null
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.email !== 'christian@allvitr.com') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId, allow } = await request.json()
    if (!userId || typeof allow !== 'boolean') {
      return NextResponse.json({ success: false, message: 'userId and allow(boolean) are required' }, { status: 400 })
    }

    // Ensure main_access column exists to avoid runtime errors
    try {
      await query(
        `DO $$
         BEGIN
           IF NOT EXISTS (
             SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'main_access'
           ) THEN
             ALTER TABLE users ADD COLUMN main_access BOOLEAN NOT NULL DEFAULT FALSE;
             CREATE INDEX IF NOT EXISTS users_main_access_idx ON users(main_access);
           END IF;
         END$$;`
      )
    } catch (e) {
      console.error('Failed to ensure main_access column exists', e)
    }

    const res = await query<{ id: string; main_access: boolean }>(
      'UPDATE users SET main_access = $2 WHERE id = $1 RETURNING id, main_access',
      [userId, allow]
    )
    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, user: res.rows[0] })
  } catch (error) {
    console.error('toggle-main-access error', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
