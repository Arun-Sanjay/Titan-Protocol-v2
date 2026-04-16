import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type WeightLog = Tables<"weight_logs">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listWeightLogs(): Promise<WeightLog[]> {
  const { data, error } = await supabase
    .from("weight_logs")
    .select("*")
    .order("date_key", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createWeightLog(log: {
  date_key: string;
  weight_kg: number;
  notes?: string;
}): Promise<WeightLog> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("weight_logs")
    .insert({
      user_id: userId,
      date_key: log.date_key,
      weight_kg: log.weight_kg,
      notes: log.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWeightLog(logId: string): Promise<void> {
  const { error } = await supabase
    .from("weight_logs")
    .delete()
    .eq("id", logId);
  if (error) throw error;
}
