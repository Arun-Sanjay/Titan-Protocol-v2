/**
 * Tauri desktop SQLite client backed by @tauri-apps/plugin-sql. The
 * plugin runs SQLite natively in the Rust process via sqlx, giving the
 * desktop build the same performance profile as mobile (no WASM, no
 * worker round-trip).
 *
 * This file is never imported on the browser build — see `client.ts`
 * for the runtime branch.
 */

import type { ClientImpl, RunResult } from "./client-types";

type TauriDatabase = {
  execute: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  close: () => Promise<boolean>;
};

let dbPromise: Promise<TauriDatabase> | null = null;

async function getDb(): Promise<TauriDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const mod = await import("@tauri-apps/plugin-sql");
    const ctor = mod.default as unknown as {
      load: (path: string) => Promise<TauriDatabase>;
    };
    const db = await ctor.load("sqlite:titan.db");
    // Parity with mobile/browser: no FK enforcement at the DB layer.
    await db.execute("PRAGMA foreign_keys = OFF;");
    return db;
  })();
  return dbPromise;
}

function toParamsArray(params: unknown): unknown[] {
  if (params == null) return [];
  if (Array.isArray(params)) return params;
  return Object.values(params as Record<string, unknown>);
}

async function all<T>(sql: string, params: unknown = []): Promise<T[]> {
  const db = await getDb();
  return db.select<T>(sql, toParamsArray(params));
}

async function get<T>(sql: string, params: unknown = []): Promise<T | null> {
  const rows = await all<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function run(sql: string, params: unknown = []): Promise<RunResult> {
  const db = await getDb();
  const res = await db.execute(sql, toParamsArray(params));
  return {
    changes: res.rowsAffected,
    lastInsertRowId: res.lastInsertId ?? 0,
  };
}

// tauri-plugin-sql's execute() runs a single statement per call. For
// multi-statement migration scripts, split on statement terminators that
// live outside string literals or comments, then run each one.
function splitStatements(source: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        buf += ch;
      }
      i++;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    if (inSingle) {
      buf += ch;
      if (ch === "'" && next === "'") {
        buf += next;
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i++;
      continue;
    }
    if (inDouble) {
      buf += ch;
      if (ch === '"') inDouble = false;
      i++;
      continue;
    }
    if (ch === "-" && next === "-") {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      buf += ch;
      i++;
      continue;
    }
    if (ch === ";") {
      const trimmed = buf.trim();
      if (trimmed.length > 0) out.push(trimmed);
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  const tail = buf.trim();
  if (tail.length > 0) out.push(tail);
  return out;
}

async function exec(source: string): Promise<void> {
  const db = await getDb();
  const statements = splitStatements(source);
  for (const stmt of statements) {
    await db.execute(stmt);
  }
}

let txDepth = 0;

async function transaction<T>(task: (tx: unknown) => Promise<T>): Promise<T> {
  const db = await getDb();
  if (txDepth === 0) {
    txDepth++;
    await db.execute("BEGIN");
    try {
      const result = await task(undefined);
      await db.execute("COMMIT");
      return result;
    } catch (err) {
      try {
        await db.execute("ROLLBACK");
      } catch {
        // already unwinding from the primary error
      }
      throw err;
    } finally {
      txDepth--;
    }
  }
  const sp = `sp_${txDepth}_${Date.now()}`;
  txDepth++;
  await db.execute(`SAVEPOINT ${sp}`);
  try {
    const result = await task(undefined);
    await db.execute(`RELEASE SAVEPOINT ${sp}`);
    return result;
  } catch (err) {
    try {
      await db.execute(`ROLLBACK TO SAVEPOINT ${sp}`);
      await db.execute(`RELEASE SAVEPOINT ${sp}`);
    } catch {
      // outer transaction will clean up
    }
    throw err;
  } finally {
    txDepth--;
  }
}

export const impl: ClientImpl = { all, get, run, exec, transaction };
