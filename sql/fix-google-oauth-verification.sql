-- Migration: Fix Google OAuth users verification status
-- Description: Ensure all users with Google OAuth accounts are properly email verified
-- Date: 2025-08-28

-- First, let's see what we're working with
SELECT 
    'Before migration' as status,
    COUNT(*) as total_google_users,
    COUNT(CASE WHEN u."emailVerified" IS NULL THEN 1 END) as unverified_count,
    COUNT(CASE WHEN u."emailVerified" IS NOT NULL THEN 1 END) as verified_count
FROM users u
INNER JOIN accounts a ON u.id = a."userId"
WHERE a.provider = 'google';

-- Show the unverified Google OAuth users
SELECT 
    'Unverified Google OAuth users:' as info,
    u.id,
    u.email,
    u."emailVerified",
    u.created_at
FROM users u
INNER JOIN accounts a ON u.id = a."userId"
WHERE a.provider = 'google'
AND u."emailVerified" IS NULL
ORDER BY u.created_at DESC;

-- Update all unverified Google OAuth users
UPDATE users 
SET "emailVerified" = NOW()
WHERE id IN (
    SELECT DISTINCT u.id
    FROM users u
    INNER JOIN accounts a ON u.id = a."userId"
    WHERE a.provider = 'google'
    AND u."emailVerified" IS NULL
);

-- Verify the changes
SELECT 
    'After migration' as status,
    COUNT(*) as total_google_users,
    COUNT(CASE WHEN u."emailVerified" IS NULL THEN 1 END) as unverified_count,
    COUNT(CASE WHEN u."emailVerified" IS NOT NULL THEN 1 END) as verified_count
FROM users u
INNER JOIN accounts a ON u.id = a."userId"
WHERE a.provider = 'google';

-- Show recently verified users
SELECT 
    'Recently verified Google OAuth users:' as info,
    u.id,
    u.email,
    u."emailVerified",
    u.created_at
FROM users u
INNER JOIN accounts a ON u.id = a."userId"
WHERE a.provider = 'google'
AND u."emailVerified" IS NOT NULL
ORDER BY u."emailVerified" DESC
LIMIT 10;
