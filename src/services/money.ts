import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type MoneyTransaction = Tables<"money_transactions">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listTransactions(): Promise<MoneyTransaction[]> {
  const { data, error } = await supabase
    .from("money_transactions")
    .select("*")
    .order("date_key", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createTransaction(tx: {
  amount: number;
  category: string;
  type: string;
  date_key: string;
  note?: string;
}): Promise<MoneyTransaction> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("money_transactions")
    .insert({
      user_id: userId,
      amount: tx.amount,
      category: tx.category,
      type: tx.type,
      date_key: tx.date_key,
      note: tx.note ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(txId: string): Promise<void> {
  const { error } = await supabase
    .from("money_transactions")
    .delete()
    .eq("id", txId);
  if (error) throw error;
}
