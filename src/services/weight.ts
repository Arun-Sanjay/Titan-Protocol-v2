import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteDelete,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type WeightLog = Tables<"weight_logs">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listWeightLogs(): Promise<WeightLog[]> {
  return sqliteList<WeightLog>("weight_logs", { order: "date_key DESC" });
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
  return sqliteUpsert("weight_logs", row);
}

export async function deleteWeightLog(logId: string): Promise<void> {
  await sqliteDelete("weight_logs", { id: logId });
}
