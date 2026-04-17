-- Titan Protocol — SQLite initial schema (mirrors Supabase public schema 1:1)
-- Generated 2026-04-18 for the local-first migration.
--
-- Conventions:
--   * Postgres uuid        -> TEXT
--   * timestamptz / date   -> TEXT (ISO-8601)
--   * jsonb / json / arr   -> TEXT (JSON string)
--   * boolean              -> INTEGER (0/1)
--   * numeric              -> REAL
--   * pg enums             -> TEXT + CHECK(col IN (...))
--   * gen_random_uuid()    -> omitted; the app generates UUIDs via expo-crypto
--   * now()                -> DEFAULT (datetime('now'))
--   * NO FOREIGN KEYS      -> integrity is enforced in application code
--   * Every synced user-data table carries sync bookkeeping columns:
--       _dirty    INTEGER NOT NULL DEFAULT 0,
--       _deleted  INTEGER NOT NULL DEFAULT 0
--
-- Run this file in a single transaction via runMigrations().

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS achievements_unlocked (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked_at    TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty         INTEGER NOT NULL DEFAULT 0,
  _deleted       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_achievements_unlocked_user_id ON achievements_unlocked(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_achievements_unlocked_user_achievement
  ON achievements_unlocked(user_id, achievement_id) WHERE _deleted = 0;

CREATE TABLE IF NOT EXISTS boss_challenges (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  boss_id        TEXT NOT NULL,
  started_at     TEXT NOT NULL DEFAULT (datetime('now')),
  progress       INTEGER NOT NULL DEFAULT 0,
  days_required  INTEGER NOT NULL,
  evaluator_type TEXT NOT NULL,
  day_results    TEXT NOT NULL DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK(status IN ('active','defeated','failed','abandoned')),
  resolved_at    TEXT,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty         INTEGER NOT NULL DEFAULT 0,
  _deleted       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_boss_challenges_user_id ON boss_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_boss_challenges_updated_at ON boss_challenges(updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_boss_challenges_user_boss
  ON boss_challenges(user_id, boss_id) WHERE _deleted = 0;

CREATE TABLE IF NOT EXISTS budgets (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  category      TEXT NOT NULL,
  monthly_limit REAL NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty        INTEGER NOT NULL DEFAULT 0,
  _deleted      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_updated_at ON budgets(updated_at);

CREATE TABLE IF NOT EXISTS completions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  task_id    TEXT NOT NULL,
  engine     TEXT NOT NULL CHECK(engine IN ('body','mind','money','charisma')),
  date_key   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty     INTEGER NOT NULL DEFAULT 0,
  _deleted   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_completions_user_id ON completions(user_id);
CREATE INDEX IF NOT EXISTS idx_completions_date_key ON completions(date_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_completions_task_date
  ON completions(task_id, date_key) WHERE _deleted = 0;

CREATE TABLE IF NOT EXISTS deep_work_logs (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  task_id        TEXT NOT NULL,
  date_key       TEXT NOT NULL,
  completed      INTEGER NOT NULL DEFAULT 0,
  earnings_today REAL NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty         INTEGER NOT NULL DEFAULT 0,
  _deleted       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_deep_work_logs_user_id ON deep_work_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_deep_work_logs_date_key ON deep_work_logs(date_key);

CREATE TABLE IF NOT EXISTS deep_work_sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  date_key   TEXT NOT NULL,
  task_name  TEXT NOT NULL,
  category   TEXT,
  minutes    INTEGER NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at   TEXT,
  notes      TEXT,
  _dirty     INTEGER NOT NULL DEFAULT 0,
  _deleted   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_deep_work_sessions_user_id ON deep_work_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_deep_work_sessions_date_key ON deep_work_sessions(date_key);

CREATE TABLE IF NOT EXISTS deep_work_tasks (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  task_name  TEXT NOT NULL,
  category   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty     INTEGER NOT NULL DEFAULT 0,
  _deleted   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_deep_work_tasks_user_id ON deep_work_tasks(user_id);

CREATE TABLE IF NOT EXISTS field_op_cooldown (
  user_id        TEXT PRIMARY KEY,
  cooldown_until TEXT,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty         INTEGER NOT NULL DEFAULT 0,
  _deleted       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_field_op_cooldown_user_id ON field_op_cooldown(user_id);
CREATE INDEX IF NOT EXISTS idx_field_op_cooldown_updated_at ON field_op_cooldown(updated_at);

CREATE TABLE IF NOT EXISTS field_ops (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  field_op_id  TEXT NOT NULL,
  current_day  INTEGER NOT NULL DEFAULT 0,
  day_results  TEXT NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL,
  started_at   TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  _dirty       INTEGER NOT NULL DEFAULT 0,
  _deleted     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_field_ops_user_id ON field_ops(user_id);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  date_key         TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  category         TEXT,
  completed        INTEGER NOT NULL DEFAULT 1,
  started_at       TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at         TEXT,
  _dirty           INTEGER NOT NULL DEFAULT 0,
  _deleted         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_date_key ON focus_sessions(date_key);

CREATE TABLE IF NOT EXISTS focus_settings (
  user_id               TEXT PRIMARY KEY,
  pomodoro_minutes      INTEGER NOT NULL DEFAULT 25,
  break_minutes         INTEGER NOT NULL DEFAULT 5,
  daily_target_sessions INTEGER NOT NULL DEFAULT 4,
  sound_enabled         INTEGER NOT NULL DEFAULT 1,
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  long_break_minutes    INTEGER NOT NULL DEFAULT 15,
  long_break_after      INTEGER NOT NULL DEFAULT 4,
  _dirty                INTEGER NOT NULL DEFAULT 0,
  _deleted              INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_focus_settings_updated_at ON focus_settings(updated_at);

CREATE TABLE IF NOT EXISTS goals (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  target_date TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty      INTEGER NOT NULL DEFAULT 0,
  _deleted    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_updated_at ON goals(updated_at);

CREATE TABLE IF NOT EXISTS gym_exercises (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  name         TEXT NOT NULL,
  muscle_group TEXT,
  equipment    TEXT,
  notes        TEXT,
  is_custom    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty       INTEGER NOT NULL DEFAULT 0,
  _deleted     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_gym_exercises_user_id ON gym_exercises(user_id);

CREATE TABLE IF NOT EXISTS gym_personal_records (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  weight        REAL NOT NULL,
  reps          INTEGER NOT NULL,
  achieved_at   TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty        INTEGER NOT NULL DEFAULT 0,
  _deleted      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_gym_personal_records_user_id ON gym_personal_records(user_id);

CREATE TABLE IF NOT EXISTS gym_sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  template_id TEXT,
  name        TEXT,
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at    TEXT,
  notes       TEXT,
  date_key    TEXT NOT NULL,
  _dirty      INTEGER NOT NULL DEFAULT 0,
  _deleted    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_gym_sessions_user_id ON gym_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_gym_sessions_date_key ON gym_sessions(date_key);

CREATE TABLE IF NOT EXISTS gym_sets (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  session_id    TEXT NOT NULL,
  exercise_id   TEXT,
  exercise_name TEXT NOT NULL,
  set_index     INTEGER NOT NULL,
  weight        REAL,
  reps          INTEGER,
  rpe           REAL,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty        INTEGER NOT NULL DEFAULT 0,
  _deleted      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_gym_sets_user_id ON gym_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_gym_sets_session_id ON gym_sets(session_id);

CREATE TABLE IF NOT EXISTS gym_templates (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  exercise_ids TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty       INTEGER NOT NULL DEFAULT 0,
  _deleted     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_gym_templates_user_id ON gym_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_gym_templates_updated_at ON gym_templates(updated_at);

CREATE TABLE IF NOT EXISTS habit_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  habit_id   TEXT NOT NULL,
  date_key   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty     INTEGER NOT NULL DEFAULT 0,
  _deleted   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_id ON habit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date_key ON habit_logs(date_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_habit_logs_habit_date
  ON habit_logs(habit_id, date_key) WHERE _deleted = 0;

CREATE TABLE IF NOT EXISTS habits (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  title             TEXT NOT NULL,
  engine            TEXT NOT NULL,
  icon              TEXT NOT NULL DEFAULT '',
  trigger_text      TEXT,
  duration_text     TEXT,
  frequency         TEXT,
  current_chain     INTEGER NOT NULL DEFAULT 0,
  best_chain        INTEGER NOT NULL DEFAULT 0,
  last_broken_date  TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  legacy_local_id   INTEGER,
  _dirty            INTEGER NOT NULL DEFAULT 0,
  _deleted          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_updated_at ON habits(updated_at);

CREATE TABLE IF NOT EXISTS journal_entries (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  date_key   TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty     INTEGER NOT NULL DEFAULT 0,
  _deleted   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_updated_at ON journal_entries(updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_entries_user_date
  ON journal_entries(user_id, date_key) WHERE _deleted = 0;

CREATE TABLE IF NOT EXISTS meal_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  date_key   TEXT NOT NULL,
  name       TEXT NOT NULL,
  calories   INTEGER NOT NULL DEFAULT 0,
  protein_g  REAL NOT NULL DEFAULT 0,
  carbs_g    REAL NOT NULL DEFAULT 0,
  fat_g      REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty     INTEGER NOT NULL DEFAULT 0,
  _deleted   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_meal_logs_user_id ON meal_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_logs_date_key ON meal_logs(date_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_logs_user_date_name
  ON meal_logs(user_id, date_key, name) WHERE _deleted = 0;

CREATE TABLE IF NOT EXISTS mind_training_results (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  exercise_id     TEXT NOT NULL,
  type            TEXT NOT NULL,
  category        TEXT,
  correct         INTEGER NOT NULL,
  selected_option TEXT,
  time_spent_ms   INTEGER,
  answered_at     TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty          INTEGER NOT NULL DEFAULT 0,
  _deleted        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_mind_training_results_user_id ON mind_training_results(user_id);

CREATE TABLE IF NOT EXISTS money_loans (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  lender          TEXT NOT NULL,
  name            TEXT,
  amount          REAL NOT NULL DEFAULT 0,
  paid            REAL NOT NULL DEFAULT 0,
  date_iso        TEXT NOT NULL,
  due_iso         TEXT,
  status          TEXT NOT NULL DEFAULT 'unpaid',
  interest_rate   REAL,
  monthly_payment REAL,
  start_date      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty          INTEGER NOT NULL DEFAULT 0,
  _deleted        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_money_loans_user_id ON money_loans(user_id);

CREATE TABLE IF NOT EXISTS money_transactions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  date_key   TEXT NOT NULL,
  amount     REAL NOT NULL,
  category   TEXT NOT NULL,
  type       TEXT NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty     INTEGER NOT NULL DEFAULT 0,
  _deleted   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_money_transactions_user_id ON money_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_money_transactions_date_key ON money_transactions(date_key);

CREATE TABLE IF NOT EXISTS narrative_entries (
  id       TEXT PRIMARY KEY,
  user_id  TEXT NOT NULL,
  flag     TEXT NOT NULL,
  seen_at  TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty   INTEGER NOT NULL DEFAULT 0,
  _deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_narrative_entries_user_id ON narrative_entries(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_narrative_entries_user_flag
  ON narrative_entries(user_id, flag) WHERE _deleted = 0;

CREATE TABLE IF NOT EXISTS narrative_log (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  date_key   TEXT NOT NULL,
  type       TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty     INTEGER NOT NULL DEFAULT 0,
  _deleted   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_narrative_log_user_id ON narrative_log(user_id);
CREATE INDEX IF NOT EXISTS idx_narrative_log_date_key ON narrative_log(date_key);

CREATE TABLE IF NOT EXISTS nutrition_profile (
  user_id              TEXT PRIMARY KEY,
  sex                  TEXT,
  age                  INTEGER,
  height_cm            REAL,
  weight_kg            REAL,
  body_fat_pct         REAL,
  steps_per_day        INTEGER,
  workouts_per_week    INTEGER,
  goal                 TEXT,
  goal_rate            TEXT,
  protein_preference   TEXT,
  daily_calorie_target INTEGER,
  protein_target_g     INTEGER,
  carbs_target_g       INTEGER,
  fat_target_g         INTEGER,
  bmr                  INTEGER,
  tdee                 INTEGER,
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty               INTEGER NOT NULL DEFAULT 0,
  _deleted             INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_nutrition_profile_updated_at ON nutrition_profile(updated_at);

CREATE TABLE IF NOT EXISTS profiles (
  id                       TEXT PRIMARY KEY,
  email                    TEXT,
  archetype                TEXT
                             CHECK(archetype IS NULL OR archetype IN
                               ('titan','athlete','scholar','hustler','showman','warrior','founder','charmer')),
  mode                     TEXT NOT NULL DEFAULT 'full_protocol'
                             CHECK(mode IN ('full_protocol','structured','tracker','focus','zen','titan')),
  focus_engines            TEXT NOT NULL DEFAULT '[]',
  xp                       INTEGER NOT NULL DEFAULT 0,
  level                    INTEGER NOT NULL DEFAULT 1,
  streak_current           INTEGER NOT NULL DEFAULT 0,
  streak_best              INTEGER NOT NULL DEFAULT 0,
  streak_last_date         TEXT,
  first_use_date           TEXT,
  onboarding_completed     INTEGER NOT NULL DEFAULT 0,
  tutorial_completed       INTEGER NOT NULL DEFAULT 0,
  first_task_completed_at  TEXT,
  display_name             TEXT,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty                   INTEGER NOT NULL DEFAULT 0,
  _deleted                 INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);

CREATE TABLE IF NOT EXISTS progression (
  user_id          TEXT PRIMARY KEY,
  current_phase    TEXT NOT NULL DEFAULT 'foundation'
                     CHECK(current_phase IN ('foundation','building','intensify','sustain')),
  current_week     INTEGER NOT NULL DEFAULT 1,
  phase_start_week INTEGER NOT NULL DEFAULT 1,
  first_use_date   TEXT,
  phase_start_date TEXT,
  phase_history    TEXT NOT NULL DEFAULT '[]',
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty           INTEGER NOT NULL DEFAULT 0,
  _deleted         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_progression_updated_at ON progression(updated_at);

CREATE TABLE IF NOT EXISTS protocol_sessions (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL,
  date_key               TEXT NOT NULL,
  morning_intention      TEXT,
  morning_completed_at   TEXT,
  evening_reflection     TEXT,
  evening_completed_at   TEXT,
  titan_score            INTEGER,
  identity_at_completion TEXT
                           CHECK(identity_at_completion IS NULL OR identity_at_completion IN
                             ('titan','athlete','scholar','hustler','showman','warrior','founder','charmer')),
  habit_checks           TEXT NOT NULL DEFAULT '{}',
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty                 INTEGER NOT NULL DEFAULT 0,
  _deleted               INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_protocol_sessions_user_id ON protocol_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_protocol_sessions_updated_at ON protocol_sessions(updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_protocol_sessions_user_date
  ON protocol_sessions(user_id, date_key) WHERE _deleted = 0;

CREATE TABLE IF NOT EXISTS quests (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  week_start_key TEXT NOT NULL,
  type           TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  target         INTEGER NOT NULL DEFAULT 1,
  progress       INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK(status IN ('active','completed','failed')),
  xp_reward      INTEGER NOT NULL DEFAULT 0,
  metadata       TEXT NOT NULL DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at     TEXT,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty         INTEGER NOT NULL DEFAULT 0,
  _deleted       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_quests_user_id ON quests(user_id);
CREATE INDEX IF NOT EXISTS idx_quests_updated_at ON quests(updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_quests_user_week_type
  ON quests(user_id, week_start_key, type) WHERE _deleted = 0;

CREATE TABLE IF NOT EXISTS quick_meals (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  calories   INTEGER NOT NULL DEFAULT 0,
  protein_g  REAL NOT NULL DEFAULT 0,
  carbs_g    REAL NOT NULL DEFAULT 0,
  fat_g      REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty     INTEGER NOT NULL DEFAULT 0,
  _deleted   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_quick_meals_user_id ON quick_meals(user_id);

CREATE TABLE IF NOT EXISTS rank_up_events (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  from_level   INTEGER NOT NULL,
  to_level     INTEGER NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  dismissed_at TEXT,
  _dirty       INTEGER NOT NULL DEFAULT 0,
  _deleted     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rank_up_events_user_id ON rank_up_events(user_id);

CREATE TABLE IF NOT EXISTS skill_tree_progress (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  engine     TEXT NOT NULL CHECK(engine IN ('body','mind','money','charisma')),
  node_id    TEXT NOT NULL,
  state      TEXT NOT NULL DEFAULT 'locked'
               CHECK(state IN ('locked','ready','claimed')),
  progress   INTEGER NOT NULL DEFAULT 0,
  claimed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty     INTEGER NOT NULL DEFAULT 0,
  _deleted   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_skill_tree_progress_user_id ON skill_tree_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_tree_progress_updated_at ON skill_tree_progress(updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_skill_tree_progress_user_engine_node
  ON skill_tree_progress(user_id, engine, node_id) WHERE _deleted = 0;

CREATE TABLE IF NOT EXISTS sleep_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  date_key    TEXT NOT NULL,
  hours_slept REAL,
  quality     INTEGER,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty      INTEGER NOT NULL DEFAULT 0,
  _deleted    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_id ON sleep_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_date_key ON sleep_logs(date_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sleep_logs_user_date
  ON sleep_logs(user_id, date_key) WHERE _deleted = 0;

CREATE TABLE IF NOT EXISTS srs_cards (
  user_id        TEXT NOT NULL,
  exercise_id    TEXT NOT NULL,
  interval_days  INTEGER NOT NULL DEFAULT 1,
  ease_factor    REAL NOT NULL DEFAULT 2.5,
  review_count   INTEGER NOT NULL DEFAULT 0,
  next_review_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty         INTEGER NOT NULL DEFAULT 0,
  _deleted       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, exercise_id)
);
CREATE INDEX IF NOT EXISTS idx_srs_cards_user_id ON srs_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_srs_cards_updated_at ON srs_cards(updated_at);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id                TEXT PRIMARY KEY,
  status                 TEXT NOT NULL DEFAULT 'none'
                           CHECK(status IN ('none','trial','active','grace','expired','cancelled','refunded')),
  product_id             TEXT,
  entitlement_id         TEXT,
  period_type            TEXT,
  store                  TEXT,
  original_purchase_date TEXT,
  purchase_date          TEXT,
  expires_at             TEXT,
  renewed_at             TEXT,
  will_renew             INTEGER NOT NULL DEFAULT 0,
  cancel_reason          TEXT,
  last_event_type        TEXT,
  last_event_at          TEXT,
  raw_event              TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty                 INTEGER NOT NULL DEFAULT 0,
  _deleted               INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_updated_at ON subscriptions(updated_at);

CREATE TABLE IF NOT EXISTS tasks (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  engine           TEXT NOT NULL CHECK(engine IN ('body','mind','money','charisma')),
  title            TEXT NOT NULL,
  kind             TEXT NOT NULL DEFAULT 'main' CHECK(kind IN ('main','secondary')),
  days_per_week    INTEGER NOT NULL DEFAULT 7,
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  legacy_local_id  INTEGER,
  _dirty           INTEGER NOT NULL DEFAULT 0,
  _deleted         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);

CREATE TABLE IF NOT EXISTS titan_mode_state (
  user_id            TEXT PRIMARY KEY,
  unlocked           INTEGER NOT NULL DEFAULT 0,
  consecutive_days   INTEGER NOT NULL DEFAULT 0,
  average_score      REAL NOT NULL DEFAULT 0,
  start_date         TEXT,
  last_recorded_date TEXT,
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty             INTEGER NOT NULL DEFAULT 0,
  _deleted           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_titan_mode_state_updated_at ON titan_mode_state(updated_at);

CREATE TABLE IF NOT EXISTS user_titles (
  user_id     TEXT NOT NULL,
  title_id    TEXT NOT NULL,
  unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
  equipped    INTEGER NOT NULL DEFAULT 0,
  _dirty      INTEGER NOT NULL DEFAULT 0,
  _deleted    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, title_id)
);
CREATE INDEX IF NOT EXISTS idx_user_titles_user_id ON user_titles(user_id);

CREATE TABLE IF NOT EXISTS water_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  date_key   TEXT NOT NULL,
  glasses    INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty     INTEGER NOT NULL DEFAULT 0,
  _deleted   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_water_logs_user_id ON water_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_water_logs_updated_at ON water_logs(updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_water_logs_user_date
  ON water_logs(user_id, date_key) WHERE _deleted = 0;

CREATE TABLE IF NOT EXISTS weight_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  date_key   TEXT NOT NULL,
  weight_kg  REAL NOT NULL,
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  _dirty     INTEGER NOT NULL DEFAULT 0,
  _deleted   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_weight_logs_user_id ON weight_logs(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_weight_logs_user_date
  ON weight_logs(user_id, date_key) WHERE _deleted = 0;

-- ============================================================
-- SQLite-only support tables
-- ============================================================

CREATE TABLE IF NOT EXISTS pending_mutations (
  id           TEXT PRIMARY KEY,
  table_name   TEXT NOT NULL,
  row_id       TEXT NOT NULL,
  op           TEXT NOT NULL CHECK(op IN ('upsert','delete')),
  payload      TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  next_attempt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pending_mutations_next_attempt ON pending_mutations(next_attempt);
CREATE INDEX IF NOT EXISTS idx_pending_mutations_table_row ON pending_mutations(table_name, row_id);

CREATE TABLE IF NOT EXISTS sync_meta (
  table_name     TEXT PRIMARY KEY,
  last_pulled_at TEXT,
  last_push_ok   TEXT,
  last_pull_ok   TEXT
);
