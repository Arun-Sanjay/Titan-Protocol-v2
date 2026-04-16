import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listGoals,
  createGoal,
  deleteGoal,
  type Goal,
} from "../../services/goals";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const goalsKeys = {
  all: ["goals"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useGoals() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: goalsKeys.all,
    queryFn: listGoals,
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Screens pass camelCase: { title, targetDate?, status? }
 * Service expects snake_case: { target_date }
 */
export function useCreateGoal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      title: string;
      targetDate?: string;
      status?: string;
    }) => {
      return createGoal({
        title: vars.title,
        target_date: vars.targetDate,
        status: vars.status,
      });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: goalsKeys.all });
      const prev = qc.getQueryData<Goal[]>(goalsKeys.all);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(goalsKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: goalsKeys.all });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteGoal,
    onMutate: async (goalId) => {
      await qc.cancelQueries({ queryKey: goalsKeys.all });
      const prev = qc.getQueryData<Goal[]>(goalsKeys.all);
      qc.setQueryData<Goal[]>(goalsKeys.all, (old) =>
        old?.filter((g) => g.id !== goalId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _goalId, ctx) => {
      if (ctx?.prev) qc.setQueryData(goalsKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: goalsKeys.all });
    },
  });
}
