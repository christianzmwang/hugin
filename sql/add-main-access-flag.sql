-- Adds a per-user flag to allow access to the main page/app
ALTER TABLE IF NOT EXISTS users
  ADD COLUMN IF NOT EXISTS main_access BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional: make admin account allowed by default (adjust email as needed)
UPDATE users SET main_access = TRUE WHERE email = 'christian@allvitr.com';

-- Index for quick filtering in admin/user lists
CREATE INDEX IF NOT EXISTS users_main_access_idx ON users(main_access);

-- Verify structure
-- SELECT id, email, main_access FROM users ORDER BY created_at DESC LIMIT 20;
