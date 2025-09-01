// Client-safe constants. Note: In production, main access is controlled by users.main_access.
// ALLOWED_USERS serves as a legacy/dev fallback only.
export const ALLOWED_USERS = [
  'christian@allvitr.com',
  'lars@allvitr.com', 
  'thomas@allvitr.com',
  'atlegram@gmail.com'
]

/**
 * Check if a user email is in the allowed users list
 * This function is safe for both client and server use
 */
export function isAllowedUser(email: string | null | undefined): boolean {
  if (!email) return false
  return ALLOWED_USERS.includes(email)
}
