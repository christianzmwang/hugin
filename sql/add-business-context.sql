-- Add business_context text field to users table
-- Stores the user's business context (forretningskontekst)

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS business_context TEXT;

-- Optional: small index if we search by prefix later (commented out by default)
-- CREATE INDEX IF NOT EXISTS users_business_context_gin ON users USING gin (to_tsvector('simple', coalesce(business_context, '')));
