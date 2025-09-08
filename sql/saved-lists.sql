-- Saved lists schema

-- Users save named lists with filter presets and the current org numbers.
-- Note: Run this migration in your database before using the feature.

CREATE TABLE IF NOT EXISTS saved_lists (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  filter_query TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_lists_user ON saved_lists (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS saved_list_items (
  list_id BIGINT NOT NULL REFERENCES saved_lists(id) ON DELETE CASCADE,
  org_number TEXT NOT NULL,
  PRIMARY KEY (list_id, org_number)
);

CREATE INDEX IF NOT EXISTS idx_saved_list_items_list ON saved_list_items (list_id);
CREATE INDEX IF NOT EXISTS idx_saved_list_items_org ON saved_list_items (org_number);

