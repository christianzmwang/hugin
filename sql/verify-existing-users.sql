-- Mark all existing users as email verified
-- This is a one-time operation to verify existing users

-- Update all users who don't have emailVerified set
UPDATE users 
SET "emailVerified" = NOW() 
WHERE "emailVerified" IS NULL 
  AND email IS NOT NULL;

-- Show the updated users
SELECT 
  id, 
  name, 
  email, 
  "emailVerified",
  created_at
FROM users 
ORDER BY created_at DESC;
