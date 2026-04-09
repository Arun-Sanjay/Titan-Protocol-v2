/**
 * Phase 4: Sleep logs query hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  deleteSleepLog,
  listSleepLogs,
  updateSleepLog,
  upsertSleepLog,
  type SleepLog,
  type UpdateSleepLogInput,
  type UpsertSleepLogInput,
} from "../../services/sleep";

export const sleepKeys = {
  all: ["sleep"] as const,
  list: (rangeDays?: number) =>
    rangeDays ? (["sleep", "list", rangeDays] as const) : (["sleep", "list"] as const),
};

export function useSleepLogs(rangeDays?: number) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<SleepLog[]>({
    queryKey: sleepKeys.list(rangeDays),
    queryFn: () => listSleepLogs(rangeDays),
    enabled: Boolean(userId),
  });
}

export function useUpsertSleepLog() {
  const qc = useQueryClient();
  return useMutation<SleepLog, Error, UpsertSleepLogInput>({
    mutationFn: upsertSleepLog,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: sleepKeys.all });
    },
  });
}

export function useUpdateSleepLog() {
  const qc = useQueryClient();
  return useMutation<SleepLog, Error, UpdateSleepLogInput>({
    mutationFn: updateSleepLog,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: sleepKeys.all });
    },
  });
}

export function useDeleteSleepLog() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteSleepLog,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: sleepKeys.all });
    },
  });
}
