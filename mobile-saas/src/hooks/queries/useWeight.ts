import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listWeightLogs,
  createWeightLog,
  deleteWeightLog,
  type WeightLog,
} from "../../services/weight";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const weightKeys = {
  all: ["weight_logs"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useWeightLogs() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: weightKeys.all,
    queryFn: listWeightLogs,
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateWeightLog() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createWeightLog,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: weightKeys.all });
      const prev = qc.getQueryData<WeightLog[]>(weightKeys.all);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(weightKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: weightKeys.all });
    },
  });
}

export function useDeleteWeightLog() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteWeightLog,
    onMutate: async (logId) => {
      await qc.cancelQueries({ queryKey: weightKeys.all });
      const prev = qc.getQueryData<WeightLog[]>(weightKeys.all);
      qc.setQueryData<WeightLog[]>(weightKeys.all, (old) =>
        old?.filter((l) => l.id !== logId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _logId, ctx) => {
      if (ctx?.prev) qc.setQueryData(weightKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: weightKeys.all });
    },
  });
}
