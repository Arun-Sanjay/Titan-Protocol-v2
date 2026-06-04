import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/session";
import {
  listSleepLogs,
  upsertSleepLog,
  deleteSleepLog,
  type SleepLog,
} from "../../services/sleep";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const sleepKeys = {
  all: ["sleep_logs"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useSleepLogs() {
  const userId = useCurrentUserId();
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
      const prev = qc.getQueryData<SleepLog[]>(sleepKeys.all);
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
      const prev = qc.getQueryData<SleepLog[]>(sleepKeys.all);
      qc.setQueryData<SleepLog[]>(sleepKeys.all, (old) =>
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
