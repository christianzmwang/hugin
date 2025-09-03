-- Migration to prioritize email authentication over username
-- Run this migration after updating the application code

-- Make email required for new registrations by updating the constraint
-- First, let's make sure all existing users have some form of identifier
UPDATE users SET email = LOWER(username) || '@generated.local' 
WHERE email IS NULL AND username IS NOT NULL;

-- Drop the old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_identity_check;

-- Add new constraint that requires email (username is now optional)
ALTER TABLE users ADD CONSTRAINT users_identity_check 
CHECK (email IS NOT NULL);

-- Make email column NOT NULL since it's now required
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Make username column nullable since it's now optional
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;

-- Add a unique constraint on email if it doesn't exist
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- Update the index to be more efficient for email lookups
DROP INDEX IF EXISTS users_email_idx;
CREATE INDEX users_email_idx ON users(email);

-- Comments for documentation
COMMENT ON COLUMN users.email IS 'Primary identifier for authentication (required)';
COMMENT ON COLUMN users.username IS 'Optional username field (legacy)';
