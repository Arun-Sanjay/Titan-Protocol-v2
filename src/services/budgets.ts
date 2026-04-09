/**
 * Phase 4: Budgets service.
 *
 * One row per (user, category) with a monthly spending limit. The
 * client computes the current month's spend by joining against
 * money_transactions client-side; no server view needed at this scale.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "../types/supabase";

export type Budget = Tables<"budgets">;

export async function listBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .order("category", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type CreateBudgetInput = {
  category: string;
  monthlyLimit: number;
};

export async function createBudget(input: CreateBudgetInput): Promise<Budget> {
  const userId = await requireUserId();
  const row: TablesInsert<"budgets"> = {
    user_id: userId,
    category: input.category,
    monthly_limit: input.monthlyLimit,
  };
  const { data, error } = await supabase
    .from("budgets")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type UpdateBudgetInput = {
  id: string;
  patch: Pick<TablesUpdate<"budgets">, "category" | "monthly_limit">;
};

export async function updateBudget(input: UpdateBudgetInput): Promise<Budget> {
  const { data, error } = await supabase
    .from("budgets")
    .update(input.patch)
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBudget(budgetId: string): Promise<void> {
  const { error } = await supabase.from("budgets").delete().eq("id", budgetId);
  if (error) throw error;
}
