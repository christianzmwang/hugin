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
    <div className="h-full overflow-hidden flex flex-col app-profile">
      <div className="p-6 flex-1 overflow-hidden">
        {/* Top layout: two columns on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Left: Account + Login methods */}
          <section className="profile-panel p-6 h-full flex flex-col">
            <h2 className="text-lg font-semibold mb-4">Konto & innlogging</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="profile-muted">Brukernavn</div>
                <div className="mt-1 font-medium">{String(displayName)}</div>
              </div>
              <div>
                <div className="profile-muted">E-post</div>
                <div className="mt-1 font-medium">{String(displayEmail)}</div>
              </div>
            </div>
            <div className="profile-divider mt-4 pt-4 text-sm">
              <div className="profile-muted mb-1">Innloggingsmetoder</div>
              {methods.length > 0 ? (
                <div className="space-y-2">
                  <div className="font-medium">{methods.join(', ')}</div>
                  {methods.includes('Password') && (
                    <div className="profile-muted">Av sikkerhetsgrunner vises aldri passordet ditt.</div>
                  )}
                </div>
              ) : (
                <div className="profile-muted">Ikke fastslått (e‑post/passord eller OAuth).</div>
              )}
            </div>
          </section>

          {/* Right: Credits + Overview */}
            <section className="profile-panel p-6 h-full flex flex-col">
              <h2 className="text-lg font-semibold mb-4">Poeng & bruk</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="profile-muted">Månedlige poeng</div>
                  <div className="mt-1 font-medium">{MONTHLY_CREDITS.toLocaleString('en-US')}</div>
                </div>
                <div>
                  <div className="profile-muted">Brukt</div>
                  <div className="mt-1 font-medium">{usedTotal.toLocaleString('en-US')}</div>
                </div>
                <div>
                  <div className="profile-muted">Gjenstår</div>
                  <div className={`mt-1 font-medium ${remaining <= 0 ? 'profile-negative' : ''}`}>{remaining.toLocaleString('en-US')}</div>
                </div>
                <div>
                  <div className="profile-muted">Tilbakestilles</div>
                  <div className="mt-1 font-medium">{resetAt}</div>
                </div>
              </div>
              <div className="mt-4 text-xs profile-subtle flex flex-wrap gap-x-4 gap-y-1">
                <span>Chat: {usedByType.chat.toLocaleString('en-US')}</span>
                <span>Forskning: {usedByType.research.toLocaleString('en-US')}</span>
              </div>
              <ul className="text-xs space-y-1 mt-4">
                <li><span className="profile-muted">Chat-spørsmål:</span> <span className="font-medium">6 poeng</span></li>
                <li className="profile-muted">Forskning (per prosessor): <span className="font-medium">Base {researchCost.base} • Pro {researchCost.pro} • Ultra {researchCost.ultra}</span></li>
              </ul>
            </section>
        </div>

        {/* Bottom: timeline */}
        <section className="profile-panel p-6 overflow-hidden">
          <h2 className="text-lg font-semibold mb-4">Forbruk denne måneden</h2>
          <UsageTimeline userId={session.user.id as unknown as string} />
        </section>
      </div>
    </div>
  )
}

type UsageRow = {
  amount: number
  type: 'chat' | 'research' | string // keep string fallback in case of future types
  meta: Record<string, unknown> | null
  created_at: Date
}

