import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listTransactions,
  createTransaction,
  deleteTransaction,
  type MoneyTransaction,
} from "../../services/money";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const moneyKeys = {
  all: ["money_transactions"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useTransactions() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: moneyKeys.all,
    queryFn: listTransactions,
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

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
