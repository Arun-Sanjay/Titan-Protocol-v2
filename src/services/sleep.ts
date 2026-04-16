import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type SleepLog = Tables<"sleep_logs">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listSleepLogs(): Promise<SleepLog[]> {
  const { data, error } = await supabase
    .from("sleep_logs")
    .select("*")
    .order("date_key", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertSleepLog(log: {
  date_key: string;
  hours_slept?: number;
  quality?: number;
  notes?: string;
}): Promise<SleepLog> {
  const userId = await requireUserId();

  const { data: existing } = await supabase
    .from("sleep_logs")
    .select("id")
    .eq("date_key", log.date_key)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("sleep_logs")
      .update({
        hours_slept: log.hours_slept,
        quality: log.quality,
        notes: log.notes,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from("sleep_logs")
      .insert({
        user_id: userId,
        date_key: log.date_key,
        hours_slept: log.hours_slept ?? null,
        quality: log.quality ?? null,
        notes: log.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function deleteSleepLog(logId: string): Promise<void> {
  const { error } = await supabase.from("sleep_logs").delete().eq("id", logId);
  if (error) throw error;
}
