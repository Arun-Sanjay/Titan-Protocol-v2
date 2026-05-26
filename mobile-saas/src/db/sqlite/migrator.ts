import { exec, get, run } from "./client";
import { migrations, type Migration } from "./migrations";

// The migration bookkeeping table. Created lazily — the first call to
// `runMigrations()` will ensure it exists before reading.
const META_DDL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id         TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

async function ensureMetaTable(): Promise<void> {
  await exec(META_DDL);
}

async function alreadyApplied(id: string): Promise<boolean> {
  const row = await get<{ id: string }>(
    "SELECT id FROM schema_migrations WHERE id = ?",
    [id],
  );
  return row !== null;
}

async function recordApplied(id: string): Promise<void> {
  // OR IGNORE so a double-invoked migrator (StrictMode in dev / Fast Refresh
  // / hot reload) can't race two concurrent applies into a UNIQUE constraint
  // failure on schema_migrations.id. The `alreadyApplied` check earlier is
  // the fast path; this is the race-safe backstop.
  await run("INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)", [id]);
}

// Errors that indicate the migration's effects are already present in the
// schema — i.e. the prior boot ran the DDL but failed to flip the
// schema_migrations row (the race that the OR IGNORE above prevents going
// forward; this list handles devices whose SQLite got into that state
// before the fix landed). Treat them as "already done" rather than failure.
const ALREADY_APPLIED_PATTERNS: readonly RegExp[] = [
  /duplicate column name/i,
  /already exists/i,
];

function isAlreadyAppliedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return ALREADY_APPLIED_PATTERNS.some((p) => p.test(msg));
}

// Apply a single migration. expo-sqlite's execAsync already runs
// multi-statement scripts atomically-ish (it uses a SQLite-level transaction
// when the source contains BEGIN/COMMIT). Our migrations don't include
// explicit BEGIN/COMMIT because expo-sqlite wraps execAsync in an implicit
// savepoint on iOS/Android — failure rolls back. We separately record the
// migration id as `applied` ONLY after the DDL succeeds, so a partial
// apply won't be marked done — except for the "already-applied" benign
// case caught below.
async function applyOne(m: Migration): Promise<void> {
  try {
    await exec(m.sql);
  } catch (err) {
    if (!isAlreadyAppliedError(err)) throw err;
    // Schema already matches the migration's intent — fall through to
    // recordApplied so we don't retry every boot.
  }
  await recordApplied(m.id);
}

// Run every pending migration in order. Safe to call on every app boot;
// migrations already present in `schema_migrations` are skipped.
export async function runMigrations(): Promise<{
  applied: string[];
  skipped: string[];
}> {
  await ensureMetaTable();

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const m of migrations) {
    if (await alreadyApplied(m.id)) {
      skipped.push(m.id);
      continue;
    }
    await applyOne(m);
    applied.push(m.id);
  }

  return { applied, skipped };
}
