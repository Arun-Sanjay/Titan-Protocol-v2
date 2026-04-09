/**
 * Phase 4: Money transactions service.
 *
 * Flat date-keyed list of income/expense entries. Per-month rollups
 * happen client-side.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "../types/supabase";

export type MoneyTransaction = Tables<"money_transactions">;
export type MoneyTransactionType = "income" | "expense";

/**
 * List transactions in a date range. Pass start/end as YYYY-MM-DD.
 * Without args, returns the last 90 days.
 */
export async function listTransactions(opts: {
  startDateKey?: string;
  endDateKey?: string;
} = {}): Promise<MoneyTransaction[]> {
  let query = supabase
    .from("money_transactions")
    .select("*")
    .order("date_key", { ascending: false })
    .order("created_at", { ascending: false });

  if (opts.startDateKey) query = query.gte("date_key", opts.startDateKey);
  if (opts.endDateKey) query = query.lte("date_key", opts.endDateKey);

  if (!opts.startDateKey && !opts.endDateKey) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    query = query.gte("date_key", cutoff.toISOString().slice(0, 10));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export type CreateTransactionInput = {
  dateKey: string;
  amount: number;
  category: string;
  type: MoneyTransactionType;
  note?: string;
};

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<MoneyTransaction> {
  const userId = await requireUserId();
  const row: TablesInsert<"money_transactions"> = {
    user_id: userId,
    date_key: input.dateKey,
    amount: input.amount,
    category: input.category,
    type: input.type,
    note: input.note ?? null,
  };
  const { data, error } = await supabase
    .from("money_transactions")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type UpdateTransactionInput = {
  id: string;
  patch: Pick<TablesUpdate<"money_transactions">, "amount" | "category" | "type" | "note" | "date_key">;
};

export async function updateTransaction(
  input: UpdateTransactionInput,
): Promise<MoneyTransaction> {
  const { data, error } = await supabase
    .from("money_transactions")
    .update(input.patch)
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from("money_transactions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
