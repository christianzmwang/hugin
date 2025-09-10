import { NextResponse } from 'next/server'
import { checkApiAccess, getAuthorizedSession } from '@/lib/access-control'
import { dbConfigured, query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Note: leave second arg untyped (any) to satisfy Next.js route analyzer (mirrors lists/[id]/route.ts pattern)
export async function DELETE(_req: Request, ctx: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { params } = (ctx || {}) as { params: { id: string } }
  const accessError = await checkApiAccess();
  if (accessError) return accessError
  if (!dbConfigured) return NextResponse.json({ ok: false }, { status: 503 })
  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  const userId = session.user.id
  const idNum = Number(params.id)
  if (!Number.isFinite(idNum)) return NextResponse.json({ ok: false }, { status: 400 })
  try {
    await query(`DELETE FROM saved_notifications WHERE id = $1 AND user_id = $2`, [idNum, userId])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
