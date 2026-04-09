/**
 * Phase 4: Sleep logs service.
 *
 * One row per (user, date_key). Quality is a 1-5 score (matches the
 * existing useSleepStore shape). Hours_slept is numeric so partial
 * hours are valid. Notes are free-text.
 *
 * The circular-mean bedtime, weekly trend, and grade computations
 * stay client-side — they're pure JS over a small array and shipping
 * the math to Postgres adds latency without much benefit.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "../types/supabase";

export type SleepLog = Tables<"sleep_logs">;

export async function listSleepLogs(rangeDays?: number): Promise<SleepLog[]> {
  let query = supabase
    .from("sleep_logs")
    .select("*")
    .order("date_key", { ascending: true });

  if (rangeDays && rangeDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    query = query.gte("date_key", cutoffKey);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export type UpsertSleepLogInput = {
  dateKey: string;
  hoursSlept?: number | null;
  quality?: number | null;
  notes?: string | null;
};

/**
 * One row per (user, date_key). We upsert on those two columns so the
 * UI can fire blindly without checking existence.
 */
export async function upsertSleepLog(input: UpsertSleepLogInput): Promise<SleepLog> {
  const userId = await requireUserId();
  const row: TablesInsert<"sleep_logs"> = {
    user_id: userId,
    date_key: input.dateKey,
    hours_slept: input.hoursSlept ?? null,
    quality: input.quality ?? null,
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase
    .from("sleep_logs")
    .upsert(row, { onConflict: "user_id,date_key" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type UpdateSleepLogInput = {
  id: string;
  patch: Pick<TablesUpdate<"sleep_logs">, "hours_slept" | "quality" | "notes">;
};

export async function updateSleepLog(input: UpdateSleepLogInput): Promise<SleepLog> {
  const { data, error } = await supabase
    .from("sleep_logs")
    .update(input.patch)
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSleepLog(id: string): Promise<void> {
  const { error } = await supabase.from("sleep_logs").delete().eq("id", id);
  if (error) throw error;
}
