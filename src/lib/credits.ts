import { query, hasErrorCode } from '@/lib/db'

export const MONTHLY_CREDITS = 2000

export type CreditType = 'chat' | 'research'

export async function getUsageSummary(userId: string): Promise<{
  usedTotal: number
  usedByType: { chat: number; research: number }
}> {
  const fallback = { usedTotal: 0, usedByType: { chat: 0, research: 0 } as const }
  try {
    const sql = `
      SELECT
        COALESCE(SUM(amount), 0) AS total,
        COALESCE(SUM(amount) FILTER (WHERE type = 'chat'), 0) AS chat,
        COALESCE(SUM(amount) FILTER (WHERE type = 'research'), 0) AS research
      FROM credits_usage
      WHERE user_id = $1 AND created_at >= date_trunc('month', NOW())
    `
    const res = await query<{ total: number; chat: number; research: number }>(sql, [userId])
    const row = res.rows[0] || { total: 0, chat: 0, research: 0 }
    return {
      usedTotal: Number(row.total) || 0,
      usedByType: { chat: Number(row.chat) || 0, research: Number(row.research) || 0 },
    }
  } catch (err) {
    // Graceful fallback if DB is unavailable or table is missing
    if (hasErrorCode(err)) {
      // optionally log on server; avoid breaking the page
      console.warn('[credits] Falling back due to DB error:', err.code)
    } else {
      console.warn('[credits] Falling back due to unknown DB error')
    }
    return fallback
  }
}

export async function getRemainingCredits(userId: string): Promise<number> {
  const { usedTotal } = await getUsageSummary(userId)
  return Math.max(0, MONTHLY_CREDITS - usedTotal)
}

export async function addUsage(userId: string, amount: number, type: CreditType, meta?: unknown) {
  try {
    await query(
      'INSERT INTO credits_usage (user_id, amount, type, meta) VALUES ($1, $2, $3, $4)',
      [userId, amount, type, meta ? JSON.stringify(meta) : null]
    )
  } catch (err) {
    // If table missing, lazily create then retry once
    if (hasErrorCode(err) && err.code === '42P01') { // undefined_table
      try {
        await ensureCreditsUsageTable()
        await query(
          'INSERT INTO credits_usage (user_id, amount, type, meta) VALUES ($1, $2, $3, $4)',
          [userId, amount, type, meta ? JSON.stringify(meta) : null]
        )
        return
      } catch (retryErr) {
        if (hasErrorCode(retryErr)) {
          console.warn('[credits] Retry insert failed after creating table:', retryErr.code)
        } else {
          console.warn('[credits] Retry insert failed after creating table (unknown error)')
        }
      }
    } else {
      if (hasErrorCode(err)) {
        console.warn('[credits] Skipping usage insert due to DB error:', err.code)
      } else {
        console.warn('[credits] Skipping usage insert due to unknown DB error')
      }
    }
  }
}

export function getMonthResetAt(): Date {
  const now = new Date()
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0))
  return nextMonth
}

// Ensure credits_usage table exists (idempotent)
export async function ensureCreditsUsageTable() {
  const ddl = `CREATE TABLE IF NOT EXISTS credits_usage (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    type TEXT NOT NULL CHECK (type IN ('chat','research')),
    meta JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS credits_usage_user_createdat_idx ON credits_usage(user_id, created_at);`
  try {
    await query(ddl)
  } catch (err) {
    if (hasErrorCode(err)) {
      console.warn('[credits] Failed to ensure credits_usage table:', err.code)
    } else {
      console.warn('[credits] Failed to ensure credits_usage table (unknown error)')
    }
  }
}
