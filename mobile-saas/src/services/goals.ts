import { requireUserId } from "../lib/supabase";
import {
  newId,
  cloudDelete,
  sqliteList,
  sqliteGet,
  cloudUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type Goal = Tables<"goals">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listGoals(): Promise<Goal[]> {
  return sqliteList<Goal>("goals", { order: "created_at DESC" });
}

export async function createGoal(goal: {
  title: string;
  target_date?: string;
  status?: string;
}): Promise<Goal> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const row: Goal = {
    id: newId(),
    user_id: userId,
    title: goal.title,
    target_date: goal.target_date ?? null,
    status: goal.status ?? "active",
    created_at: now,
    updated_at: now,
  };
  return cloudUpsert("goals", row);
}

export async function deleteGoal(goalId: string): Promise<void> {
  await cloudDelete("goals", { id: goalId });
}

/**
 * Partial update — read-merge-write. M5 uses this from the Goals
 * screen to toggle between "active" and "completed". Future fields
 * (target_date, etc.) can ride the same path.
 */
export async function updateGoal(
  goalId: string,
  patch: Partial<Omit<Goal, "id" | "user_id" | "created_at">>,
): Promise<Goal> {
  const existing = await sqliteGet<Goal>("goals", { id: goalId });
  if (!existing) throw new Error("Goal not found");
  return cloudUpsert("goals", {
    ...existing,
    ...patch,
    updated_at: new Date().toISOString(),
  });
}
