/**
 * Phase 4: Deep work query hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  createDeepWorkSession,
  deleteDeepWorkSession,
  listDeepWorkSessions,
  updateDeepWorkSession,
  type CreateDeepWorkInput,
  type DeepWorkSession,
  type UpdateDeepWorkInput,
} from "../../services/deep-work";

export const deepWorkKeys = {
  all: ["deep_work"] as const,
  list: (rangeDays?: number) =>
    rangeDays ? (["deep_work", "list", rangeDays] as const) : (["deep_work", "list"] as const),
};

export function useDeepWorkSessions(rangeDays?: number) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<DeepWorkSession[]>({
    queryKey: deepWorkKeys.list(rangeDays),
    queryFn: () => listDeepWorkSessions(rangeDays),
    enabled: Boolean(userId),
  });
}

export function useCreateDeepWorkSession() {
  const qc = useQueryClient();
  return useMutation<DeepWorkSession, Error, CreateDeepWorkInput>({
    mutationFn: createDeepWorkSession,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: deepWorkKeys.all });
    },
  });
}

export function useUpdateDeepWorkSession() {
  const qc = useQueryClient();
  return useMutation<DeepWorkSession, Error, UpdateDeepWorkInput>({
    mutationFn: updateDeepWorkSession,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: deepWorkKeys.all });
    },
  });
}

export function useDeleteDeepWorkSession() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteDeepWorkSession,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: deepWorkKeys.all });
    },
  });
}
