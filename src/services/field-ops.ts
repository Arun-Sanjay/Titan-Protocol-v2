import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteGet,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";
import type { Json } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type FieldOp = Tables<"field_ops">;
export type FieldOpCooldown = Tables<"field_op_cooldown">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function getActiveFieldOp(): Promise<FieldOp | null> {
  const [row] = await sqliteList<FieldOp>("field_ops", {
    where: "status = ?",
    params: ["active"],
    order: "started_at DESC",
    limit: 1,
  });
  return row ?? null;
}

export async function listFieldOpHistory(): Promise<FieldOp[]> {
  return sqliteList<FieldOp>("field_ops", { order: "started_at DESC" });
}

export async function getFieldOpCooldown(): Promise<FieldOpCooldown | null> {
  const userId = await requireUserId();
  return sqliteGet<FieldOpCooldown>("field_op_cooldown", { user_id: userId });
}

export async function startFieldOp(params: {
  fieldOpId: string;
}): Promise<FieldOp> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const row: FieldOp = {
    id: newId(),
    user_id: userId,
    field_op_id: params.fieldOpId,
    status: "active",
    current_day: 0,
    day_results: {} as Json,
    started_at: now,
    completed_at: null,
  };
  return sqliteUpsert("field_ops", row);
}

export async function resolveFieldOp(params: {
  id: string;
  status: "completed" | "failed" | "abandoned";
  dayResults?: Json;
}): Promise<void> {
  const existing = await sqliteGet<FieldOp>("field_ops", { id: params.id });
  if (!existing) throw new Error("Field op not found");
  const merged: FieldOp = {
    ...existing,
    status: params.status,
    completed_at: new Date().toISOString(),
    day_results: params.dayResults ?? ({} as Json),
  };
  await sqliteUpsert("field_ops", merged);
}
