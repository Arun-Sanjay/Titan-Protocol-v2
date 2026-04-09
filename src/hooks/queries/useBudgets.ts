/**
 * Phase 4: Budgets query hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  createBudget,
  deleteBudget,
  listBudgets,
  updateBudget,
  type Budget,
  type CreateBudgetInput,
  type UpdateBudgetInput,
} from "../../services/budgets";

export const budgetsKeys = {
  all: ["budgets"] as const,
  list: () => ["budgets", "list"] as const,
};

export function useBudgets() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<Budget[]>({
    queryKey: budgetsKeys.list(),
    queryFn: listBudgets,
    enabled: Boolean(userId),
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation<Budget, Error, CreateBudgetInput, { previous: Budget[] | undefined }>({
    mutationFn: createBudget,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: budgetsKeys.list() });
      const previous = qc.getQueryData<Budget[]>(budgetsKeys.list());
      const optimistic: Budget = {
        id: `optimistic-${Date.now()}`,
        user_id: "",
        category: input.category,
        monthly_limit: input.monthlyLimit,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      qc.setQueryData<Budget[]>(budgetsKeys.list(), (prev) => [...(prev ?? []), optimistic]);
      return { previous };
    },
    onError: (_e, _i, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(budgetsKeys.list(), ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: budgetsKeys.list() });
    },
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation<Budget, Error, UpdateBudgetInput, { previous: Budget[] | undefined }>({
    mutationFn: updateBudget,
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: budgetsKeys.list() });
      const previous = qc.getQueryData<Budget[]>(budgetsKeys.list());
      qc.setQueryData<Budget[]>(budgetsKeys.list(), (prev) =>
        prev?.map((b) => (b.id === id ? { ...b, ...patch, updated_at: new Date().toISOString() } : b)),
      );
      return { previous };
    },
    onError: (_e, _i, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(budgetsKeys.list(), ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: budgetsKeys.list() });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation<void, Error, string, { previous: Budget[] | undefined }>({
    mutationFn: deleteBudget,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: budgetsKeys.list() });
      const previous = qc.getQueryData<Budget[]>(budgetsKeys.list());
      qc.setQueryData<Budget[]>(budgetsKeys.list(), (prev) => prev?.filter((b) => b.id !== id));
      return { previous };
    },
    onError: (_e, _i, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(budgetsKeys.list(), ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: budgetsKeys.list() });
    },
  });
}
