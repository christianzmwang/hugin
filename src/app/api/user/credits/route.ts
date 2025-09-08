import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUsageSummary, getMonthResetAt, MONTHLY_CREDITS } from '@/lib/credits'

export async function GET() {
  const session = (await getServerSession(authOptions)) as Session | null
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { usedTotal, usedByType } = await getUsageSummary(session.user.id as unknown as string)
  const remaining = Math.max(0, MONTHLY_CREDITS - usedTotal)
  return NextResponse.json({
    monthlyLimit: MONTHLY_CREDITS,
    usedTotal,
    usedByType,
    remaining,
    resetAt: getMonthResetAt().toISOString(),
  })
}

