import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const token = (body?.token || '').toString().trim()
    const password = (body?.password || '').toString()

    if (!token || !password) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Basic password policy (backend enforcement)
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password too short' }, { status: 400 })
    }

    // Find token
    let rows: { user_id: string; expires: string }[] = []
    try {
      const res = await query<{ user_id: string; expires: string }>(
        'SELECT user_id, expires FROM password_reset_tokens WHERE token = $1',
        [token]
      )
      rows = res.rows
    } catch (e: any) {
      if (e && e.code === '42P01') {
        await query(`
          CREATE TABLE IF NOT EXISTS password_reset_tokens (
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token VARCHAR(255) PRIMARY KEY,
            expires TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `)
        await query(
          'CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens(user_id)'
        )
        await query(
          'CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_idx ON password_reset_tokens(expires)'
        )
        const res2 = await query<{ user_id: string; expires: string }>(
          'SELECT user_id, expires FROM password_reset_tokens WHERE token = $1',
          [token]
        )
        rows = res2.rows
      } else {
        throw e
      }
    }
    const row = rows[0]
    if (!row) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    // Check expiry
    const expiresAt = new Date(row.expires)
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      // Cleanup expired token
      await query('DELETE FROM password_reset_tokens WHERE token = $1', [token])
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    const userId = row.user_id
    const passwordHash = await bcrypt.hash(password, 10)

    // Update user password and delete all reset tokens for this user
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId])
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId])

    // Optionally: invalidate existing NextAuth sessions by deleting sessions for user
    try {
      await query('DELETE FROM sessions WHERE "userId" = $1', [userId])
    } catch {
      // ignore if sessions table not present
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
