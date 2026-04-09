/**
 * Phase 4: Money transactions query hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
  type CreateTransactionInput,
  type MoneyTransaction,
  type UpdateTransactionInput,
} from "../../services/money";

export const moneyKeys = {
  all: ["money"] as const,
  list: (start?: string, end?: string) =>
    ["money", "list", start ?? null, end ?? null] as const,
};

export function useTransactions(opts: { startDateKey?: string; endDateKey?: string } = {}) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<MoneyTransaction[]>({
    queryKey: moneyKeys.list(opts.startDateKey, opts.endDateKey),
    queryFn: () => listTransactions(opts),
    enabled: Boolean(userId),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation<MoneyTransaction, Error, CreateTransactionInput>({
    mutationFn: createTransaction,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: moneyKeys.all });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation<MoneyTransaction, Error, UpdateTransactionInput>({
    mutationFn: updateTransaction,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: moneyKeys.all });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteTransaction,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: moneyKeys.all });
    },
  });
}
