import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import crypto from 'crypto'
import { sendPasswordResetEmail, getHostFromRequest } from '@/lib/email'

async function getUserByEmail(email: string) {
  const { rows } = await query('SELECT id, email, name FROM users WHERE email = $1 LIMIT 1', [email])
  return rows[0] as { id: string; email: string; name?: string } | undefined
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = (body?.email || '').toString().trim().toLowerCase()

    // Always return generic response to prevent user enumeration
    const genericResponse = NextResponse.json({ ok: true })

    if (!email) return genericResponse

    const user = await getUserByEmail(email)
    if (!user) return genericResponse

    // Generate a secure token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

    // Store token (create table on-demand if missing)
    const insert = async () =>
      query(
        `INSERT INTO password_reset_tokens (user_id, token, expires)
         VALUES ($1, $2, $3)`,
        [user.id, token, expiresAt]
      )
    try {
      await insert()
    } catch (e: any) {
      if (e && e.code === '42P01') {
        // Table missing, create it and retry once
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
        await insert()
      } else {
        throw e
      }
    }

    // Send email
  const host = getHostFromRequest(req)
  await sendPasswordResetEmail({ email: user.email, name: user.name, resetToken: token, baseUrl: host })

    return genericResponse
  } catch (error) {
    console.error('Forgot password error:', error)
    // Still return generic response
    return NextResponse.json({ ok: true })
  }
}
