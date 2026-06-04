import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/session";
import {
  listTasks,
  listCompletionsForDate,
  listTasksByEngine,
  listCompletionsByEngine,
  listRecentCompletions,
  toggleCompletion,
  createTask,
  deleteTask,
  type Task,
  type Completion,
  type EngineKey,
  type TaskKind,
} from "../../services/tasks";
import { runAchievementCheck } from "../../lib/achievement-integration";
import { invalidateScoring } from "../../lib/score-invalidation";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const tasksKeys = {
  all: ["tasks"] as const,
  engine: (engine: EngineKey) => ["tasks", "engine", engine] as const,
  completions: (dateKey: string) => ["completions", dateKey] as const,
  engineCompletions: (engine: EngineKey, dateKey: string) =>
    ["completions", "engine", engine, dateKey] as const,
  recentCompletions: ["completions", "recent"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useAllTasks() {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: tasksKeys.all,
    queryFn: listTasks,
    enabled: Boolean(userId),
  });
}

export function useAllCompletionsForDate(dateKey: string) {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: tasksKeys.completions(dateKey),
    queryFn: () => listCompletionsForDate(dateKey),
    enabled: Boolean(userId),
  });
}

export function useEngineTasks(engine: EngineKey) {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: tasksKeys.engine(engine),
    queryFn: () => listTasksByEngine(engine),
    enabled: Boolean(userId),
  });
}

export function useEngineCompletions(engine: EngineKey, dateKey: string) {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: tasksKeys.engineCompletions(engine, dateKey),
    queryFn: () => listCompletionsByEngine(engine, dateKey),
    enabled: Boolean(userId),
  });
}

export function useRecentCompletionMap() {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: tasksKeys.recentCompletions,
    queryFn: async () => {
      const completions = await listRecentCompletions(30);
      const map: Record<string, string[]> = {};
      for (const c of completions) {
        if (!map[c.task_id]) map[c.task_id] = [];
        map[c.task_id].push(c.date_key);
      }
      return map;
    },
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Screens call: mutateAsync({ task: { id, engine }, dateKey })
 * Returns { completed: boolean } (true = added, false = removed).
 */
export function useToggleCompletion() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      task: { id: string; engine: EngineKey };
      dateKey: string;
    }): Promise<{ completed: boolean }> => {
      const result = await toggleCompletion({
        taskId: vars.task.id,
        dateKey: vars.dateKey,
        engine: vars.task.engine,
      });
      return { completed: result.added };
    },
    onMutate: async (vars) => {
      const key = tasksKeys.completions(vars.dateKey);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Completion[]>(key);
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(tasksKeys.completions(vars.dateKey), ctx.prev);
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: tasksKeys.completions(vars.dateKey) });
      qc.invalidateQueries({ queryKey: tasksKeys.recentCompletions });
      qc.invalidateQueries({
        queryKey: tasksKeys.engineCompletions(vars.task.engine, vars.dateKey),
      });
      // A completion shifts every derived score the UI shows — Titan Score
      // on Dashboard, engine calendars, week sparklines, analytics. Without
      // this the user toggles a task and the Dashboard stays at the
      // pre-toggle score (the planning context only refetched at midnight).
      invalidateScoring(qc);
      runAchievementCheck(qc).catch(() => {});
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createTask,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: tasksKeys.all });
      const prev = qc.getQueryData<Task[]>(tasksKeys.all);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(tasksKeys.all, ctx.prev);
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: tasksKeys.all });
      qc.invalidateQueries({ queryKey: tasksKeys.engine(vars.engine) });
      // Adding a task changes the denominator (more main/secondary points)
      // so every score shifts. Invalidate scoring caches.
      invalidateScoring(qc);
    },
  });
}

/**
 * Screens call: mutate({ taskId, engine })
 */
export function useDeleteTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { taskId: string; engine?: EngineKey }) => {
      return deleteTask(vars.taskId);
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: tasksKeys.all });
      const prev = qc.getQueryData<Task[]>(tasksKeys.all);
      qc.setQueryData<Task[]>(tasksKeys.all, (old) =>
        old?.filter((t) => t.id !== vars.taskId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(tasksKeys.all, ctx.prev);
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: tasksKeys.all });
      if (vars.engine) {
        qc.invalidateQueries({ queryKey: tasksKeys.engine(vars.engine) });
      }
      // Removing a task drops the denominator and removes any completions
      // referencing it — every score shifts.
      invalidateScoring(qc);
    },
  });
}
