import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type Budget = Tables<"budgets">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createBudget(budget: {
  category: string;
  monthly_limit: number;
}): Promise<Budget> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("budgets")
    .insert({
      user_id: userId,
      category: budget.category,
      monthly_limit: budget.monthly_limit,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBudget(budgetId: string): Promise<void> {
  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", budgetId);
  if (error) throw error;
}
