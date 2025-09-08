import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { dbConfigured, query } from '@/lib/db'
import type { Session } from 'next-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1','arn1','cdg1']
export const maxDuration = 15

async function ensureTables() {
  if (!dbConfigured) return
  await query(`
    CREATE TABLE IF NOT EXISTS email_campaigns (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      list_id BIGINT,
      company_count INT NOT NULL DEFAULT 0,
      org_numbers TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_email_campaigns_user ON email_campaigns(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_email_campaigns_created ON email_campaigns(created_at DESC);
  `)
}

export async function GET() {
  const session = (await getServerSession(authOptions)) as Session | null
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.email !== 'christian@allvitr.com') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!dbConfigured) return NextResponse.json({ items: [] })
  await ensureTables()
  try {
    const res = await query<{ id: number; user_id: string; user_email: string; subject: string; body: string; list_id: number | null; company_count: number; org_numbers: string[]; created_at: string }>(`SELECT id,user_id,user_email,subject,body,list_id,company_count,org_numbers,created_at FROM email_campaigns ORDER BY created_at DESC LIMIT 200`)
    return NextResponse.json({ items: res.rows })
  } catch {
    return NextResponse.json({ items: [] }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions)) as Session | null
  if (!session?.user?.id || !session.user.email) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!dbConfigured) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 })
  await ensureTables()
  try {
    const body = await req.json().catch(() => ({})) as { subject?: string; body?: string; listId?: number; orgNumbers?: string[] }
    const subject = String(body.subject || '').trim()
    const content = String(body.body || '').trim()
    if (!subject || !content) return NextResponse.json({ ok: false, error: 'Missing subject or body' }, { status: 400 })
    const rawOrg = Array.isArray(body.orgNumbers) ? body.orgNumbers : []
    const orgNumbers = Array.from(new Set(rawOrg.map(s => String(s || '').trim()).filter(Boolean)))
    const companyCount = orgNumbers.length
    const listId = (body.listId != null && Number.isFinite(Number(body.listId))) ? Number(body.listId) : null
  const ins = await query<{ id: number }>(`INSERT INTO email_campaigns (user_id,user_email,subject,body,list_id,company_count,org_numbers) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [session.user.id, session.user.email, subject, content, listId, companyCount, orgNumbers])
    return NextResponse.json({ ok: true, id: ins.rows[0]?.id })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to create' }, { status: 500 })
  }
}
