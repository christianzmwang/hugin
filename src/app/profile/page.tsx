import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { getUsageSummary, getMonthResetAt, MONTHLY_CREDITS } from '@/lib/credits'

type AccountRow = { provider: string }
type UserRow = { name: string | null; email: string; password_hash: string | null }

export default async function ProfilePage() {
  const session = (await getServerSession(authOptions)) as Session | null
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  let user: UserRow | null = null
  let accounts: AccountRow[] = []
  try {
    const u = await query<UserRow>(
      'SELECT name, email, password_hash FROM users WHERE id = $1',
      [session.user.id as unknown as string]
    )
    user = u.rows[0] ?? null
  } catch {
    user = {
      name: (session.user.name as string | null) ?? null,
      email: session.user.email || '',
      password_hash: null,
    }
  }
  try {
    const a = await query<AccountRow>(
      'SELECT provider FROM accounts WHERE "userId" = $1',
      [session.user.id as unknown as string]
    )
    accounts = a.rows
  } catch {
    accounts = []
  }

  const methods: string[] = []
  if (user?.password_hash) methods.push('Password')
  if (accounts.some((a) => a.provider === 'google')) methods.push('Google')
  if (accounts.some((a) => a.provider === 'azure-ad')) methods.push('Microsoft')

  const displayName = user?.name || session.user.name || session.user.email || 'User'
  const displayEmail = user?.email || session.user.email || ''

  // Credits summary
  const { usedTotal, usedByType } = await getUsageSummary(session.user.id as unknown as string)
  const remaining = Math.max(0, MONTHLY_CREDITS - usedTotal)
  const resetAt = (() => {
    const d = getMonthResetAt()
    try {
      return new Intl.DateTimeFormat('no-NO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d)
    } catch {
      const pad = (n: number) => (n < 10 ? `0${n}` : n)
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
  })()
  const researchCost = (() => {
    // Show per-processor points consistent with server mapping
    return {
      lite: 6,
      base: 12,
      core: 60,
      pro: 120,
      ultra: 360,
    }
  })()

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Profil</h1>

        {/* Top layout: two columns on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Left: Account + Login methods */}
          <section className="bg-white/5 border border-white/10 p-6 h-full flex flex-col">
            <h2 className="text-lg font-semibold mb-4">Konto & innlogging</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-white/60">Brukernavn</div>
                <div className="mt-1 font-medium">{String(displayName)}</div>
              </div>
              <div>
                <div className="text-white/60">E-post</div>
                <div className="mt-1 font-medium">{String(displayEmail)}</div>
              </div>
            </div>
            <div className="border-t border-white/10 mt-4 pt-4 text-sm">
              <div className="text-white/60 mb-1">Innloggingsmetoder</div>
              {methods.length > 0 ? (
                <div className="space-y-2">
                  <div className="font-medium">{methods.join(', ')}</div>
                  {methods.includes('Password') && (
                    <div className="text-white/60">Av sikkerhetsgrunner vises aldri passordet ditt.</div>
                  )}
                </div>
              ) : (
                <div className="text-white/60">Ikke fastslått (e‑post/passord eller OAuth).</div>
              )}
            </div>
          </section>

          {/* Right: Credits + Overview */}
            <section className="bg-white/5 border border-white/10 p-6 h-full flex flex-col">
              <h2 className="text-lg font-semibold mb-4">Poeng & bruk</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-white/60">Månedlige poeng</div>
                  <div className="mt-1 font-medium">{MONTHLY_CREDITS.toLocaleString('en-US')}</div>
                </div>
                <div>
                  <div className="text-white/60">Brukt</div>
                  <div className="mt-1 font-medium">{usedTotal.toLocaleString('en-US')}</div>
                </div>
                <div>
                  <div className="text-white/60">Gjenstår</div>
                  <div className={`mt-1 font-medium ${remaining <= 0 ? 'text-red-400' : ''}`}>{remaining.toLocaleString('en-US')}</div>
                </div>
                <div>
                  <div className="text-white/60">Tilbakestilles</div>
                  <div className="mt-1 font-medium">{resetAt}</div>
                </div>
              </div>
              <div className="mt-4 text-xs text-white/70 flex flex-wrap gap-x-4 gap-y-1">
                <span>Chat: {usedByType.chat.toLocaleString('en-US')}</span>
                <span>Forskning: {usedByType.research.toLocaleString('en-US')}</span>
              </div>
              <ul className="text-xs space-y-1 mt-4">
                <li><span className="text-white/60">Chat-spørsmål:</span> <span className="font-medium">6 poeng</span></li>
                <li className="text-white/60">Forskning (per prosessor): <span className="font-medium text-white">Base {researchCost.base} • Pro {researchCost.pro} • Ultra {researchCost.ultra}</span></li>
              </ul>
            </section>
        </div>

        {/* Bottom: timeline */}
        <section className="bg-white/5 border border-white/10 p-6">
          <h2 className="text-lg font-semibold mb-4">Forbruk denne måneden</h2>
          <UsageTimeline userId={session.user.id as unknown as string} />
        </section>
      </div>
    </div>
  )
}

async function UsageTimeline({ userId }: { userId: string }) {
  // Fetch all usage for current month
  let rows: { amount: number; type: string; meta: any; created_at: Date }[] = []
  try {
    const res = await query<{ amount: number; type: string; meta: any; created_at: Date }>(
      'SELECT amount, type, meta, created_at FROM credits_usage WHERE user_id = $1 AND created_at >= date_trunc(' + "'month'" + ', NOW()) ORDER BY created_at ASC',
      [userId]
    )
    rows = res.rows
  } catch {
    rows = []
  }

  // Build day buckets (up to today)
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0-based
  const today = now.getUTCDate()
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))

  type DayAgg = { date: string; total: number; chat: number; research: number }
  const days: DayAgg[] = []
  for (let d = 1; d <= today; d++) {
    const ds = `${year}-${pad(month + 1)}-${pad(d)}`
    days.push({ date: ds, total: 0, chat: 0, research: 0 })
  }
  const byDate: Record<string, DayAgg> = Object.fromEntries(days.map((d) => [d.date, d]))
  for (const r of rows) {
    const d = new Date(r.created_at)
    const ds = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    const agg = byDate[ds]
    if (!agg) continue
    agg.total += r.amount
    if (r.type === 'chat') agg.chat += r.amount
    else agg.research += r.amount
  }
  // Adaptive scale: tallest bar always represents the highest single-dag forbruk denne måneden
  const max = Math.max(1, ...days.map((d) => d.total))

  if (!rows.length) {
    return <div className="text-sm text-white/60">Ingen forbruk registrert ennå.</div>
  }

  const monthChat = days.reduce((a, d) => a + d.chat, 0)
  const monthResearch = days.reduce((a, d) => a + d.research, 0)
  const monthTotal = days.reduce((a, d) => a + d.total, 0)

  return (
    <div className="w-full">
      <div
        className="grid items-end gap-1 h-48 pb-2 pr-2"
        style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
      >
        {days.map((d) => {
          const totalPct = (d.total / max) * 100
          const chatPct = d.total ? (d.chat / d.total) * 100 : 0
          const researchPct = 100 - chatPct
          const dayNum = new Date(d.date).getUTCDate()
          return (
            <div key={d.date} className="flex flex-col items-center">
              <div
                className="relative w-full bg-white/10 rounded-sm overflow-hidden"
                style={{ height: '100%' }}
                title={`${dayNum}.: Totalt ${d.total} (Chat ${d.chat} • Forskning ${d.research})`}
              >
                <div
                  className="absolute bottom-0 left-0 w-full bg-blue-400/20"
                  style={{ height: `${totalPct}%` }}
                >
                  <div className="absolute bottom-0 left-0 w-full bg-emerald-400/80" style={{ height: `${researchPct}%` }} />
                  <div className="absolute bottom-0 left-0 w-full bg-indigo-500/80" style={{ height: `${chatPct}%` }} />
                </div>
              </div>
              <div className="mt-1 text-[10px] leading-none text-white/70">{dayNum}</div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/60">
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-indigo-500/80" /> Chat</div>
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-emerald-400/80" /> Forskning</div>
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-blue-400/80" /> Totalt (ramme)</div>
      </div>
      <div className="mt-2 text-xs text-white/70">
        Totalt denne måneden: <span className="text-white">{monthTotal}</span> (Chat {monthChat} • Forskning {monthResearch})
      </div>
    </div>
  )
}
