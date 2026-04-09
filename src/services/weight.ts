/**
 * Phase 4: Weight logs service.
 *
 * Flat date-keyed entries. The trend math (moving average, ETA to
 * goal, weekly rate) lives client-side because it's pure JS over a
 * small array — no need for a Postgres view.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "../types/supabase";

export type WeightLog = Tables<"weight_logs">;

export async function listWeightLogs(rangeDays?: number): Promise<WeightLog[]> {
  let query = supabase
    .from("weight_logs")
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

export type CreateWeightLogInput = {
  dateKey: string;
  weightKg: number;
  notes?: string;
};

export async function createWeightLog(input: CreateWeightLogInput): Promise<WeightLog> {
  const userId = await requireUserId();
  const row: TablesInsert<"weight_logs"> = {
    user_id: userId,
    date_key: input.dateKey,
    weight_kg: input.weightKg,
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase
    .from("weight_logs")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type UpdateWeightLogInput = {
  id: string;
  patch: Pick<TablesUpdate<"weight_logs">, "weight_kg" | "notes">;
};

export async function updateWeightLog(input: UpdateWeightLogInput): Promise<WeightLog> {
  const { data, error } = await supabase
    .from("weight_logs")
    .update(input.patch)
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWeightLog(id: string): Promise<void> {
  const { error } = await supabase.from("weight_logs").delete().eq("id", id);
  if (error) throw error;
}
