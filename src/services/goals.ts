import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteDelete,
  sqliteList,
  sqliteUpsert,
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
  return sqliteUpsert("goals", row);
}

export async function deleteGoal(goalId: string): Promise<void> {
  await sqliteDelete("goals", { id: goalId });
}
