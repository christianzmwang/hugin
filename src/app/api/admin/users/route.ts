import { NextResponse } from 'next/server'
import { dbConfigured, query, hasErrorCode } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import type { Session } from 'next-auth'
import { MONTHLY_CREDITS, ensureCreditsUsageTable } from '@/lib/credits'

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
    const userRows = await query<{
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

    // Aggregations: last session & monthly credits usage (best-effort; tolerate missing tables)
    type LastSessionRow = { user_id: string; last_session_expires: Date }
  type CreditsRow = { user_id: string; credits_used_month: string | number; credits_used_chat_month: string | number; credits_used_research_month: string | number }
  const lastSessions: Record<string, Date> = {}
  const creditsUsage: Record<string, { total: number; chat: number; research: number }> = {}

    // Last session (uses sessions table from auth schema)
    try {
      const ls = await query<LastSessionRow>(`SELECT "userId" as user_id, MAX(expires) as last_session_expires FROM sessions GROUP BY "userId"`)
      for (const r of ls.rows) {
        if (r.last_session_expires) lastSessions[r.user_id] = new Date(r.last_session_expires)
      }
  } catch {
      console.warn('[admin/users] Unable to fetch last sessions (non-fatal).')
    }

    // Monthly credits usage (current month)
    try {
      await ensureCreditsUsageTable()
      const cu = await query<CreditsRow>(`SELECT user_id, 
        COALESCE(SUM(amount),0) as credits_used_month,
        COALESCE(SUM(amount) FILTER (WHERE type = 'chat'),0) as credits_used_chat_month,
        COALESCE(SUM(amount) FILTER (WHERE type = 'research'),0) as credits_used_research_month
        FROM credits_usage 
        WHERE created_at >= date_trunc('month', now()) 
        GROUP BY user_id`)
      for (const r of cu.rows) {
        const total = Number(r.credits_used_month) || 0
        creditsUsage[r.user_id] = {
          total,
            chat: Number(r.credits_used_chat_month) || 0,
            research: Number(r.credits_used_research_month) || 0
        }
      }
  } catch {
      console.warn('[admin/users] Unable to fetch credits usage (non-fatal).')
    }

    const enriched = userRows.rows.map(u => {
      const usage = creditsUsage[u.id] || { total: 0, chat: 0, research: 0 }
      const used = usage.total
      return {
        ...u,
        lastSession: lastSessions[u.id] || null,
        creditsUsedMonth: used,
        creditsUsedChatMonth: usage.chat,
        creditsUsedResearchMonth: usage.research,
        creditsRemaining: Math.max(0, MONTHLY_CREDITS - used),
        creditsMonthlyLimit: MONTHLY_CREDITS,
      }
    })

    return NextResponse.json({
      success: true,
      users: enriched
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
