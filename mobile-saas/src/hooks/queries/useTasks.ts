import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listTasks,
  listCompletionsForDate,
  listTasksByEngine,
  listCompletionsByEngine,
  listRecentCompletions,
  toggleCompletion,
  toggleCompletionAndAward,
  createTask,
  deleteTask,
  type Task,
  type Completion,
  type EngineKey,
  type TaskKind,
} from "../../services/tasks";
import { profileQueryKey } from "./useProfile";
import { runAchievementCheck } from "../../lib/achievement-integration";
import { evaluateAllTrees } from "../../lib/skill-tree-evaluator";
import { recordCompletion } from "../../lib/protocol-integrity";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const tasksKeys = {
  all: ["tasks"] as const,
  engine: (engine: EngineKey) => ["tasks", "engine", engine] as const,
  completions: (dateKey: string) => ["completions", dateKey] as const,
  engineCompletions: (engine: EngineKey, dateKey: string) =>
    ["completions", "engine", engine, dateKey] as const,
  recentCompletions: ["completions", "recent"] as const,
};

/**
 * Bust the derived score caches so HQ (hero %, radar, per-engine bars,
 * planner) and Analytics refetch after a task/completion mutation. Mirrors
 * web's invalidateScoring. Prefix keys match every dated sub-key.
 */
function invalidateScoring(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["dailyPlanning"] });
  qc.invalidateQueries({ queryKey: ["analytics"] });
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useAllTasks() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: tasksKeys.all,
    queryFn: listTasks,
    enabled: Boolean(userId),
  });
}

export function useAllCompletionsForDate(dateKey: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: tasksKeys.completions(dateKey),
    queryFn: () => listCompletionsForDate(dateKey),
    enabled: Boolean(userId),
  });
}

export function useEngineTasks(engine: EngineKey) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: tasksKeys.engine(engine),
    queryFn: () => listTasksByEngine(engine),
    enabled: Boolean(userId),
  });
}

export function useEngineCompletions(engine: EngineKey, dateKey: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: tasksKeys.engineCompletions(engine, dateKey),
    queryFn: () => listCompletionsByEngine(engine, dateKey),
    enabled: Boolean(userId),
  });
}

export function useRecentCompletionMap(days = 30) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: [...tasksKeys.recentCompletions, days] as const,
    queryFn: async () => {
      const completions = await listRecentCompletions(days);
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
    onSuccess: () => {
      // Stamp the day-engagement marker. Idempotent same-day, so a
      // tap-storm on multiple tasks doesn't multi-advance the
      // progress counter.
      recordCompletion();
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: tasksKeys.completions(vars.dateKey) });
      qc.invalidateQueries({ queryKey: tasksKeys.recentCompletions });
      qc.invalidateQueries({
        queryKey: tasksKeys.engineCompletions(vars.task.engine, vars.dateKey),
      });
      // Per-engine task list is used by engine-detail screens that recompute
      // their own day score from useEngineTasks + useEngineCompletions —
      // invalidate so screens on other engines still rerender correctly.
      qc.invalidateQueries({ queryKey: tasksKeys.engine(vars.task.engine) });
      invalidateScoring(qc);
      runAchievementCheck(qc).catch(() => {});
      // Fire-and-forget skill-tree re-evaluation so level-1 "task_count"
      // nodes flip to "ready" as the user plays, not only after evening
      // protocol.
      evaluateAllTrees().catch(() => {});
    },
  });
}

/**
 * Atomic toggle + XP award. Use this from screens whose toggle is
 * paired with an XP grant (HQ, Engine detail). The service runs both
 * the completion mutation and the XP recalculation in one SQLite
 * transaction so a partial failure can't leave the user with a
 * completed task and no XP, or vice versa.
 *
 * Optimistic cache updates target both the completions list and the
 * profile so the UI feels instant; the authoritative result returns
 * { added, leveledUp, fromLevel, toLevel, xp }.
 */
export function useToggleCompletionWithReward() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (vars: {
      task: { id: string; engine: EngineKey };
      dateKey: string;
      xpAmount: number;
    }) =>
      toggleCompletionAndAward({
        taskId: vars.task.id,
        dateKey: vars.dateKey,
        engine: vars.task.engine,
        xpAmount: vars.xpAmount,
      }),
    onMutate: async (vars) => {
      const completionsKey = tasksKeys.completions(vars.dateKey);
      await qc.cancelQueries({ queryKey: completionsKey });
      await qc.cancelQueries({ queryKey: profileQueryKey });
      const prevCompletions = qc.getQueryData<Completion[]>(completionsKey);
      const prevProfile = qc.getQueryData<{
        xp?: number;
        level?: number;
      }>(profileQueryKey);
      // Optimistic profile XP bump (best-effort; the mutationFn returns
      // the authoritative numbers and onSettled invalidates).
      if (prevProfile) {
        const oldXP = prevProfile.xp ?? 0;
        const oldLevel = prevProfile.level ?? 1;
        const tentativeXP = Math.max(0, oldXP + vars.xpAmount);
        const tentativeLevel = Math.floor(tentativeXP / 500) + 1;
        qc.setQueryData(profileQueryKey, {
          ...prevProfile,
          xp: tentativeXP,
          level: tentativeLevel,
        });
        // Restore on error via the snapshot below.
        void oldLevel;
      }
      return { prevCompletions, prevProfile };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prevCompletions) {
        qc.setQueryData(tasksKeys.completions(vars.dateKey), ctx.prevCompletions);
      }
      if (ctx?.prevProfile !== undefined) {
        qc.setQueryData(profileQueryKey, ctx.prevProfile);
      }
    },
    onSuccess: () => {
      // Same as useToggleCompletion — stamp the day-engagement marker
      // so the progress day advances on the first task tick of a new
      // local day.
      recordCompletion();
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: tasksKeys.completions(vars.dateKey) });
      qc.invalidateQueries({ queryKey: tasksKeys.recentCompletions });
      qc.invalidateQueries({
        queryKey: tasksKeys.engineCompletions(vars.task.engine, vars.dateKey),
      });
      qc.invalidateQueries({ queryKey: tasksKeys.engine(vars.task.engine) });
      qc.invalidateQueries({ queryKey: profileQueryKey });
      invalidateScoring(qc);
      runAchievementCheck(qc).catch(() => {});
      evaluateAllTrees().catch(() => {});
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
      // Analytics' "task reliability" view derives from this map — adding
      // a task changes the eligible-tasks denominator.
      qc.invalidateQueries({ queryKey: tasksKeys.recentCompletions });
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
      // Deleted task disappears from the reliability ranking used by
      // analytics; refresh the recent-completion map.
      qc.invalidateQueries({ queryKey: tasksKeys.recentCompletions });
      invalidateScoring(qc);
    },
  });
}
