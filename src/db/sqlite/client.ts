import {
  openDatabaseAsync,
  type SQLiteBindValue,
  type SQLiteDatabase,
  type SQLiteRunResult,
} from "expo-sqlite";

// Single-DB-per-app. The file lives in the default Expo SQLite directory
// (app sandbox) and is opened once. The promise is cached so repeat calls
// during cold-start races resolve to the same instance.
const DB_NAME = "titan.db";

let dbPromise: Promise<SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync(DB_NAME).then(async (db) => {
      // WAL gives better write concurrency and reduces fsync latency on
      // Android. foreign_keys stays OFF — we do not declare FK constraints
      // in the schema; integrity is enforced in the service layer so that
      // pull-order / partial sync states never trigger a constraint failure.
      await db.execAsync(
        "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF; PRAGMA synchronous = NORMAL;",
      );
      return db;
    });
  }
  return dbPromise;
}

// Test-only: force a re-open. Don't call this from app code.
export function _resetDbForTests(): void {
  dbPromise = null;
}

// Widened BindParams so callers can pass the kind of loose `unknown[]`
// that comes out of service-layer PK extraction (`pkCols.map(c => row[c])`)
// without a cast at every call site. The cast happens once here when we
// hand the values to expo-sqlite.
export type BindParams =
  | SQLiteBindValue[]
  | unknown[]
  | Record<string, SQLiteBindValue>
  | Record<string, unknown>;

export async function all<T = unknown>(
  sql: string,
  params: BindParams = [],
): Promise<T[]> {
  const db = await getDb();
  return db.getAllAsync<T>(sql, params as SQLiteBindValue[]);
}

export async function get<T = unknown>(
  sql: string,
  params: BindParams = [],
): Promise<T | null> {
  const db = await getDb();
  return db.getFirstAsync<T>(sql, params as SQLiteBindValue[]);
}

export async function run(
  sql: string,
  params: BindParams = [],
): Promise<SQLiteRunResult> {
  const db = await getDb();
  return db.runAsync(sql, params as SQLiteBindValue[]);
}

// Execute a multi-statement script. No bind params (expo-sqlite's execAsync
// doesn't accept them). Used for migrations.
export async function exec(source: string): Promise<void> {
  const db = await getDb();
  await db.execAsync(source);
}

export async function transaction<T>(
  task: (tx: SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  let result!: T;
  await db.withTransactionAsync(async () => {
    result = await task(db);
  });
  return result;
}
