#!/usr/bin/env node

/**
 * Authentication Setup Script
 * 
 * This script sets up the authentication database tables for Hugin.
 * Run with: node setup-auth.js
 */

require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')

// Database connection setup
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

const authTables = `
-- NextAuth.js authentication tables
-- These tables are required for NextAuth.js with the PostgreSQL adapter

-- Users table for storing user account information
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  "emailVerified" TIMESTAMPTZ,
  image TEXT,
  password_hash TEXT, -- For email/password authentication
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts table for OAuth providers (Google, etc.)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(255) NOT NULL,
  provider VARCHAR(255) NOT NULL,
  "providerAccountId" VARCHAR(255) NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type VARCHAR(255),
  scope VARCHAR(255),
  id_token TEXT,
  session_state VARCHAR(255),
  UNIQUE(provider, "providerAccountId")
);

-- Sessions table for storing user sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionToken" VARCHAR(255) UNIQUE NOT NULL,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL
);

-- Verification tokens for email verification and password reset
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON accounts("userId");
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions("userId");
CREATE INDEX IF NOT EXISTS sessions_session_token_idx ON sessions("sessionToken");
CREATE INDEX IF NOT EXISTS verification_tokens_token_idx ON verification_tokens(token);

-- Update trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
`

async function setupAuthentication() {
  try {
    console.log('\n🔧 Setting up authentication tables...')
    
    const client = await pool.connect()
    
    // Execute the SQL to create tables
    await client.query(authTables)
    
    console.log('✅ Authentication tables created successfully!')
    
    // Test that tables exist
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'accounts', 'sessions', 'verification_tokens')
      ORDER BY table_name
    `)
    
    console.log('\n📋 Created authentication tables:')
    for (const row of tableCheck.rows) {
      console.log(`  ✓ ${row.table_name}`)
    }
    
    client.release()
    
    console.log('\n🎉 Authentication setup complete!')
    console.log('\n📝 Next steps:')
    console.log('  1. Copy .env.example to .env.local')
    console.log('  2. Configure your NEXTAUTH_SECRET and Google OAuth credentials')
    console.log('  3. Start the development server: pnpm dev')
    console.log('  4. Visit http://localhost:3000 and try signing up!')
    
  } catch (error) {
    console.error('\n❌ Authentication setup failed!')
    console.error(`💥 Error: ${error.message}`)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

setupAuthentication()
