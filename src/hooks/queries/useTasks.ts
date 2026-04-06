/**
 * Phase 3.3c: Task + completion query hooks.
 *
 * Typed React Query wrappers around src/services/tasks.ts. Each query
 * key is deterministic per (engine, dateKey) so mutations can
 * invalidate surgically without blowing the entire cache.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  createTask,
  deleteTask,
  listAllCompletionsForDate,
  listAllTasks,
  listCompletions,
  listTasks,
  toggleCompletion,
  type CreateTaskInput,
  type EngineKey,
  type Task,
  type Completion,
} from "../../services/tasks";

// ─── Query keys ─────────────────────────────────────────────────────────────

export const tasksKeys = {
  all: ["tasks"] as const,
  byEngine: (engine: EngineKey) => ["tasks", engine] as const,
  allEngines: () => ["tasks", "all"] as const,
  completionsByEngineDate: (engine: EngineKey, dateKey: string) =>
    ["completions", engine, dateKey] as const,
  completionsByDate: (dateKey: string) =>
    ["completions", "all", dateKey] as const,
};

// ─── Reads ──────────────────────────────────────────────────────────────────

export function useEngineTasks(engine: EngineKey) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<Task[]>({
    queryKey: tasksKeys.byEngine(engine),
    queryFn: () => listTasks(engine),
    enabled: Boolean(userId),
  });
}

export function useAllTasks() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<Task[]>({
    queryKey: tasksKeys.allEngines(),
    queryFn: listAllTasks,
    enabled: Boolean(userId),
  });
}

export function useEngineCompletions(engine: EngineKey, dateKey: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<Completion[]>({
    queryKey: tasksKeys.completionsByEngineDate(engine, dateKey),
    queryFn: () => listCompletions(engine, dateKey),
    enabled: Boolean(userId),
  });
}

export function useAllCompletionsForDate(dateKey: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<Completion[]>({
    queryKey: tasksKeys.completionsByDate(dateKey),
    queryFn: () => listAllCompletionsForDate(dateKey),
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, CreateTaskInput>({
    mutationFn: createTask,
    onSuccess: (task) => {
      // Invalidate both the per-engine list and the all-engines list
      // so every subscriber refetches.
      queryClient.invalidateQueries({
        queryKey: tasksKeys.byEngine(task.engine),
      });
      queryClient.invalidateQueries({ queryKey: tasksKeys.allEngines() });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { taskId: string; engine: EngineKey }>({
    mutationFn: ({ taskId }) => deleteTask(taskId),
    onSuccess: (_data, { engine }) => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.byEngine(engine) });
      queryClient.invalidateQueries({ queryKey: tasksKeys.allEngines() });
    },
  });
}

type ToggleVars = {
  task: Pick<Task, "id" | "engine">;
  dateKey: string;
};

/**
 * Toggle a completion with optimistic update. The UI flips immediately
 * on tap; if the server rejects, we roll back. This is what makes the
 * task list feel instant even on slow networks.
 */
export function useToggleCompletion() {
  const queryClient = useQueryClient();

  return useMutation<
    { completed: boolean },
    Error,
    ToggleVars,
    { previousCompletions: Completion[] | undefined; previousAllCompletions: Completion[] | undefined }
  >({
    mutationFn: ({ task, dateKey }) => toggleCompletion(task, dateKey),
    onMutate: async ({ task, dateKey }) => {
      // Cancel any outgoing refetches so they don't overwrite our
      // optimistic update.
      await queryClient.cancelQueries({
        queryKey: tasksKeys.completionsByEngineDate(task.engine, dateKey),
      });
      await queryClient.cancelQueries({
        queryKey: tasksKeys.completionsByDate(dateKey),
      });

      // Snapshot the previous values for rollback.
      const previousCompletions = queryClient.getQueryData<Completion[]>(
        tasksKeys.completionsByEngineDate(task.engine, dateKey),
      );
      const previousAllCompletions = queryClient.getQueryData<Completion[]>(
        tasksKeys.completionsByDate(dateKey),
      );

      // Derive the next state: if the task is currently in the list,
      // remove it; otherwise add it.
      const isCompleted = previousCompletions?.some((c) => c.task_id === task.id) ?? false;

      const applyToggle = (list: Completion[] | undefined): Completion[] => {
        if (!list) return list ?? [];
        if (isCompleted) {
          return list.filter((c) => c.task_id !== task.id);
        }
        // Synthesize a placeholder row. The real id/created_at come back
        // on success and onSettled invalidates anyway.
        return [
          ...list,
          {
            id: `optimistic-${task.id}-${dateKey}`,
            user_id: "",
            task_id: task.id,
            engine: task.engine,
            date_key: dateKey,
            created_at: new Date().toISOString(),
          },
        ];
      };

      queryClient.setQueryData<Completion[]>(
        tasksKeys.completionsByEngineDate(task.engine, dateKey),
        applyToggle,
      );
      queryClient.setQueryData<Completion[]>(
        tasksKeys.completionsByDate(dateKey),
        applyToggle,
      );

      return { previousCompletions, previousAllCompletions };
    },
    onError: (_err, { task, dateKey }, context) => {
      // Roll back on error.
      if (context?.previousCompletions !== undefined) {
        queryClient.setQueryData(
          tasksKeys.completionsByEngineDate(task.engine, dateKey),
          context.previousCompletions,
        );
      }
      if (context?.previousAllCompletions !== undefined) {
        queryClient.setQueryData(
          tasksKeys.completionsByDate(dateKey),
          context.previousAllCompletions,
        );
      }
    },
    onSettled: (_data, _err, { task, dateKey }) => {
      // Always refetch on settle so the cache matches the server.
      queryClient.invalidateQueries({
        queryKey: tasksKeys.completionsByEngineDate(task.engine, dateKey),
      });
      queryClient.invalidateQueries({
        queryKey: tasksKeys.completionsByDate(dateKey),
      });
    },
  });
}
