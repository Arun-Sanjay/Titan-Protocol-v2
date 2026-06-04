/**
 * Dedicated SQLite Worker.
 *
 * sqlite-wasm's OPFS SAH Pool VFS uses `FileSystemSyncAccessHandle`, which
 * only exists inside Web Worker contexts. We cannot install it from the
 * main thread, and sqlite-wasm's built-in Worker1 bundle doesn't
 * pre-install it either. So this file runs inside a worker we spawn
 * ourselves: it initializes sqlite3, installs the SAH Pool VFS under a
 * named pool ("titan-pool"), opens `/titan.db`, and accepts a tiny
 * message-based RPC for reads and writes.
 *
 * Protocol (see `client-browser.ts` for the matching dispatcher):
 *
 *   request   { id: number, op: "init" | "all" | "get" | "run" | "exec",
 *               sql?: string, params?: unknown[] }
 *   response  { id: number, ok: true, result?: unknown }
 *             | { id: number, ok: false, error: string }
 *
 * The worker processes messages sequentially. Since sqlite-wasm's oo1
 * Database is synchronous within this thread, transactions are handled
 * by the client sending BEGIN / COMMIT / SAVEPOINT as regular `exec`
 * messages.
 */

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

type SqlValue = unknown;

type Database = {
  exec(opts: {
    sql: string;
    bind?: SqlValue[];
    rowMode?: "array" | "object";
    resultRows?: unknown[];
  }): unknown;
  exec(sql: string): Database;
  changes(): number;
};

type SqlitePool = {
  OpfsSAHPoolDb: new (filename: string) => Database;
};

type InitMessage = { id: number; op: "init" };
type QueryMessage =
  | { id: number; op: "all" | "get" | "run"; sql: string; params?: SqlValue[] }
  | { id: number; op: "exec"; sql: string };
type IncomingMessage = InitMessage | QueryMessage;

let db: Database | null = null;
let initPromise: Promise<void> | null = null;

async function initDb(): Promise<void> {
  if (db) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const sqlite3 = (await (sqlite3InitModule as unknown as (
      opts?: Record<string, unknown>,
    ) => Promise<{
      installOpfsSAHPoolVfs: (opts?: Record<string, unknown>) => Promise<SqlitePool>;
    }>)({
      print: (...args: unknown[]) => console.log("[sqlite-worker]", ...args),
      printErr: (...args: unknown[]) => console.error("[sqlite-worker]", ...args),
    }));

    const pool = await sqlite3.installOpfsSAHPoolVfs({
      name: "titan-pool",
      initialCapacity: 6,
      // clearOnInit defaults to false — preserve the DB across reloads.
    });

    db = new pool.OpfsSAHPoolDb("/titan.db");
    db.exec("PRAGMA foreign_keys = OFF;");
  })();
  return initPromise;
}

function handleQuery(msg: QueryMessage): unknown {
  if (!db) throw new Error("DB not initialized");
  switch (msg.op) {
    case "all": {
      const rows: unknown[] = [];
      db.exec({
        sql: msg.sql,
        bind: msg.params ?? [],
        rowMode: "object",
        resultRows: rows,
      });
      return rows;
    }
    case "get": {
      const rows: unknown[] = [];
      db.exec({
        sql: msg.sql,
        bind: msg.params ?? [],
        rowMode: "object",
        resultRows: rows,
      });
      return rows.length > 0 ? rows[0] : null;
    }
    case "run": {
      db.exec({
        sql: msg.sql,
        bind: msg.params ?? [],
      });
      return { changes: db.changes(), lastInsertRowId: 0 };
    }
    case "exec": {
      db.exec(msg.sql);
      return null;
    }
  }
}

self.onmessage = async (e: MessageEvent<IncomingMessage>) => {
  const msg = e.data;
  const id = msg.id;
  try {
    if (msg.op === "init") {
      await initDb();
      self.postMessage({ id, ok: true });
      return;
    }
    // Lazy-init on first query if the client never sent init.
    if (!db) await initDb();
    const result = handleQuery(msg);
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    const message = errorMessage(err);
    self.postMessage({ id, ok: false, error: message });
  }
};

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    const r = obj.result as Record<string, unknown> | undefined;
    if (r && typeof r.message === "string") return r.message;
    if (typeof obj.message === "string") return obj.message;
    try {
      return JSON.stringify(err);
    } catch {
      return "[unserializable error]";
    }
  }
  return String(err ?? "unknown");
}
