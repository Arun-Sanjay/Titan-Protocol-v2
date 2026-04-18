import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteDelete,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type Budget = Tables<"budgets">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listBudgets(): Promise<Budget[]> {
  return sqliteList<Budget>("budgets", { order: "created_at ASC" });
}

export async function createBudget(budget: {
  category: string;
  monthly_limit: number;
}): Promise<Budget> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const row: Budget = {
    id: newId(),
    user_id: userId,
    category: budget.category,
    monthly_limit: budget.monthly_limit,
    created_at: now,
    updated_at: now,
  };
  return sqliteUpsert("budgets", row);
}

export async function deleteBudget(budgetId: string): Promise<void> {
  await sqliteDelete("budgets", { id: budgetId });
}
