const { Pool } = require('pg')
require('dotenv').config()

async function verifyExistingUsers() {
  console.log('Environment:', process.env.NODE_ENV)
  console.log('Database URL available:', !!process.env.DATABASE_URL)
  console.log('Database Pooling URL available:', !!process.env.DATABASE_POOLING_URL)
  
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_POOLING_URL
  if (!connectionString) {
    throw new Error('No database connection string found in environment variables')
  }
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Always use SSL for remote connections
  })

  try {
    console.log('Connecting to database...')
    
    // Mark all existing users as email verified
    const result = await pool.query(`
      UPDATE users 
      SET "emailVerified" = NOW() 
      WHERE "emailVerified" IS NULL 
        AND email IS NOT NULL
      RETURNING id, name, email, "emailVerified"
    `)

    console.log(`✅ Verified ${result.rowCount} existing users:`)
    result.rows.forEach(user => {
      console.log(`  - ${user.name || 'Unknown'} (${user.email}) - verified at ${user.emailVerified}`)
    })

    // Show all users
    const allUsers = await pool.query(`
      SELECT 
        id, 
        name, 
        email, 
        "emailVerified",
        created_at
      FROM users 
      ORDER BY created_at DESC
    `)

    console.log('\n📋 All users in database:')
    allUsers.rows.forEach(user => {
      console.log(`  - ${user.name || 'Unknown'} (${user.email}) - verified: ${user.emailVerified ? '✅' : '❌'} - created: ${user.created_at}`)
    })

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await pool.end()
  }
}

verifyExistingUsers()
