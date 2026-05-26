import { requireUserId } from "../lib/supabase";
import {
  newId,
  cloudDelete,
  sqliteList,
  cloudUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type WeightLog = Tables<"weight_logs">;

// ─── Service Functions ─────────────────────────────────────────────────────

/**
 * Returns weight logs in chronological order (oldest first → newest last).
 *
 * UI consumers (`hub/weight.tsx` for current weight + trend, and
 * `hub/nutrition.tsx` for the weight-sync prompt) read the LAST element
 * as "latest". The previous DESC order matched the literal column name
 * but inverted that meaning, so e.g. logging 80 kg yesterday and 79 kg
 * today made every screen think the user was at 80 kg.
 */
export async function listWeightLogs(): Promise<WeightLog[]> {
  return sqliteList<WeightLog>("weight_logs", { order: "date_key ASC" });
}

export async function createWeightLog(log: {
  date_key: string;
  weight_kg: number;
  notes?: string;
}): Promise<WeightLog> {
  const userId = await requireUserId();
  const row: WeightLog = {
    id: newId(),
    user_id: userId,
    date_key: log.date_key,
    weight_kg: log.weight_kg,
    notes: log.notes ?? null,
    created_at: new Date().toISOString(),
  };
  return cloudUpsert("weight_logs", row);
}

export async function deleteWeightLog(logId: string): Promise<void> {
  await cloudDelete("weight_logs", { id: logId });
}
