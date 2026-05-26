import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listSleepLogs,
  upsertSleepLog,
  deleteSleepLog,
  type SleepLogWithSchedule,
} from "../../services/sleep";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const sleepKeys = {
  all: ["sleep_logs"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useSleepLogs() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: sleepKeys.all,
    queryFn: listSleepLogs,
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useUpsertSleepLog() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: upsertSleepLog,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: sleepKeys.all });
      const prev = qc.getQueryData<SleepLogWithSchedule[]>(sleepKeys.all);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(sleepKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: sleepKeys.all });
    },
  });
}

export function useDeleteSleepLog() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteSleepLog,
    onMutate: async (logId) => {
      await qc.cancelQueries({ queryKey: sleepKeys.all });
      const prev = qc.getQueryData<SleepLogWithSchedule[]>(sleepKeys.all);
      qc.setQueryData<SleepLogWithSchedule[]>(sleepKeys.all, (old) =>
        old?.filter((l) => l.id !== logId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _logId, ctx) => {
      if (ctx?.prev) qc.setQueryData(sleepKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: sleepKeys.all });
    },
  });
}
