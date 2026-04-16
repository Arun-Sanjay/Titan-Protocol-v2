/**
 * Phase 6: Cloud → MMKV bootstrap.
 *
 * On a fresh device (new install, user already has cloud data),
 * pulls Supabase rows back into MMKV for stores that still read
 * from local storage. Per-user, per-domain flags make it idempotent.
 *
 * Currently a stub — services will implement the actual pull once
 * they exist.
 */

import { getJSON, setJSON } from "../db/storage";

export async function bootstrapFromCloud(userId: string): Promise<void> {
  const key = `bootstrap_done_${userId}`;
  if (getJSON<boolean>(key, false)) return;

  // TODO: pull profile, tasks, habits, etc. from Supabase into MMKV
  // for stores that still read locally.

  setJSON(key, true);
}
