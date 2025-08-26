-- Migration: Add username support and make email optional
-- This migration adds username column and makes email optional for username-based authentication

-- Add username column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

-- Make email nullable (optional) since we're switching to username-based auth
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Create index for username for better performance
CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);

-- Update the existing email index name for clarity
DROP INDEX IF EXISTS users_email_idx;
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email) WHERE email IS NOT NULL;

-- Add constraint to ensure either email or username exists
-- (This ensures users have at least one way to be identified)
ALTER TABLE users ADD CONSTRAINT users_identity_check 
CHECK (username IS NOT NULL OR email IS NOT NULL);

-- Enforce case-insensitive uniqueness for username by creating a unique index on lower(username)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_username_lower_unique_idx'
  ) THEN
    -- Drop the old simple UNIQUE constraint if present to avoid conflicts
    BEGIN
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
    EXCEPTION WHEN undefined_object THEN
      -- ignore if constraint name differs
      NULL;
    END;

    -- Create a unique index on lower(username) for CI uniqueness
    CREATE UNIQUE INDEX users_username_lower_unique_idx ON users (lower(username));
  END IF;
END$$;

-- Note: You may need to update existing users to have usernames
-- Example to generate usernames for existing email-only users:
/*
UPDATE users 
SET username = 'user_' || substr(replace(cast(gen_random_uuid() as text), '-', ''), 1, 8)
WHERE username IS NULL;
*/
