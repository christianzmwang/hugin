import { Pool } from 'pg'

// Prefer pooled connection in production; support common provider env names
const connectionString =
  process.env.DATABASE_URL || process.env.DATABASE_POOLING_URL || undefined

// Export a flag for external checks
export const dbConfigured = Boolean(connectionString)

// Emit non-sensitive diagnostics to verify env resolution
if (dbConfigured) {
  try {
    const { hostname } = new URL(connectionString as string)
    console.log(`[db] Using database host: ${hostname}`)
  } catch {
    console.log('[db] Database URL detected')
  }
} else {
  console.warn('[db] No database URL configured')
}

const isLocal =
  !!connectionString &&
  (connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1'))

// Create a pool only when configured; otherwise operate in a disabled mode
export const pool: import('pg').Pool | null = connectionString
  ? new Pool({
      connectionString,
      // Supabase requires SSL; disable for local
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    })
  : null

export type SqlParam =
  | string
  | number
  | boolean
  | null
  | Date
  | Buffer
  | string[]
  | number[]

export async function query<T = unknown>(
  text: string,
  params?: SqlParam[],
): Promise<{ rows: T[] }> {
  let client: import('pg').PoolClient | null = null
  try {
    if (!pool) {
      throw createCodedError(
        '[db] No database connection configured. Ensure DATABASE_URL or DATABASE_POOLING_URL is set.',
        'DB_NOT_CONFIGURED'
      )
    }
    client = await pool.connect()
    const result = await client.query(text, params)
    return { rows: result.rows as T[] }
  } catch (error) {
    // Surface DB errors to callers so the UI can report connection issues
    if (hasErrorCode(error)) {
      // Preserve coded errors (e.g., DB_NOT_CONFIGURED)
      throw error
    }
    const message = error instanceof Error ? error.message : 'Unknown DB error'
    throw createCodedError(message, 'DB_QUERY_FAILED')
  } finally {
    if (client) client.release()
  }
}

// Narrowing helper to detect errors with a string `code` property
export function hasErrorCode(value: unknown): value is { code: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as { code?: unknown }).code === 'string'
  )
}

// Create an Error with a typed `code` without using `any` casts
type DbErrorCode = 'DB_NOT_CONFIGURED' | 'DB_QUERY_FAILED'
type CodedError = Error & { code: DbErrorCode | string }

export function createCodedError(
  message: string,
  code: DbErrorCode | string
): CodedError {
  const err = new Error(message) as CodedError
  err.code = code
  return err
}
