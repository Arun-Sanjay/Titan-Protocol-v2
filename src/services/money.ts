import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type MoneyTransaction = Tables<"money_transactions">;
export type MoneyLoan = Tables<"money_loans">;

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

// ─── Loans ─────────────────────────────────────────────────────────────────

export async function listLoans(): Promise<MoneyLoan[]> {
  const { data, error } = await supabase
    .from("money_loans")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createLoan(loan: {
  lender: string;
  amount: number;
  date_iso: string;
  due_iso?: string | null;
  name?: string;
  interest_rate?: number;
  monthly_payment?: number;
  start_date?: string;
}): Promise<MoneyLoan> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("money_loans")
    .insert({
      user_id: userId,
      lender: loan.lender,
      amount: loan.amount,
      paid: 0,
      date_iso: loan.date_iso,
      due_iso: loan.due_iso ?? null,
      status: "unpaid",
      name: loan.name ?? null,
      interest_rate: loan.interest_rate ?? null,
      monthly_payment: loan.monthly_payment ?? null,
      start_date: loan.start_date ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLoan(
  loanId: string,
  updates: Partial<Pick<MoneyLoan, "paid" | "status" | "amount" | "interest_rate" | "monthly_payment">>,
): Promise<MoneyLoan> {
  const { data, error } = await supabase
    .from("money_loans")
    .update(updates)
    .eq("id", loanId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLoan(loanId: string): Promise<void> {
  const { error } = await supabase
    .from("money_loans")
    .delete()
    .eq("id", loanId);
  if (error) throw error;
}
