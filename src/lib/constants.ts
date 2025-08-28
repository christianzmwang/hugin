// Client-safe constants that can be used in both client and server code
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
