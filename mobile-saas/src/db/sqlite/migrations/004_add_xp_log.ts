// Template-literal wrapper for the xp_log table (Metro ships no .sql loader).
// Per-user-per-day XP ledger — mirror of Supabase public.xp_log. This is sync
// plumbing ONLY: mobile-saas does not implement the XP award / UI logic yet
// (web-first). The table syncs via Realtime so the data is ready when mobile
// adopts the feature.

export const SQL = `CREATE TABLE IF NOT EXISTS xp_log (
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
`;
