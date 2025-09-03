#!/usr/bin/env node

// Enhanced database connection test for Hugin project
// This script will check for various .env file formats

const fs = require('fs')
const path = require('path')

// Try to load environment variables from different possible files
const envFiles = ['.env']

console.log('🔍 Checking for environment files...\n')

let envLoaded = false
for (const envFile of envFiles) {
  const envPath = path.join(__dirname, envFile)
  if (fs.existsSync(envPath)) {
    console.log(`✅ Found ${envFile}`)
    require('dotenv').config({ path: envPath })
    envLoaded = true
  } else {
    console.log(`❌ ${envFile} not found`)
  }
}

if (!envLoaded) {
  console.log('\n⚠️  No environment files found!')
  console.log('You may need to create a .env.local file from env.template')
  console.log('Or set environment variables directly in your shell.')
}

const { Pool } = require('pg')

console.log('\n🔍 Testing database connection...\n')

// Check environment variables
console.log('📋 Environment Variables:')
const hasDbUrl = !!process.env.DATABASE_URL
const hasPoolUrl = !!process.env.DATABASE_POOLING_URL

console.log('  DATABASE_URL:', hasDbUrl ? '✅ Present' : '❌ Missing')
console.log('  DATABASE_POOLING_URL:', hasPoolUrl ? '✅ Present' : '❌ Missing')

if (hasDbUrl) {
  try {
    const url = new URL(process.env.DATABASE_URL)
    console.log('  🏠 Host:', url.hostname)
    console.log('  🚪 Port:', url.port || '5432')
    console.log('  🗄️  Database:', url.pathname.slice(1))
    console.log('  👤 User:', url.username)
    console.log('  🔒 SSL:', url.hostname.includes('supabase') ? 'Required (Supabase)' : 'Auto-detected')
  } catch (error) {
    console.log('  ⚠️  Connection string present but malformed')
  }
}

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_POOLING_URL

if (!connectionString) {
  console.log('\n❌ No database connection string found!')
  console.log('\n💡 Next steps:')
  console.log('  1. Copy env.template to .env.local')
  console.log('  2. Replace placeholders with your actual Supabase credentials')
  console.log('  3. Run this test again')
  process.exit(1)
}

// Test connection
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
const isSupabase = connectionString.includes('supabase.co')

const pool = new Pool({
  connectionString,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
})

async function testConnection() {
  try {
    console.log('\n🔌 Attempting database connection...')
    
    if (isSupabase) {
      console.log('🟢 Detected Supabase database')
    }
    
    const client = await pool.connect()
    console.log('✅ Successfully connected to database!')
    
    // Test a simple query
    console.log('\n📊 Running diagnostics...')
    const result = await client.query('SELECT NOW() as server_time, version() as version')
    
    if (result.rows.length > 0) {
      console.log('✅ Basic query successful!')
      console.log(`  ⏰ Server Time: ${result.rows[0].server_time}`)
      const version = result.rows[0].version.split(' ')
      console.log(`  🐘 PostgreSQL: ${version[0]} ${version[1]}`)
    }
    
    // First, let's see what tables actually exist
    console.log('\n📋 Discovering database tables...')
    try {
      const tablesResult = await client.query(`
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname IN ('public') 
        ORDER BY schemaname, tablename
      `)
      
      console.log('📋 Available tables in database:')
      for (const row of tablesResult.rows) {
        console.log(`  - ${row.schemaname}.${row.tablename}`)
      }
    } catch (error) {
      console.log('❌ Could not list tables:', error.message)
    }
    
    // Test Hugin-specific tables with proper quoting
    console.log('\n🏢 Checking Hugin application tables...')
    
    const tables = [
      { name: 'Business', query: '"Business"' },
      { name: 'FinancialReport', query: '"FinancialReport"' }, 
      { name: 'CEO', query: '"CEO"' },
      { name: 'events_public', query: 'public.events_public' }
    ]
    
    let allTablesOk = true
    
    for (const table of tables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table.query} LIMIT 1`)
        const count = parseInt(countResult.rows[0].count)
        console.log(`  📋 ${table.name}: ✅ ${count.toLocaleString()} records`)
      } catch (error) {
        console.log(`  📋 ${table.name}: ❌ ${error.message}`)
        allTablesOk = false
      }
    }
    
    client.release()
    
    if (allTablesOk) {
      console.log('\n🎉 All systems operational! Hugin is ready to run.')
    } else {
      console.log('\n⚠️  Some tables are missing. Check your database schema.')
    }
    
  } catch (error) {
    console.log('\n❌ Database connection failed!')
    console.log(`💥 Error: ${error.message}`)
    
    if (error.code) {
      console.log(`🏷️  Code: ${error.code}`)
    }
    
    // Specific error guidance
    console.log('\n💡 Troubleshooting:')
    if (error.message.includes('ENOTFOUND')) {
      console.log('  • Check hostname in DATABASE_URL')
      console.log('  • Verify internet connection')
    } else if (error.message.includes('authentication failed')) {
      console.log('  • Verify username and password in DATABASE_URL')
      console.log('  • Check if database user exists')
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.log('  • Verify database name in DATABASE_URL')
    } else if (error.message.includes('connect ECONNREFUSED')) {
      console.log('  • Check if database server is running')
      console.log('  • Verify port number (usually 5432)')
    } else if (error.message.includes('ssl') || error.message.includes('SSL')) {
      console.log('  • SSL is required for Supabase connections')
      console.log('  • Check if ssl=true is in your connection string')
    }
    
    process.exit(1)
  } finally {
    await pool.end()
  }
}

testConnection()
