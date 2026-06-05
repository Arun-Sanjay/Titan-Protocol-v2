-- Per-user-per-day XP ledger. profiles holds the rolling totals (xp/level/
-- streak); this table enforces the 10/day XP cap and records the streak,
-- multiplier, and consistency that produced each day's XP. Mirrors the
-- Supabase public.xp_log table (composite PK user_id+date_key).
CREATE TABLE IF NOT EXISTS xp_log (
  user_id       TEXT    NOT NULL,
  date_key      TEXT    NOT NULL,
  tasks_counted INTEGER NOT NULL DEFAULT 0,
  xp_earned     INTEGER NOT NULL DEFAULT 0,
  consistency   INTEGER NOT NULL DEFAULT 0,
  streak_value  INTEGER NOT NULL DEFAULT 0,
  multiplier    REAL    NOT NULL DEFAULT 1,
  settled       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  _dirty        INTEGER NOT NULL DEFAULT 0,
  _deleted      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date_key)
);
CREATE INDEX IF NOT EXISTS idx_xp_log_user_id ON xp_log(user_id);
