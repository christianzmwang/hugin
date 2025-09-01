import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function PostLogin() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  const hasAccess = Boolean((session as any)?.user?.mainAccess)
  if (hasAccess) {
    redirect('/')
  }

  redirect('/noaccess')
}
