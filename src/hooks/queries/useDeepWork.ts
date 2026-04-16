import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listDeepWorkSessions,
  createDeepWorkSession,
  deleteDeepWorkSession,
  type DeepWorkSession,
} from "../../services/deep-work";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const deepWorkKeys = {
  all: ["deep_work_sessions"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useDeepWorkSessions() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: deepWorkKeys.all,
    queryFn: listDeepWorkSessions,
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateDeepWorkSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createDeepWorkSession,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: deepWorkKeys.all });
      const prev = qc.getQueryData<DeepWorkSession[]>(deepWorkKeys.all);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(deepWorkKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: deepWorkKeys.all });
    },
  });
}

export function useDeleteDeepWorkSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteDeepWorkSession,
    onMutate: async (sessionId) => {
      await qc.cancelQueries({ queryKey: deepWorkKeys.all });
      const prev = qc.getQueryData<DeepWorkSession[]>(deepWorkKeys.all);
      qc.setQueryData<DeepWorkSession[]>(deepWorkKeys.all, (old) =>
        old?.filter((s) => s.id !== sessionId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _sessionId, ctx) => {
      if (ctx?.prev) qc.setQueryData(deepWorkKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: deepWorkKeys.all });
    },
  });
}
