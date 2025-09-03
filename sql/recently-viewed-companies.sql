-- Table to store per-user recently viewed companies
-- Run this migration once in your database.

CREATE TABLE IF NOT EXISTS recently_viewed_companies (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_number TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, org_number)
);

-- Helpful index for retrieval order
CREATE INDEX IF NOT EXISTS idx_rv_user_created ON recently_viewed_companies(user_id, created_at DESC);
