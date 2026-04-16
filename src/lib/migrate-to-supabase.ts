/**
 * Phase 3.5b: One-time MMKV → Supabase migration.
 *
 * Runs once per user on first launch after the Supabase migration.
 * Copies local MMKV data into Supabase tables, then sets a flag
 * so it doesn't re-run.
 *
 * Currently a stub — returns immediately since this is a fresh
 * Supabase-first install with no legacy data to migrate.
 */

import { getJSON, setJSON } from "../db/storage";

export type MigrationStatus = {
  label: string;
  completedSteps: number;
  totalSteps: number;
};

/**
 * Run the migration if it hasn't been run yet.
 * Returns true if a real migration ran, false if skipped.
 */
export async function maybeRunMigration(
  onProgress?: (status: MigrationStatus) => void,
): Promise<boolean> {
  const migrated = getJSON<boolean>("migration_v1_complete", false);
  if (migrated) return false;

  // No legacy data in a fresh install — mark as done
  onProgress?.({
    label: "Checking for legacy data…",
    completedSteps: 1,
    totalSteps: 1,
  });

  setJSON("migration_v1_complete", true);
  return false;
}
