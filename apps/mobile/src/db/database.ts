import * as SQLite from "expo-sqlite";

// Singleton promise — prevents race condition where multiple callers
// try to init the DB simultaneously before tables are created
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!_dbPromise) {
    _dbPromise = initDB();
  }
  return _dbPromise;
}

async function initDB(): Promise<SQLite.SQLiteDatabase> {
  try {
    const db = await SQLite.openDatabaseAsync("titan_protocol_v2");

    // Enable WAL mode for better performance
    await db.execAsync("PRAGMA journal_mode = WAL;");

    // Create tables one group at a time to avoid multi-statement issues
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS engine_meta (
        id TEXT PRIMARY KEY,
        start_date TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        engine TEXT NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'main',
        created_at INTEGER NOT NULL,
        days_per_week INTEGER NOT NULL DEFAULT 7,
        is_active INTEGER NOT NULL DEFAULT 1
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        engine TEXT NOT NULL,
        task_id INTEGER NOT NULL,
        date_key TEXT NOT NULL
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_tasks_engine ON tasks(engine);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_tasks_engine_kind ON tasks(engine, kind);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_completions_engine_date ON completions(engine, date_key);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_completions_task_date ON completions(task_id, date_key);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS habits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        engine TEXT NOT NULL DEFAULT 'all',
        icon TEXT NOT NULL DEFAULT '✓',
        created_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS habit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        habit_id INTEGER NOT NULL,
        date_key TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(habit_id, date_key);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        date_key TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`
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
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS goal_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        task_type TEXT NOT NULL DEFAULT 'once',
        engine TEXT,
        completed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id TEXT PRIMARY KEY DEFAULT 'default',
        xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        streak INTEGER NOT NULL DEFAULT 0,
        best_streak INTEGER NOT NULL DEFAULT 0,
        last_active_date TEXT NOT NULL DEFAULT ''
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS xp_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date_key TEXT NOT NULL,
        source TEXT NOT NULL,
        amount INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS daily_scores (
        date_key TEXT NOT NULL,
        engine TEXT NOT NULL,
        score REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (date_key, engine)
      );
    `);

    // Insert default profile if not exists
    await db.runAsync(
      "INSERT OR IGNORE INTO user_profile (id, xp, level, streak, best_streak, last_active_date) VALUES ('default', 0, 1, 0, 0, '')"
    );

    console.log("[TitanDB] Database initialized successfully");
    return db;
  } catch (err) {
    console.error("[TitanDB] Failed to initialize database:", err);
    _dbPromise = null; // Allow retry on next call
    throw err;
  }
}
