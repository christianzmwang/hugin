// Centralized helpers for determining light chrome usage across the app
// Pages that should use light chrome when the user selects light mode
export const LIGHT_CHROME_PAGES = [
  '/',
  '/dashboard',
  '/search',
  '/company',
  '/profile',
  '/watchlist',
  '/configuration',
  '/sandbox',
  '/lists',
  '/export',
]

export function isLightChromePath(pathname: string | null | undefined) {
  if (!pathname) return false
  return (
    LIGHT_CHROME_PAGES.includes(pathname) ||
    LIGHT_CHROME_PAGES.some(p => p !== '/' && pathname.startsWith(p + '/'))
  )
}
