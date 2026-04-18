import { requireUserId } from "../lib/supabase";
import {
  sqliteList,
  sqliteUpsert,
  sqliteUpsertMany,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type UserTitle = Tables<"user_titles">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listUserTitles(): Promise<UserTitle[]> {
  return sqliteList<UserTitle>("user_titles", { order: "unlocked_at DESC" });
}

export async function equipTitle(titleId: string): Promise<void> {
  await requireUserId();

  // Unequip all currently-equipped titles, then equip the target.
  // `sqliteUpsert` writes rows one at a time; walking the equipped set is
  // cheaper than loading every row because we only need to update the
  // ones that were actually flagged.
  const rows = await sqliteList<UserTitle>("user_titles");
  const toUpdate: UserTitle[] = [];
  let foundTarget = false;
  for (const row of rows) {
    if (row.title_id === titleId) {
      foundTarget = true;
      if (!row.equipped) toUpdate.push({ ...row, equipped: true });
    } else if (row.equipped) {
      toUpdate.push({ ...row, equipped: false });
    }
  }
  if (!foundTarget) return; // user doesn't own that title; no-op matches old behaviour
  if (toUpdate.length > 0) {
    await sqliteUpsertMany("user_titles", toUpdate);
  }
}

export async function unequipAllTitles(): Promise<void> {
  await requireUserId();
  const rows = await sqliteList<UserTitle>("user_titles", {
    where: "equipped = 1",
  });
  if (rows.length === 0) return;
  const updated = rows.map((r) => ({ ...r, equipped: false }));
  await sqliteUpsertMany("user_titles", updated);
}
