-- Monthly credits usage tracking
-- Each row represents a debit of credits for a specific user action
CREATE TABLE IF NOT EXISTS credits_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('chat','research')),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Previously attempted an expression index on date_trunc('month', created_at)
-- but date_trunc is STABLE, not IMMUTABLE, which some hosts reject in indexes.
-- A composite index on (user_id, created_at) supports the same range filter
-- used by queries: user_id = $1 AND created_at >= date_trunc('month', now()).

-- Clean up any old index name if this file has been applied before
DROP INDEX IF EXISTS credits_usage_user_month_idx;

-- Composite index supporting monthly range scans per user
CREATE INDEX IF NOT EXISTS credits_usage_user_createdat_idx
  ON credits_usage(user_id, created_at);
