/**
 * Test-only shim that implements the surface of src/db/sqlite/client.ts
 * against an in-memory better-sqlite3 instance. Tests use this via
 *
 *   jest.mock("../../db/sqlite/client", () => require("../setup/sqlite-fake"));
 *
 * The initial migration (001_initial.sql) is applied once so all 42
 * tables + pending_mutations + sync_meta are present exactly as in
 * production. WAL-mode pragmas are omitted — in-memory databases don't
 * support WAL and we don't need write concurrency in tests.
 */

import Database from "better-sqlite3";
import { SQL as SQL_001 } from "../../db/sqlite/migrations/001_initial";

let db: Database.Database = openFresh();

function openFresh(): Database.Database {
  const d = new Database(":memory:");
  d.pragma("foreign_keys = OFF");
  d.exec(SQL_001);
  d.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       id TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
  );
  d.prepare(
    `INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)`,
  ).run("001_initial");
  return d;
}

/** Reset the in-memory DB. Call from `beforeEach`. */
export function _resetTestDb(): void {
  db = openFresh();
  txDepth = 0;
}

/** Direct DB access for assertions that want to peek. */
export function _testDb(): Database.Database {
  return db;
}

// ─── client.ts surface ──────────────────────────────────────────────────────

type Params = unknown[] | Record<string, unknown>;

function execParams(stmt: Database.Statement, params: Params): Database.RunResult {
  return Array.isArray(params)
    ? stmt.run(...(params as unknown[]))
    : stmt.run(params as Record<string, unknown>);
}
function allParams<T>(stmt: Database.Statement, params: Params): T[] {
  return (Array.isArray(params)
    ? stmt.all(...(params as unknown[]))
    : stmt.all(params as Record<string, unknown>)) as T[];
}
function getParams<T>(stmt: Database.Statement, params: Params): T | undefined {
  return (Array.isArray(params)
    ? stmt.get(...(params as unknown[]))
    : stmt.get(params as Record<string, unknown>)) as T | undefined;
}

export async function all<T>(sql: string, params: Params = []): Promise<T[]> {
  const stmt = db.prepare(sql);
  return allParams<T>(stmt, params);
}

export async function get<T>(sql: string, params: Params = []): Promise<T | null> {
  const stmt = db.prepare(sql);
  const row = getParams<T>(stmt, params);
  return row ?? null;
}

export async function run(
  sql: string,
  params: Params = [],
): Promise<{ lastInsertRowId: number; changes: number }> {
  const stmt = db.prepare(sql);
  const res = execParams(stmt, params);
  return {
    lastInsertRowId: Number(res.lastInsertRowid),
    changes: res.changes,
  };
}

export async function exec(source: string): Promise<void> {
  db.exec(source);
}

/**
 * Nested-transaction-safe wrapper. Matches the production client.ts
 * semantics: the outermost call does BEGIN/COMMIT; nested calls use
 * SAVEPOINT so a service can wrap its own transaction around code that
 * itself calls `transaction()`.
 */
let txDepth = 0;

export async function transaction<T>(
  task: (tx: Database.Database) => Promise<T>,
): Promise<T> {
  if (txDepth === 0) {
    txDepth++;
    db.prepare("BEGIN").run();
    try {
      const result = await task(db);
      db.prepare("COMMIT").run();
      return result;
    } catch (err) {
      db.prepare("ROLLBACK").run();
      throw err;
    } finally {
      txDepth--;
    }
  }
  const sp = `sp_${txDepth}_${Date.now()}`;
  txDepth++;
  db.exec(`SAVEPOINT ${sp}`);
  try {
    const result = await task(db);
    db.exec(`RELEASE SAVEPOINT ${sp}`);
    return result;
  } catch (err) {
    try {
      db.exec(`ROLLBACK TO SAVEPOINT ${sp}`);
      db.exec(`RELEASE SAVEPOINT ${sp}`);
    } catch {
      // outer rollback will clean up
    }
    throw err;
  } finally {
    txDepth--;
  }
}

export async function getDb(): Promise<Database.Database> {
  return db;
}

export function _resetDbForTests(): void {
  _resetTestDb();
}
