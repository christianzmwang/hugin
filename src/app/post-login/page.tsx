import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function PostLogin() {
  const session = (await getServerSession(authOptions)) as Session | null

  if (!session) {
    redirect('/auth/signin')
  }

  const hasAccess = Boolean(session.user?.mainAccess)
  if (hasAccess) {
    redirect('/')
  }

  redirect('/noaccess')
}
