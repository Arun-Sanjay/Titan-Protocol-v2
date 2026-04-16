import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listTransactions,
  createTransaction,
  deleteTransaction,
  listLoans,
  createLoan,
  updateLoan,
  deleteLoan,
  type MoneyTransaction,
  type MoneyLoan,
} from "../../services/money";

export const moneyKeys = {
  all: ["money_transactions"] as const,
  loans: ["money_loans"] as const,
};

// ─── Transactions ──────────────────────────────────────────────────────────

export function useTransactions() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: moneyKeys.all,
    queryFn: listTransactions,
    enabled: Boolean(userId),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTransaction,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: moneyKeys.all });
      const prev = qc.getQueryData<MoneyTransaction[]>(moneyKeys.all);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(moneyKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: moneyKeys.all });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTransaction,
    onMutate: async (txId) => {
      await qc.cancelQueries({ queryKey: moneyKeys.all });
      const prev = qc.getQueryData<MoneyTransaction[]>(moneyKeys.all);
      qc.setQueryData<MoneyTransaction[]>(moneyKeys.all, (old) =>
        old?.filter((t) => t.id !== txId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _txId, ctx) => {
      if (ctx?.prev) qc.setQueryData(moneyKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: moneyKeys.all });
    },
  });
}

// ─── Loans ─────────────────────────────────────────────────────────────────

export function useLoans() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: moneyKeys.loans,
    queryFn: listLoans,
    enabled: Boolean(userId),
  });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createLoan,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: moneyKeys.loans });
    },
  });
}

export function useUpdateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      loanId: string;
      updates: Partial<Pick<MoneyLoan, "paid" | "status" | "amount" | "interest_rate" | "monthly_payment">>;
    }) => updateLoan(vars.loanId, vars.updates),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: moneyKeys.loans });
    },
  });
}

export function useDeleteLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteLoan,
    onMutate: async (loanId) => {
      await qc.cancelQueries({ queryKey: moneyKeys.loans });
      const prev = qc.getQueryData<MoneyLoan[]>(moneyKeys.loans);
      qc.setQueryData<MoneyLoan[]>(moneyKeys.loans, (old) =>
        old?.filter((l) => l.id !== loanId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(moneyKeys.loans, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: moneyKeys.loans });
    },
  });
}
