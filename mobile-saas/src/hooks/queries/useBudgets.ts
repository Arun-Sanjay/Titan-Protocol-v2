import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listBudgets,
  createBudget,
  deleteBudget,
  type Budget,
} from "../../services/budgets";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const budgetsKeys = {
  all: ["budgets"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useBudgets() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: budgetsKeys.all,
    queryFn: listBudgets,
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateBudget() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createBudget,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: budgetsKeys.all });
      const prev = qc.getQueryData<Budget[]>(budgetsKeys.all);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(budgetsKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: budgetsKeys.all });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteBudget,
    onMutate: async (budgetId) => {
      await qc.cancelQueries({ queryKey: budgetsKeys.all });
      const prev = qc.getQueryData<Budget[]>(budgetsKeys.all);
      qc.setQueryData<Budget[]>(budgetsKeys.all, (old) =>
        old?.filter((b) => b.id !== budgetId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _budgetId, ctx) => {
      if (ctx?.prev) qc.setQueryData(budgetsKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: budgetsKeys.all });
    },
  });
}
