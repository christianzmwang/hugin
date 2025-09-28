-- Ensure new users get main access by default on existing databases
ALTER TABLE IF EXISTS users
  ALTER COLUMN main_access SET DEFAULT TRUE;

-- Optionally backfill NULLs to TRUE if any exist (defensive)
UPDATE users SET main_access = TRUE WHERE main_access IS NULL;

-- Verify
-- SELECT column_default FROM information_schema.columns 
--   WHERE table_name='users' AND column_name='main_access';

