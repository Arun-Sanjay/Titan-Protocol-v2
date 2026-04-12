/**
 * Phase 4.2: Account data deletion service.
 *
 * Deletes all user data from every Supabase table, resets the profile
 * row to defaults (onboarding_completed = false), clears MMKV, and
 * flushes the React Query cache. The auth account is preserved — the
 * user stays signed in but goes through onboarding again.
 *
 * Services throw, hooks catch (per project convention).
 */

import { supabase, requireUserId } from "../lib/supabase";
import { storage } from "../db/storage";
import { queryClient } from "../lib/query-client";

// Tables that contain user-scoped data, ordered to respect FK constraints.
// Delete children (rows with FK references) before parents.
const USER_DATA_TABLES = [
  // FK children first
  "completions",
  "habit_logs",
  "gym_sets",
  "gym_personal_records",
  "gym_sessions",
  "gym_templates",
  "gym_exercises",
  // Leaf tables (no FK dependencies)
  "achievements_unlocked",
  "boss_challenges",
  "budgets",
  "deep_work_sessions",
  "field_op_cooldown",
  "field_ops",
  "focus_sessions",
  "focus_settings",
  "goals",
  "journal_entries",
  "meal_logs",
  "mind_training_results",
  "money_transactions",
  "narrative_entries",
  "narrative_log",
  "nutrition_profile",
  "progression",
  "protocol_sessions",
  "quests",
  "rank_up_events",
  "skill_tree_progress",
  "sleep_logs",
  "srs_cards",
  "subscriptions",
  "titan_mode_state",
  "user_titles",
  "weight_logs",
  // Parent tables last (tasks, habits have FK children above)
  "tasks",
  "habits",
] as const;

/**
 * Delete all user data from Supabase, clear MMKV, and flush React Query.
 * The profile row is preserved but reset to defaults. Auth session is kept.
 *
 * @throws if any Supabase operation fails
 */
export async function deleteAllUserData(): Promise<void> {
  const userId = await requireUserId();

  // 1. Delete all rows from every user-data table (RLS scopes to auth.uid()).
  for (const table of USER_DATA_TABLES) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("user_id", userId);
    if (error) throw error;
  }

  // 2. Reset profile to fresh-onboarding defaults (preserves the row + auth link).
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      onboarding_completed: false,
      xp: 0,
      level: 1,
      streak_current: 0,
      streak_best: 0,
      streak_last_date: null,
      archetype: null,
      display_name: null,
      mode: "full_protocol",
      focus_engines: [],
      first_use_date: null,
      first_task_completed_at: null,
      tutorial_completed: false,
    })
    .eq("id", userId);
  if (profileError) throw profileError;

  // 3. Clear local MMKV (all keys — preferences, caches, flags).
  storage.clearAll();

  // 4. Flush React Query cache so stale data doesn't resurface.
  queryClient.clear();
}
