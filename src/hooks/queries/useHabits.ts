import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listHabits,
  listHabitLogsForDate,
  listHabitLogsForRange,
  toggleHabitLog,
  createHabit,
  deleteHabit,
  type Habit,
  type HabitLog,
} from "../../services/habits";
import { runAchievementCheck } from "../../lib/achievement-integration";
import { evaluateAllTrees } from "../../lib/skill-tree-evaluator";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const habitsKeys = {
  all: ["habits"] as const,
  logs: (dateKey: string) => ["habit_logs", dateKey] as const,
  logRange: (start: string, end: string) =>
    ["habit_logs", "range", start, end] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useHabits() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: habitsKeys.all,
    queryFn: listHabits,
    enabled: Boolean(userId),
  });
}

export function useHabitLogsForDate(dateKey: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: habitsKeys.logs(dateKey),
    queryFn: () => listHabitLogsForDate(dateKey),
    enabled: Boolean(userId),
  });
}

export function useHabitLogsForRange(startDate: string, endDate: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: habitsKeys.logRange(startDate, endDate),
    queryFn: () => listHabitLogsForRange(startDate, endDate),
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Optimistic habit toggle.
 *
 * Screens call: mutateAsync({ habit: { id }, dateKey })
 * Returns: { completed: boolean }
 *
 * Optimistic update:
 * 1. Immediately add/remove the log from the date cache
 * 2. Immediately bump/decrement current_chain on the habit
 * 3. On error, rollback both caches
 * 4. On settle, invalidate to get the server-computed chain
 */
export function useToggleHabit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      habit: { id: string };
      dateKey: string;
    }): Promise<{ completed: boolean }> => {
      const result = await toggleHabitLog({
        habitId: vars.habit.id,
        dateKey: vars.dateKey,
      });
      return { completed: result.added };
    },

    onMutate: async (vars) => {
      // Cancel in-flight queries
      const logKey = habitsKeys.logs(vars.dateKey);
      await qc.cancelQueries({ queryKey: logKey });
      await qc.cancelQueries({ queryKey: habitsKeys.all });

      // Snapshot previous data for rollback
      const prevLogs = qc.getQueryData<HabitLog[]>(logKey);
      const prevHabits = qc.getQueryData<Habit[]>(habitsKeys.all);

      // Determine if we're adding or removing
      const isCompleted = prevLogs?.some(
        (l) => l.habit_id === vars.habit.id,
      );

      if (isCompleted) {
        // Optimistic remove
        qc.setQueryData<HabitLog[]>(logKey, (old) =>
          old?.filter((l) => l.habit_id !== vars.habit.id) ?? [],
        );
        // Decrement chain on the habit
        qc.setQueryData<Habit[]>(habitsKeys.all, (old) =>
          old?.map((h) =>
            h.id === vars.habit.id
              ? { ...h, current_chain: Math.max(0, h.current_chain - 1) }
              : h,
          ) ?? [],
        );
      } else {
        // Optimistic add — create a fake log entry
        const fakeLog: HabitLog = {
          id: `optimistic-${Date.now()}`,
          user_id: "",
          habit_id: vars.habit.id,
          date_key: vars.dateKey,
          created_at: new Date().toISOString(),
        };
        qc.setQueryData<HabitLog[]>(logKey, (old) => [
          ...(old ?? []),
          fakeLog,
        ]);
        // Increment chain on the habit
        qc.setQueryData<Habit[]>(habitsKeys.all, (old) =>
          old?.map((h) =>
            h.id === vars.habit.id
              ? {
                  ...h,
                  current_chain: h.current_chain + 1,
                  best_chain: Math.max(h.best_chain, h.current_chain + 1),
                }
              : h,
          ) ?? [],
        );
      }

      return { prevLogs, prevHabits };
    },

    onError: (_err, vars, ctx) => {
      // Rollback on error
      if (ctx?.prevLogs !== undefined) {
        qc.setQueryData(habitsKeys.logs(vars.dateKey), ctx.prevLogs);
      }
      if (ctx?.prevHabits !== undefined) {
        qc.setQueryData(habitsKeys.all, ctx.prevHabits);
      }
    },

    onSettled: (_data, _err, vars) => {
      // Refetch to get server-computed chain values
      qc.invalidateQueries({ queryKey: habitsKeys.logs(vars.dateKey) });
      qc.invalidateQueries({ queryKey: habitsKeys.all });
      // Fire-and-forget achievement check after habit toggle settles
      runAchievementCheck(qc).catch(() => {});
      // Re-evaluate skill tree — habit checks feed into habit_streak and
      // habit_completion_rate requirements.
      evaluateAllTrees().catch(() => {});
    },
  });
}

/**
 * Screens pass camelCase: { title, engine, icon, triggerText, durationText, frequency }
 * Service expects snake_case: { trigger_text, duration_text }
 */
export function useCreateHabit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      title: string;
      engine: string;
      icon?: string;
      triggerText?: string;
      durationText?: string;
      frequency?: string;
    }) => {
      return createHabit({
        title: vars.title,
        engine: vars.engine,
        icon: vars.icon,
        trigger_text: vars.triggerText,
        duration_text: vars.durationText,
        frequency: vars.frequency,
      });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: habitsKeys.all });
      const prev = qc.getQueryData<Habit[]>(habitsKeys.all);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(habitsKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: habitsKeys.all });
    },
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteHabit,
    onMutate: async (habitId) => {
      await qc.cancelQueries({ queryKey: habitsKeys.all });
      const prev = qc.getQueryData<Habit[]>(habitsKeys.all);
      qc.setQueryData<Habit[]>(habitsKeys.all, (old) =>
        old?.filter((h) => h.id !== habitId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _habitId, ctx) => {
      if (ctx?.prev) qc.setQueryData(habitsKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: habitsKeys.all });
    },
  });
}
