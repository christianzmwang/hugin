import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Protect app routes: only allow users with mainAccess; others get sent to /noaccess
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow static, api, and Next internals
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next()
  }

  // Public routes
  const publicRoutes = ['/auth/signin', '/auth/signup', '/auth/verify-email', '/auth/error', '/noaccess']
  const isPublic = publicRoutes.some((p) => pathname === p || pathname.startsWith(p + '/'))

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const isAuthed = Boolean(token)
  const hasAccess = Boolean((token as any)?.mainAccess)

  // If not authed and trying to access protected page, send to signin
  if (!isAuthed && !isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/auth/signin'
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  // If authed but without access
  if (isAuthed && !hasAccess) {
    // Only allow countdown and auth related pages
    if (!isPublic) {
  const url = req.nextUrl.clone()
  url.pathname = '/noaccess'
      url.searchParams.delete('callbackUrl')
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // If authed with access and trying to view noaccess or auth pages, send to main
  if (isAuthed && hasAccess && isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
