import * as SQLite from "expo-sqlite";

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync("titan_protocol_v2");

  // Enable WAL mode for better performance
  await _db.execAsync("PRAGMA journal_mode = WAL;");

  // Create all tables
  await _db.execAsync(`
    -- Engine system
    CREATE TABLE IF NOT EXISTS engine_meta (
      id TEXT PRIMARY KEY,
      start_date TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      engine TEXT NOT NULL,
      title TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'main',
      created_at INTEGER NOT NULL,
      days_per_week INTEGER NOT NULL DEFAULT 7,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      engine TEXT NOT NULL,
      task_id INTEGER NOT NULL,
      date_key TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_engine ON tasks(engine);
    CREATE INDEX IF NOT EXISTS idx_tasks_engine_kind ON tasks(engine, kind);
    CREATE INDEX IF NOT EXISTS idx_completions_engine_date ON completions(engine, date_key);
    CREATE INDEX IF NOT EXISTS idx_completions_task_date ON completions(task_id, date_key);

    -- Habits
    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      engine TEXT NOT NULL DEFAULT 'all',
      icon TEXT NOT NULL DEFAULT '✓',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL,
      date_key TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(habit_id, date_key);

    -- Journal
    CREATE TABLE IF NOT EXISTS journal_entries (
      date_key TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Goals
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      engine TEXT NOT NULL DEFAULT 'all',
      type TEXT NOT NULL DEFAULT 'consistency',
      target REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '',
      deadline TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      threshold REAL
    );

    CREATE TABLE IF NOT EXISTS goal_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      task_type TEXT NOT NULL DEFAULT 'once',
      engine TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    -- Gamification
    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY DEFAULT 'default',
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      streak INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      last_active_date TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS xp_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_key TEXT NOT NULL,
      source TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_scores (
      date_key TEXT NOT NULL,
      engine TEXT NOT NULL,
      score REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (date_key, engine)
    );

    -- Insert default profile if not exists
    INSERT OR IGNORE INTO user_profile (id, xp, level, streak, best_streak, last_active_date)
    VALUES ('default', 0, 1, 0, 0, '');
  `);

  return _db;
}
