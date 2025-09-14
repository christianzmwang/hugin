-- Roles migration: add role column and seed initial roles
-- Safe to run multiple times

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
  END IF;
END$$;

-- Ensure admin root user is marked as admin
UPDATE users SET role = 'admin' WHERE lower(email) = lower('christian@allvitr.com');

-- Assign manager role as requested
UPDATE users SET role = 'manager' WHERE lower(email) = lower('christianwang39@gmail.com');
