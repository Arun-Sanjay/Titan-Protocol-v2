import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";
import type { Json } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type FieldOp = Tables<"field_ops">;
export type FieldOpCooldown = Tables<"field_op_cooldown">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function getActiveFieldOp(): Promise<FieldOp | null> {
  const { data, error } = await supabase
    .from("field_ops")
    .select("*")
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listFieldOpHistory(): Promise<FieldOp[]> {
  const { data, error } = await supabase
    .from("field_ops")
    .select("*")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getFieldOpCooldown(): Promise<FieldOpCooldown | null> {
  const { data, error } = await supabase
    .from("field_op_cooldown")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function startFieldOp(params: {
  fieldOpId: string;
}): Promise<FieldOp> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("field_ops")
    .insert({
      user_id: userId,
      field_op_id: params.fieldOpId,
      status: "active",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function resolveFieldOp(params: {
  id: string;
  status: "completed" | "failed" | "abandoned";
  dayResults?: Json;
}): Promise<void> {
  const { error } = await supabase
    .from("field_ops")
    .update({
      status: params.status,
      completed_at: new Date().toISOString(),
      day_results: params.dayResults ?? {},
    })
    .eq("id", params.id);
  if (error) throw error;
}
