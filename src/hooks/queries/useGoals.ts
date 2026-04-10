/**
 * Wave 0: Goals query hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  completeGoal,
  createGoal,
  deleteGoal,
  listActiveGoals,
  listGoals,
  updateGoal,
  type CreateGoalInput,
  type Goal,
} from "../../services/goals";

export const goalsKeys = {
  all: ["goals"] as const,
  list: () => ["goals", "list"] as const,
  active: () => ["goals", "active"] as const,
};

export function useGoals() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<Goal[]>({
    queryKey: goalsKeys.list(),
    queryFn: listGoals,
    enabled: Boolean(userId),
  });
}

export function useActiveGoals() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<Goal[]>({
    queryKey: goalsKeys.active(),
    queryFn: listActiveGoals,
    enabled: Boolean(userId),
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation<Goal, Error, CreateGoalInput>({
    mutationFn: createGoal,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: goalsKeys.all });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation<
    Goal,
    Error,
    { id: string; patch: Parameters<typeof updateGoal>[1] }
  >({
    mutationFn: ({ id, patch }) => updateGoal(id, patch),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: goalsKeys.all });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteGoal,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: goalsKeys.all });
    },
  });
}

export function useCompleteGoal() {
  const qc = useQueryClient();
  return useMutation<Goal, Error, string>({
    mutationFn: completeGoal,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: goalsKeys.all });
    },
  });
}
