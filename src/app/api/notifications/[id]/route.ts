import { NextResponse } from 'next/server'
import { checkApiAccess, getAuthorizedSession } from '@/lib/access-control'
import { dbConfigured, query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const accessError = await checkApiAccess();
  if (accessError) return accessError
  if (!dbConfigured) return NextResponse.json({ ok: false }, { status: 503 })
  const session = await getAuthorizedSession()
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  const userId = session.user.id
  const idNum = parseInt(params.id, 10)
  if (!idNum) return NextResponse.json({ ok: false }, { status: 400 })
  try {
    await query(`DELETE FROM saved_notifications WHERE id = $1 AND user_id = $2`, [idNum, userId])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
