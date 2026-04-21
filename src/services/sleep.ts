import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteDelete,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type SleepLog = Tables<"sleep_logs">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listSleepLogs(): Promise<SleepLog[]> {
  return sqliteList<SleepLog>("sleep_logs", { order: "date_key DESC" });
}

export async function upsertSleepLog(log: {
  date_key: string;
  hours_slept?: number;
  quality?: number;
  notes?: string;
}): Promise<SleepLog> {
  const userId = await requireUserId();
  const [existing] = await sqliteList<SleepLog>("sleep_logs", {
    where: "date_key = ?",
    params: [log.date_key],
    limit: 1,
  });

  if (existing) {
    const merged: SleepLog = {
      ...existing,
      hours_slept: log.hours_slept ?? existing.hours_slept,
      quality: log.quality ?? existing.quality,
      notes: log.notes ?? existing.notes,
    };
    return sqliteUpsert("sleep_logs", merged);
  }

  const row: SleepLog = {
    id: newId(),
    user_id: userId,
    date_key: log.date_key,
    hours_slept: log.hours_slept ?? null,
    quality: log.quality ?? null,
    notes: log.notes ?? null,
    created_at: new Date().toISOString(),
  };
  return sqliteUpsert("sleep_logs", row);
}

export async function deleteSleepLog(logId: string): Promise<void> {
  await sqliteDelete("sleep_logs", { id: logId });
}
