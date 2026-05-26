import { requireUserId } from "../lib/supabase";
import { sqliteGet } from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type TitanModeState = Tables<"titan_mode_state">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function getTitanModeState(): Promise<TitanModeState | null> {
  const userId = await requireUserId();
  return sqliteGet<TitanModeState>("titan_mode_state", { user_id: userId });
}
