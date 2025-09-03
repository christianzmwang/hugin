import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, hasErrorCode } from '@/lib/db'

type BusinessContextObject = {
  businessName?: string
  orgNumber?: string
  delivers?: string
  icp?: string
}

export async function GET() {
  const session = (await getServerSession(authOptions)) as Session | null
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const res = await query<{ business_context: string | null }>(
      'SELECT business_context FROM users WHERE id = $1',
      [session.user.id]
    )
    const raw = res.rows[0]?.business_context ?? null
    if (raw == null || raw === '') {
      return NextResponse.json({ businessContext: null, shape: 'null' })
    }
    try {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object') {
        // Only pick allowed keys to avoid leaking unexpected data
        const obj = parsed as Record<string, unknown>
        const value: BusinessContextObject = {
          businessName: typeof obj.businessName === 'string' ? obj.businessName : '',
          orgNumber: typeof obj.orgNumber === 'string' ? obj.orgNumber : '',
          delivers: typeof obj.delivers === 'string' ? obj.delivers : '',
          icp: typeof obj.icp === 'string' ? obj.icp : '',
        }
        return NextResponse.json({ businessContext: value, shape: 'object' })
      }
    } catch {}
    // Legacy: stored as plain text. Map to delivers field so UI can show it.
    return NextResponse.json({ businessContext: String(raw), shape: 'string' })
  } catch (e) {
    // Fallback: if DB is not configured/available, try to read from cookie so UX keeps working
    const cookieStore = await cookies()
    const cookieVal = cookieStore.get('businessContext')?.value ?? null
    if (cookieVal !== null) {
      try {
        const parsed = JSON.parse(cookieVal) as unknown
        if (parsed && typeof parsed === 'object') {
          const obj = parsed as Record<string, unknown>
          const value: BusinessContextObject = {
            businessName: typeof obj.businessName === 'string' ? obj.businessName : '',
            orgNumber: typeof obj.orgNumber === 'string' ? obj.orgNumber : '',
            delivers: typeof obj.delivers === 'string' ? obj.delivers : '',
            icp: typeof obj.icp === 'string' ? obj.icp : '',
          }
          return NextResponse.json({ businessContext: value, shape: 'object', fallback: 'cookie' })
        }
      } catch {}
      return NextResponse.json({ businessContext: cookieVal, shape: 'string', fallback: 'cookie' })
    }
    const code = hasErrorCode(e) ? e.code : 'UNKNOWN'
    const status = code === 'DB_NOT_CONFIGURED' ? 503 : 500
    return NextResponse.json({ error: 'Failed to load', code }, { status })
  }
}

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as Session | null
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Parse body once and reuse in both success and fallback paths
  const body = (await req.json().catch(() => ({}))) as { businessContext?: unknown }
  let value = ''
  const bc = body.businessContext
  if (bc && typeof bc === 'object') {
    const obj = bc as Record<string, unknown>
    const normalized: BusinessContextObject = {
      businessName: typeof obj.businessName === 'string' ? obj.businessName.trim() : '',
      orgNumber: typeof obj.orgNumber === 'string' ? obj.orgNumber.trim() : '',
      delivers: typeof obj.delivers === 'string' ? obj.delivers.trim() : '',
      icp: typeof obj.icp === 'string' ? obj.icp.trim() : '',
    }
    try {
      value = JSON.stringify(normalized)
    } catch {
      value = ''
    }
  } else if (typeof bc === 'string') {
    value = bc
  } else {
    value = ''
  }
  if (value.length > 20000) value = value.slice(0, 20000)
  try {
    await query(
      'UPDATE users SET business_context = $1 WHERE id = $2',
      [value, session.user.id]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    // If DB is not configured/available, persist to a cookie as a temporary fallback
    const code = hasErrorCode(e) ? e.code : 'UNKNOWN'
    if (code === 'DB_NOT_CONFIGURED' || code === 'DB_QUERY_FAILED') {
      const res = NextResponse.json({ ok: true, fallback: 'cookie', code })
      // 30 days, Lax for auth flows; not HttpOnly so client could read if needed
      res.cookies.set('businessContext', value, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      })
      return res
    }
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
