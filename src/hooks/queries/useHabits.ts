/**
 * Phase 3.3d: Habit query hooks.
 *
 * Thin React Query wrappers over src/services/habits.ts. Follows the
 * same pattern as useTasks: deterministic query keys, optimistic
 * updates on toggle, per-date scoping for the range reads.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  createHabit,
  deleteHabit,
  listHabitLogsForDate,
  listHabitLogsForRange,
  listHabits,
  toggleHabit,
  type CreateHabitInput,
  type Habit,
  type HabitLog,
  type ToggleHabitResult,
} from "../../services/habits";

export const habitsKeys = {
  all: ["habits"] as const,
  list: () => ["habits", "list"] as const,
  logsByDate: (dateKey: string) => ["habit_logs", "date", dateKey] as const,
  logsByRange: (start: string, end: string) =>
    ["habit_logs", "range", start, end] as const,
};

// ─── Reads ──────────────────────────────────────────────────────────────────

export function useHabits() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<Habit[]>({
    queryKey: habitsKeys.list(),
    queryFn: listHabits,
    enabled: Boolean(userId),
  });
}

export function useHabitLogsForDate(dateKey: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<HabitLog[]>({
    queryKey: habitsKeys.logsByDate(dateKey),
    queryFn: () => listHabitLogsForDate(dateKey),
    enabled: Boolean(userId),
  });
}

export function useHabitLogsForRange(startDateKey: string, endDateKey: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<HabitLog[]>({
    queryKey: habitsKeys.logsByRange(startDateKey, endDateKey),
    queryFn: () => listHabitLogsForRange(startDateKey, endDateKey),
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateHabit() {
  const queryClient = useQueryClient();
  return useMutation<Habit, Error, CreateHabitInput>({
    mutationFn: createHabit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitsKeys.list() });
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteHabit,
    onSuccess: () => {
      // Blow both the list and every log query since the habit_id is
      // now invalid everywhere.
      queryClient.invalidateQueries({ queryKey: habitsKeys.all });
    },
  });
}

type ToggleHabitVars = {
  habit: Habit;
  dateKey: string;
};

/**
 * Toggle with optimistic updates. Unlike useToggleCompletion this
 * DOES NOT optimistically update the habit list itself — the chain
 * recompute is non-trivial and we'd rather show the actual server
 * state on settle. Only the log-for-date cache gets the optimistic
 * flip, which is all the HabitChain component needs for instant
 * visual feedback.
 */
export function useToggleHabit() {
  const queryClient = useQueryClient();

  return useMutation<
    ToggleHabitResult,
    Error,
    ToggleHabitVars,
    { previousLogs: HabitLog[] | undefined }
  >({
    mutationFn: ({ habit, dateKey }) => toggleHabit(habit, dateKey),
    onMutate: async ({ habit, dateKey }) => {
      await queryClient.cancelQueries({
        queryKey: habitsKeys.logsByDate(dateKey),
      });
      const previousLogs = queryClient.getQueryData<HabitLog[]>(
        habitsKeys.logsByDate(dateKey),
      );

      // Toggle the log entry in the cache.
      queryClient.setQueryData<HabitLog[]>(
        habitsKeys.logsByDate(dateKey),
        (list) => {
          if (!list) return list;
          const isCompleted = list.some((l) => l.habit_id === habit.id);
          if (isCompleted) {
            return list.filter((l) => l.habit_id !== habit.id);
          }
          return [
            ...list,
            {
              id: `optimistic-${habit.id}-${dateKey}`,
              user_id: "",
              habit_id: habit.id,
              date_key: dateKey,
              created_at: new Date().toISOString(),
            },
          ];
        },
      );

      return { previousLogs };
    },
    onError: (_err, { dateKey }, context) => {
      if (context?.previousLogs !== undefined) {
        queryClient.setQueryData(
          habitsKeys.logsByDate(dateKey),
          context.previousLogs,
        );
      }
    },
    onSuccess: (result) => {
      // The server returned the updated habit with new chain values —
      // patch the habits list directly instead of refetching.
      queryClient.setQueryData<Habit[]>(habitsKeys.list(), (list) => {
        if (!list) return list;
        return list.map((h) => (h.id === result.habit.id ? result.habit : h));
      });
    },
    onSettled: (_data, _err, { dateKey }) => {
      queryClient.invalidateQueries({
        queryKey: habitsKeys.logsByDate(dateKey),
      });
    },
  });
}
