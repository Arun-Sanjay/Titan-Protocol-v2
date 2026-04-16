import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type Habit = Tables<"habits">;
export type HabitLog = Tables<"habit_logs">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createHabit(habit: {
  title: string;
  engine: string;
  icon?: string;
  trigger_text?: string;
  duration_text?: string;
  frequency?: string;
}): Promise<Habit> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: userId,
      title: habit.title,
      engine: habit.engine,
      icon: habit.icon ?? "🔄",
      trigger_text: habit.trigger_text ?? null,
      duration_text: habit.duration_text ?? null,
      frequency: habit.frequency ?? "daily",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteHabit(habitId: string): Promise<void> {
  const { error } = await supabase.from("habits").delete().eq("id", habitId);
  if (error) throw error;
}

// ─── Habit Logs ────────────────────────────────────────────────────────────

export async function listHabitLogsForDate(
  dateKey: string,
): Promise<HabitLog[]> {
  const { data, error } = await supabase
    .from("habit_logs")
    .select("*")
    .eq("date_key", dateKey);
  if (error) throw error;
  return data ?? [];
}

export async function listHabitLogsForRange(
  startDate: string,
  endDate: string,
): Promise<HabitLog[]> {
  const { data, error } = await supabase
    .from("habit_logs")
    .select("*")
    .gte("date_key", startDate)
    .lte("date_key", endDate)
    .order("date_key", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Toggle a habit log for a given date.
 *
 * If the log exists → delete it (un-complete) and recalculate chain.
 * If the log doesn't exist → insert it and recalculate chain.
 *
 * Chain logic:
 * - Walk backwards from today through consecutive days with a log.
 * - `current_chain` = length of that unbroken streak.
 * - `best_chain` = max(old best, new current).
 * - If chain breaks (un-complete today), `last_broken_date` is set.
 */
export async function toggleHabitLog(params: {
  habitId: string;
  dateKey: string;
}): Promise<{ added: boolean }> {
  const userId = await requireUserId();

  // Check if log exists for this habit + date
  const { data: existing, error: checkErr } = await supabase
    .from("habit_logs")
    .select("id")
    .eq("habit_id", params.habitId)
    .eq("date_key", params.dateKey)
    .maybeSingle();
  if (checkErr) throw checkErr;

  if (existing) {
    // Remove the log
    const { error } = await supabase
      .from("habit_logs")
      .delete()
      .eq("id", existing.id);
    if (error) throw error;

    // Recalculate chain after removal
    await recalculateChain(params.habitId, params.dateKey);
    return { added: false };
  } else {
    // Insert the log
    const { error } = await supabase.from("habit_logs").insert({
      user_id: userId,
      habit_id: params.habitId,
      date_key: params.dateKey,
    });
    if (error) throw error;

    // Recalculate chain after addition
    await recalculateChain(params.habitId, params.dateKey);
    return { added: true };
  }
}

// ─── Chain Calculation ────────────────────────────────────────────────────

/**
 * Recalculate current_chain and best_chain for a habit.
 *
 * Walks backwards from `dateKey` through consecutive logged days.
 * A day without a log breaks the chain.
 */
async function recalculateChain(
  habitId: string,
  dateKey: string,
): Promise<void> {
  // Fetch the last 90 days of logs for this habit (more than enough)
  const startDate = subtractDays(dateKey, 90);
  const { data: logs, error } = await supabase
    .from("habit_logs")
    .select("date_key")
    .eq("habit_id", habitId)
    .gte("date_key", startDate)
    .lte("date_key", dateKey)
    .order("date_key", { ascending: false });
  if (error) return; // Non-fatal — chain will be stale but not crash

  const logDates = new Set((logs ?? []).map((l) => l.date_key));

  // Walk backwards from dateKey
  let chain = 0;
  let cursor = dateKey;
  while (logDates.has(cursor)) {
    chain++;
    cursor = subtractDays(cursor, 1);
  }

  // Fetch current best_chain
  const { data: habit } = await supabase
    .from("habits")
    .select("best_chain, current_chain")
    .eq("id", habitId)
    .single();

  const oldBest = habit?.best_chain ?? 0;
  const newBest = Math.max(oldBest, chain);

  // Update the habit row
  const updatePayload: Record<string, unknown> = {
    current_chain: chain,
    best_chain: newBest,
  };
  // If chain just broke, record the date
  if (chain === 0 && (habit?.current_chain ?? 0) > 0) {
    updatePayload.last_broken_date = dateKey;
  }

  await supabase.from("habits").update(updatePayload).eq("id", habitId);
}

/** Subtract N days from a YYYY-MM-DD string. */
function subtractDays(dateKey: string, days: number): string {
  const d = new Date(dateKey + "T12:00:00"); // noon to avoid DST edge
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
