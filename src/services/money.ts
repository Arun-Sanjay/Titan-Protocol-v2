import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteDelete,
  sqliteGet,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type MoneyTransaction = Tables<"money_transactions">;
export type MoneyLoan = Tables<"money_loans">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listTransactions(): Promise<MoneyTransaction[]> {
  return sqliteList<MoneyTransaction>("money_transactions", {
    order: "date_key DESC",
  });
}

export async function createTransaction(tx: {
  amount: number;
  category: string;
  type: string;
  date_key: string;
  note?: string;
}): Promise<MoneyTransaction> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const row: MoneyTransaction = {
    id: newId(),
    user_id: userId,
    amount: tx.amount,
    category: tx.category,
    type: tx.type,
    date_key: tx.date_key,
    note: tx.note ?? null,
    created_at: now,
  };
  return sqliteUpsert("money_transactions", row);
}

export async function deleteTransaction(txId: string): Promise<void> {
  await sqliteDelete("money_transactions", { id: txId });
}

// ─── Loans ─────────────────────────────────────────────────────────────────

export async function listLoans(): Promise<MoneyLoan[]> {
  return sqliteList<MoneyLoan>("money_loans", { order: "created_at DESC" });
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
  const now = new Date().toISOString();
  const row: MoneyLoan = {
    id: newId(),
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
    created_at: now,
  };
  return sqliteUpsert("money_loans", row);
}

export async function updateLoan(
  loanId: string,
  updates: Partial<Pick<MoneyLoan, "paid" | "status" | "amount" | "interest_rate" | "monthly_payment">>,
): Promise<MoneyLoan> {
  const existing = await sqliteGet<MoneyLoan>("money_loans", { id: loanId });
  if (!existing) throw new Error("Loan not found");
  const merged: MoneyLoan = { ...existing, ...updates };
  return sqliteUpsert("money_loans", merged);
}

export async function deleteLoan(loanId: string): Promise<void> {
  await sqliteDelete("money_loans", { id: loanId });
}
