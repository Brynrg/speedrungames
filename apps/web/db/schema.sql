-- Leaderboard store (Cloudflare D1). One row per run.
-- Replaces Workers KV: D1 lists newest-N in a single query (no read amplification),
-- is strongly consistent, and has 5M row-reads/day on the free tier vs KV's 100k.
CREATE TABLE IF NOT EXISTS runs (
  id          TEXT PRIMARY KEY,   -- crypto.randomUUID()
  slug        TEXT NOT NULL,      -- game slug
  ms          INTEGER NOT NULL,   -- run time in milliseconds
  runner      TEXT,               -- optional display name
  splits      TEXT,               -- optional JSON array of {label, ms}
  achieved_at INTEGER NOT NULL    -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_runs_achieved ON runs(achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_slug_achieved ON runs(slug, achieved_at DESC);
