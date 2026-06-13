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
  updateTask,
  deleteTask,
  type Task,
  type Completion,
  type EngineKey,
  type TaskKind,
} from "../../services/tasks";
import { runAchievementCheck } from "../../lib/achievement-integration";
import { invalidateScoring } from "../../lib/score-invalidation";
import { xpKeys } from "./useXp";
import { profileKeys } from "./useProfile";
import { PaywallError } from "../../lib/paywall";
import { entitlementFromCache } from "./useSubscription";

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
      // Past the free trial (and with no active subscription), completing a
      // task is gated. Throw BEFORE any write — there's no optimistic toggle
      // here, so nothing flickers; the MutationCache opens the paywall.
      if (!entitlementFromCache(qc).isPro) throw new PaywallError();
      const result = await toggleCompletion({
        taskId: vars.task.id,
        dateKey: vars.dateKey,
        engine: vars.task.engine,
      });
      // XP, level, and the rank-up celebration are awarded SERVER-SIDE by the
      // completions INSERT/DELETE triggers: atomic (no cross-tap/-device
      // race), 10/day cap + streak multiplier + ±1-day gate enforced in SQL,
      // exactly once — and offline completions earn their XP when they sync.
      // The resulting xp_log / profiles / rank_up_events rows arrive via
      // Realtime; the onSettled invalidations below refetch them.
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
      // XP/level/rank moved — refresh the profile chip, today's XP ledger,
      // and the rank-up queue (the celebration watcher reads it).
      qc.invalidateQueries({ queryKey: profileKeys.all });
      qc.invalidateQueries({ queryKey: xpKeys.day(vars.dateKey) });
      qc.invalidateQueries({ queryKey: ["rank_ups"] });
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
 * Edit a task in place: mutate({ taskId, engine, title?, kind?, days_per_week? }).
 * The premium alternative to delete-and-recreate (which destroys history).
 */
export function useUpdateTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (vars: {
      taskId: string;
      engine: EngineKey;
      title?: string;
      kind?: TaskKind;
      days_per_week?: number;
    }) =>
      updateTask(vars.taskId, {
        title: vars.title,
        kind: vars.kind,
        days_per_week: vars.days_per_week,
      }),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: tasksKeys.all });
      qc.invalidateQueries({ queryKey: tasksKeys.engine(vars.engine) });
      // Renaming / re-kinding / changing days can shift the score denominator.
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
