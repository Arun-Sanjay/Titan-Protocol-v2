import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
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
import { profileQueryKey } from "./useProfile";
import { awardXpForCompletion, refundXpForUncomplete } from "../../services/xp";
import { enqueueRankUp } from "../../services/rank-ups";
import { xpKeys } from "./useXp";
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
      if (result.added) {
        // Award XP (10/day cap + streak multiplier handled in the service).
        // On a level-up, enqueue a rank-up event for the celebration watcher.
        const award = await awardXpForCompletion(vars.dateKey, vars.task.id);
        if (award.awarded && award.leveledUp) {
          await enqueueRankUp({
            fromLevel: award.fromLevel,
            toLevel: award.toLevel,
          });
        }
      } else {
        // Un-completing a counted task refunds its XP (anti-gaming guarded).
        await refundXpForUncomplete(vars.dateKey, vars.task.id);
      }
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
      // XP/level/rank moved — refresh the profile chip, today's XP ledger,
      // and the rank-up queue (the celebration watcher reads it).
      qc.invalidateQueries({ queryKey: profileQueryKey });
      qc.invalidateQueries({ queryKey: xpKeys.day(vars.dateKey) });
      qc.invalidateQueries({ queryKey: ["rank_ups"] });
      runAchievementCheck(qc).catch(() => {});
      // Fire-and-forget skill-tree re-evaluation so level-1 "task_count"
      // nodes flip to "ready" as the user plays, not only after evening
      // protocol.
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
