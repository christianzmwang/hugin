import { NextResponse } from 'next/server'
import { dbConfigured, pool } from '@/lib/db'

type ConnectionTestResult = {
  success: boolean
  serverTime?: unknown
  error?: string
}

type DebugPayload = {
  timestamp: string
  dbConfigured: boolean
  hasPool: boolean
  envVars: {
    DATABASE_URL: boolean
    DATABASE_POOLING_URL: boolean
  }
  connectionTest?: ConnectionTestResult
}

export async function GET() {
  const debug: DebugPayload = {
    timestamp: new Date().toISOString(),
    dbConfigured,
    hasPool: !!pool,
    envVars: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      DATABASE_POOLING_URL: !!process.env.DATABASE_POOLING_URL,
    },
  }

  if (pool) {
    try {
      const result = await pool.query('SELECT NOW() as server_time')
      debug.connectionTest = {
        success: true,
        serverTime: result.rows[0]?.server_time,
      }
    } catch (error) {
      debug.connectionTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  } else {
    debug.connectionTest = {
      success: false,
      error: 'No database pool available',
    }
  }

  return NextResponse.json(debug)
}
