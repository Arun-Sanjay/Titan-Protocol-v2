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
  await run("INSERT INTO schema_migrations (id) VALUES (?)", [id]);
}

// Apply a single migration. expo-sqlite's execAsync already runs
// multi-statement scripts atomically-ish (it uses a SQLite-level transaction
// when the source contains BEGIN/COMMIT). Our migrations don't include
// explicit BEGIN/COMMIT because expo-sqlite wraps execAsync in an implicit
// savepoint on iOS/Android — failure rolls back. We separately record the
// migration id as `applied` ONLY after the DDL succeeds, so a partial
// apply won't be marked done.
async function applyOne(m: Migration): Promise<void> {
  await exec(m.sql);
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
