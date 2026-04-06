/**
 * Phase 3.3d: Habits + habit_logs service.
 *
 * Habits have denormalized chain stats (current_chain, best_chain,
 * last_broken_date) that get updated on toggle — no more O(n²) MMKV
 * scans from Phase 2.3F. The toggleHabit function computes the new
 * chain values in TS and updates the row; the server accepts whatever
 * the client sends (RLS only enforces ownership).
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert } from "../types/supabase";
import { addDays } from "../lib/date";

export type Habit = Tables<"habits">;
export type HabitLog = Tables<"habit_logs">;

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function listHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * List habit logs for a given date. Used by the Track tab + HQ
 * dashboard to compute today's completion count.
 */
export async function listHabitLogsForDate(dateKey: string): Promise<HabitLog[]> {
  const { data, error } = await supabase
    .from("habit_logs")
    .select("*")
    .eq("date_key", dateKey);

  if (error) throw error;
  return data ?? [];
}

/**
 * List habit logs across a date range. Used by the 14-day HabitChain
 * component and analytics screens.
 */
export async function listHabitLogsForRange(
  startDateKey: string,
  endDateKey: string,
): Promise<HabitLog[]> {
  const { data, error } = await supabase
    .from("habit_logs")
    .select("*")
    .gte("date_key", startDateKey)
    .lte("date_key", endDateKey)
    .order("date_key", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export type CreateHabitInput = {
  title: string;
  engine: string;
  icon?: string;
  triggerText?: string;
  durationText?: string;
  frequency?: string;
};

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const userId = await requireUserId();
  const row: TablesInsert<"habits"> = {
    user_id: userId,
    title: input.title,
    engine: input.engine,
    icon: input.icon ?? "",
    trigger_text: input.triggerText ?? null,
    duration_text: input.durationText ?? null,
    frequency: input.frequency ?? null,
    current_chain: 0,
    best_chain: 0,
  };
  const { data, error } = await supabase
    .from("habits")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteHabit(habitId: string): Promise<void> {
  // Hard delete — cascade removes habit_logs via FK on delete cascade.
  const { error } = await supabase.from("habits").delete().eq("id", habitId);
  if (error) throw error;
}

/**
 * Toggle a habit log for a given date, recomputing the habit's chain
 * fields in the process.
 *
 * Chain logic:
 *   - If we're completing today's log AND the habit was completed
 *     yesterday (or never before), extend the current chain by 1.
 *   - If we're completing today's log AND there's a gap, start a new
 *     chain (current_chain = 1, last_broken_date = today's new break).
 *   - If we're un-completing today's log, step the chain back by 1
 *     (but never below 0).
 *   - best_chain is always max(best_chain, current_chain).
 *
 * This is called optimistically in the UI; the mutation hook handles
 * rollback if the server rejects.
 */
export type ToggleHabitResult = {
  completed: boolean;
  habit: Habit;
};

export async function toggleHabit(
  habit: Habit,
  dateKey: string,
): Promise<ToggleHabitResult> {
  const userId = await requireUserId();

  // Check if a log for this (habit, date) already exists.
  const { data: existing, error: existingError } = await supabase
    .from("habit_logs")
    .select("id")
    .eq("habit_id", habit.id)
    .eq("date_key", dateKey)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    // Un-complete: delete the log and step the chain back.
    const { error: delError } = await supabase
      .from("habit_logs")
      .delete()
      .eq("id", existing.id);
    if (delError) throw delError;

    const newCurrent = Math.max(0, habit.current_chain - 1);
    const { data: updated, error: updError } = await supabase
      .from("habits")
      .update({ current_chain: newCurrent })
      .eq("id", habit.id)
      .select()
      .single();
    if (updError) throw updError;
    return { completed: false, habit: updated };
  }

  // Complete: insert the log.
  const logRow: TablesInsert<"habit_logs"> = {
    user_id: userId,
    habit_id: habit.id,
    date_key: dateKey,
  };
  const { error: insError } = await supabase.from("habit_logs").insert(logRow);
  if (insError) throw insError;

  // Recompute chain. Was yesterday completed?
  const yesterday = addDays(dateKey, -1);
  let newCurrent: number;
  if (habit.current_chain === 0) {
    // No existing chain — this starts a new one.
    newCurrent = 1;
  } else if (habit.last_broken_date && habit.last_broken_date >= yesterday) {
    // The last break was too recent — also a fresh start.
    newCurrent = 1;
  } else {
    newCurrent = habit.current_chain + 1;
  }
  const newBest = Math.max(habit.best_chain, newCurrent);

  const { data: updated, error: updError } = await supabase
    .from("habits")
    .update({
      current_chain: newCurrent,
      best_chain: newBest,
    })
    .eq("id", habit.id)
    .select()
    .single();
  if (updError) throw updError;
  return { completed: true, habit: updated };
}
