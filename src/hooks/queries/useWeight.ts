/**
 * Phase 4: Weight logs query hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  createWeightLog,
  deleteWeightLog,
  listWeightLogs,
  updateWeightLog,
  type CreateWeightLogInput,
  type UpdateWeightLogInput,
  type WeightLog,
} from "../../services/weight";

export const weightKeys = {
  all: ["weight"] as const,
  list: (rangeDays?: number) => (rangeDays ? (["weight", "list", rangeDays] as const) : (["weight", "list"] as const)),
};

export function useWeightLogs(rangeDays?: number) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<WeightLog[]>({
    queryKey: weightKeys.list(rangeDays),
    queryFn: () => listWeightLogs(rangeDays),
    enabled: Boolean(userId),
  });
}

export function useCreateWeightLog() {
  const qc = useQueryClient();
  return useMutation<WeightLog, Error, CreateWeightLogInput>({
    mutationFn: createWeightLog,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: weightKeys.all });
    },
  });
}

export function useUpdateWeightLog() {
  const qc = useQueryClient();
  return useMutation<WeightLog, Error, UpdateWeightLogInput>({
    mutationFn: updateWeightLog,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: weightKeys.all });
    },
  });
}

export function useDeleteWeightLog() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteWeightLog,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: weightKeys.all });
    },
  });
}
