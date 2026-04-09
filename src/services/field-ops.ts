/**
 * Phase 4: Field ops service.
 *
 * Two tables:
 *   - field_ops: active and historical multi-day field operations
 *   - field_op_cooldown: singleton per user; the timestamp until which
 *     they can't start a new op
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate, Json } from "../types/supabase";

export type FieldOp = Tables<"field_ops">;
export type FieldOpStatus = "active" | "completed" | "failed" | "abandoned";

export async function getActiveFieldOp(): Promise<FieldOp | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("field_ops")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
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

export type StartFieldOpInput = {
  fieldOpId: string;
};

export async function startFieldOp(input: StartFieldOpInput): Promise<FieldOp> {
  const userId = await requireUserId();
  const row: TablesInsert<"field_ops"> = {
    user_id: userId,
    field_op_id: input.fieldOpId,
    current_day: 0,
    day_results: [] as unknown as Json,
    status: "active",
  };
  const { data, error } = await supabase
    .from("field_ops")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type RecordFieldOpDayInput = {
  id: string;
  passed: boolean;
};

export async function recordFieldOpDay(
  input: RecordFieldOpDayInput,
): Promise<FieldOp> {
  // Read the current row to append to day_results.
  const { data: current, error: getError } = await supabase
    .from("field_ops")
    .select("*")
    .eq("id", input.id)
    .single();
  if (getError) throw getError;

  const dayResults = Array.isArray(current.day_results)
    ? [...(current.day_results as Array<unknown>), input.passed]
    : [input.passed];
  const currentDay = dayResults.length;

  const { data, error } = await supabase
    .from("field_ops")
    .update({ day_results: dayResults as never, current_day: currentDay })
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function resolveFieldOp(
  id: string,
  status: Exclude<FieldOpStatus, "active">,
): Promise<FieldOp> {
  const patch: TablesUpdate<"field_ops"> = {
    status,
    completed_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("field_ops")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Cooldown ───────────────────────────────────────────────────────────────

export type FieldOpCooldown = Tables<"field_op_cooldown">;

export async function getCooldown(): Promise<FieldOpCooldown | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("field_op_cooldown")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setCooldown(
  cooldownUntil: string | null,
): Promise<FieldOpCooldown> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("field_op_cooldown")
    .upsert(
      {
        user_id: userId,
        cooldown_until: cooldownUntil,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