async function UsageTimeline({ userId }: { userId: string }) {
  // Fetch all usage for current month
  let rows: UsageRow[] = []
  try {
    const res = await query<UsageRow>(
      'SELECT amount, type, meta, created_at FROM credits_usage WHERE user_id = $1 AND created_at >= date_trunc(' + "'month'" + ', NOW()) ORDER BY created_at ASC',
      [userId]
    )
    rows = res.rows
  } catch {
    rows = []
  }

  // Build day buckets (up to today) using Europe/Oslo timezone to avoid UTC date shifts
  const TZ = 'Europe/Oslo'
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  const fmt = (() => {
    try {
      return new Intl.DateTimeFormat('no-NO', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    } catch {
      return null as unknown as Intl.DateTimeFormat
    }
  })()
  const getParts = (d: Date) => {
    if (fmt?.formatToParts) {
      const parts = fmt.formatToParts(d)
      const get = (type: string) => parts.find((p) => p.type === type)?.value || ''
      const y = parseInt(get('year') || String(d.getFullYear()), 10)
      const m = parseInt(get('month') || String(d.getMonth() + 1), 10)
      const da = parseInt(get('day') || String(d.getDate()), 10)
      return { year: y, month: m, day: da }
    }
    // Fallback to local time if Intl not available
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
  }
  const formatDateKey = (d: Date) => {
    const { year, month, day } = getParts(d)
    return `${year}-${pad(month)}-${pad(day)}`
  }
  const now = new Date()
  const nowParts = getParts(now)
  const year = nowParts.year
  const month = nowParts.month - 1 // 0-based for constructing keys below
  const today = nowParts.day

  type DayAgg = { date: string; total: number; chat: number; research: number }
  const days: DayAgg[] = []
  for (let d = 1; d <= today; d++) {
    const ds = `${year}-${pad(month + 1)}-${pad(d)}`
    days.push({ date: ds, total: 0, chat: 0, research: 0 })
  }
  const byDate: Record<string, DayAgg> = Object.fromEntries(days.map((d) => [d.date, d]))
  for (const r of rows) {
    const d = new Date(r.created_at)
    // Bucket by Europe/Oslo calendar day
    const ds = formatDateKey(d)
    const agg = byDate[ds]
    if (!agg) continue
    agg.total += r.amount
    if (r.type === 'chat') agg.chat += r.amount
    else agg.research += r.amount
  }
  // Adaptive scale: tallest bar always represents the highest single-dag forbruk denne måneden
  const max = Math.max(1, ...days.map((d) => d.total))

  if (!rows.length) {
    return <div className="text-sm profile-muted">Ingen forbruk registrert ennå.</div>
  }

  const monthChat = days.reduce((a, d) => a + d.chat, 0)
  const monthResearch = days.reduce((a, d) => a + d.research, 0)
  const monthTotal = days.reduce((a, d) => a + d.total, 0)

  return (
    <div className="w-full">
      <div
        className="grid items-end gap-1 h-64 pb-2 pr-2"
        style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
      >
        {days.map((d) => {
          const rawPct = (d.total / max) * 100
          // Ensure a minimum visible bar if there was any usage that day
          const minVisible = 6 // percent of container height
            
          const totalPct = d.total > 0 ? Math.max(rawPct, minVisible) : 0
          const chatPct = d.total ? (d.chat / d.total) * 100 : 0
          const researchPct = 100 - chatPct
          const dayNum = parseInt(d.date.split('-')[2], 10)
          return (
            <div key={d.date} className="flex flex-col items-center h-64">
              <div
                className="relative w-full h-full profile-bar-track overflow-hidden"
                title={`${dayNum}.: Totalt ${d.total} (Chat ${d.chat} • Forskning ${d.research})`}
              >
                <div
                  className="absolute bottom-0 left-0 w-full bg-blue-400/20"
                  style={{ height: `${totalPct}%` }}
                >
                  <div className="absolute bottom-0 left-0 w-full bg-emerald-400/80" style={{ height: `${researchPct}%` }} />
                  <div className="absolute bottom-0 left-0 w-full bg-indigo-500/80" style={{ height: `${chatPct}%` }} />
                </div>
                {d.total > 0 && (
                  <div
                    className="absolute bottom-0 left-0 w-full pointer-events-none flex justify-center"
                    style={{ height: `${totalPct}%` }}
                  >
                    <div
                      className="mt-1 text-[10px] leading-none font-medium select-none text-gray-800 dark:text-gray-200 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
                      title={`Totalt ${d.total}`}
                    >
                      {d.total}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-1 text-[10px] leading-none profile-subtle">{dayNum}</div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs profile-muted">
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-indigo-500/80" /> Chat</div>
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-emerald-400/80" /> Forskning</div>
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-blue-400/80" /> Totalt (ramme)</div>
      </div>
      <div className="mt-2 text-xs profile-subtle">
        Totalt denne måneden: <span className="font-medium">{monthTotal}</span> (Chat {monthChat} • Forskning {monthResearch})
      </div>
    </div>
  )
}
