import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listDeepWorkSessions,
  createDeepWorkSession,
  deleteDeepWorkSession,
  listDeepWorkTasks,
  createDeepWorkTask,
  deleteDeepWorkTask,
  listDeepWorkLogs,
  upsertDeepWorkLog,
  type DeepWorkSession,
  type DeepWorkTask,
  type DeepWorkLog,
} from "../../services/deep-work";

export const deepWorkKeys = {
  sessions: ["deep_work_sessions"] as const,
  tasks: ["deep_work_tasks"] as const,
  logs: ["deep_work_logs"] as const,
};

// ─── Sessions ──────────────────────────────────────────────────────────────

export function useDeepWorkSessions() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: deepWorkKeys.sessions,
    queryFn: listDeepWorkSessions,
    enabled: Boolean(userId),
  });
}

export function useCreateDeepWorkSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDeepWorkSession,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: deepWorkKeys.sessions });
      const prev = qc.getQueryData<DeepWorkSession[]>(deepWorkKeys.sessions);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(deepWorkKeys.sessions, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: deepWorkKeys.sessions });
    },
  });
}

export function useDeleteDeepWorkSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDeepWorkSession,
    onMutate: async (sessionId) => {
      await qc.cancelQueries({ queryKey: deepWorkKeys.sessions });
      const prev = qc.getQueryData<DeepWorkSession[]>(deepWorkKeys.sessions);
      qc.setQueryData<DeepWorkSession[]>(deepWorkKeys.sessions, (old) =>
        old?.filter((s) => s.id !== sessionId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(deepWorkKeys.sessions, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: deepWorkKeys.sessions });
    },
  });
}

// ─── Tasks ─────────────────────────────────────────────────────────────────

export function useDeepWorkTasks() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: deepWorkKeys.tasks,
    queryFn: listDeepWorkTasks,
    enabled: Boolean(userId),
  });
}

export function useCreateDeepWorkTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDeepWorkTask,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: deepWorkKeys.tasks });
    },
  });
}

export function useDeleteDeepWorkTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDeepWorkTask,
    onMutate: async (taskId) => {
      await qc.cancelQueries({ queryKey: deepWorkKeys.tasks });
      const prev = qc.getQueryData<DeepWorkTask[]>(deepWorkKeys.tasks);
      qc.setQueryData<DeepWorkTask[]>(deepWorkKeys.tasks, (old) =>
        old?.filter((t) => t.id !== taskId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(deepWorkKeys.tasks, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: deepWorkKeys.tasks });
      qc.invalidateQueries({ queryKey: deepWorkKeys.logs });
    },
  });
}

// ─── Logs ──────────────────────────────────────────────────────────────────

export function useDeepWorkLogs() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: deepWorkKeys.logs,
    queryFn: listDeepWorkLogs,
    enabled: Boolean(userId),
  });
}

export function useUpsertDeepWorkLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertDeepWorkLog,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: deepWorkKeys.logs });
    },
  });
}
