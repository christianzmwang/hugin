#!/usr/bin/env node

// Simple SQL migration applier for Hugin
// Usage examples:
//   node scripts/apply-sql.js                 # apply default set (auth, credits, recently viewed)
//   node scripts/apply-sql.js --file sql/credits-usage.sql
//   node scripts/apply-sql.js --auth          # only auth schema

const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')

function parseArgs() {
  const args = process.argv.slice(2)
  const out = { files: [], onlyAuth: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--file' || a === '-f') {
      out.files.push(args[++i])
    } else if (a === '--auth') {
      out.onlyAuth = true
    }
  }
  return out
}

async function run() {
  const { files, onlyAuth } = parseArgs()

  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_POOLING_URL
  if (!connectionString) {
    console.error('❌ DATABASE_URL or DATABASE_POOLING_URL must be set in .env.local')
    process.exit(1)
  }

  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
  const pool = new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  })

  // Default migration set
  const defaultFiles = [
    path.join('sql', 'auth-schema.sql'),
    path.join('sql', 'credits-usage.sql'),
    path.join('sql', 'recently-viewed-companies.sql'),
  ]

  const toApply = files.length > 0
    ? files
    : onlyAuth
    ? [path.join('sql', 'auth-schema.sql')]
    : defaultFiles

  console.log('🗄️  Connecting to database...')
  const client = await pool.connect()
  try {
    console.log('✅ Connected')

    // Ensure required extension for gen_random_uuid()
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
    } catch (e) {
      console.warn('⚠️  Could not create extension pgcrypto (may already exist or lack permission)')
    }

    for (const f of toApply) {
      const full = path.resolve(f)
      console.log(`\n📄 Applying: ${full}`)
      if (!fs.existsSync(full)) {
        console.log('  ❌ File not found, skipping')
        continue
      }
      const sql = fs.readFileSync(full, 'utf8')
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('COMMIT')
        console.log('  ✅ Applied successfully')
      } catch (err) {
        await client.query('ROLLBACK')
        console.error('  ❌ Failed to apply')
        console.error('     ', err.message)
        process.exitCode = 1
      }
    }
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch((e) => {
  console.error('Unexpected error:', e)
  process.exit(1)
})

