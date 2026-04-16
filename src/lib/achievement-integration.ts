/**
 * Achievement integration — fire-and-forget bridge.
 *
 * Gathers current AppState from Supabase (profile, protocol session,
 * progression, task completions), runs the achievement checker, and
 * persists any newly unlocked achievements to the `achievements_unlocked`
 * table. Also invalidates the React Query cache so the UI picks up
 * new unlocks.
 *
 * Designed to be called from mutation `onSettled` callbacks.
 * All errors are swallowed — a failed achievement check must never
 * block the core user flow.
 */

import { supabase } from "./supabase";
import { getTodayKey } from "./date";
import { checkAllAchievements, type AppState } from "./achievement-checker";
import { insertUnlockedAchievements } from "../services/achievements";
import { computeEngineScore, ENGINES, type Task, type Completion } from "../services/tasks";
import type { QueryClient } from "@tanstack/react-query";
import { achievementsKeys } from "../hooks/queries/useAchievements";

/**
 * Build the current AppState from cloud data.
 * Each query is independent so we fire them in parallel.
 */
async function gatherAppState(): Promise<AppState> {
  const todayKey = getTodayKey();

  const [profileRes, sessionRes, progressionRes, tasksRes, completionsRes] =
    await Promise.all([
      supabase.from("profiles").select("streak_current, first_use_date").single(),
      supabase
        .from("protocol_sessions")
        .select("morning_completed_at, evening_completed_at, titan_score")
        .eq("date_key", todayKey)
        .maybeSingle(),
      supabase.from("progression").select("current_phase").maybeSingle(),
      supabase.from("tasks").select("*"),
      supabase.from("completions").select("*").eq("date_key", todayKey),
    ]);

  // Profile streak
  const streak = profileRes.data?.streak_current ?? 0;

  // Day number (days since first_use_date, 1-based)
  const firstUse = profileRes.data?.first_use_date;
  let dayNumber = 1;
  if (firstUse) {
    const start = new Date(firstUse + "T00:00:00");
    const now = new Date(todayKey + "T00:00:00");
    dayNumber = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1);
  }

  // Protocol session today
  const session = sessionRes.data;
  const protocolCompleteToday = Boolean(
    session?.morning_completed_at || session?.evening_completed_at,
  );
  let protocolCompletionHour: number | undefined;
  const completedAt = session?.evening_completed_at ?? session?.morning_completed_at;
  if (completedAt) {
    protocolCompletionHour = new Date(completedAt).getHours();
  }

  // Titan score from today's session (or 0)
  const titanScore = session?.titan_score ?? 0;

  // Engine scores
  const tasks = (tasksRes.data ?? []) as Task[];
  const completions = (completionsRes.data ?? []) as Completion[];
  const engineScores: Record<string, number> = {};
  for (const engine of ENGINES) {
    engineScores[engine] = computeEngineScore(tasks, completions, engine);
  }

  return {
    titanScore,
    engineScores,
    protocolStreak: streak,
    protocolCompleteToday,
    protocolCompletionHour,
    dayNumber,
  };
}

/**
 * Run the full achievement check and persist any new unlocks.
 *
 * Call this from mutation `onSettled` callbacks:
 * ```
 * onSettled: () => {
 *   runAchievementCheck(qc).catch(() => {});
 * }
 * ```
 *
 * Fire-and-forget: errors are caught internally so a failed check
 * never breaks the calling mutation flow.
 *
 * @param queryClient - optional QueryClient to invalidate the achievements
 *   cache after new unlocks are persisted. Pass `undefined` if you don't
 *   need cache invalidation (rare).
 */
export async function runAchievementCheck(
  queryClient?: QueryClient,
): Promise<void> {
  try {
    const appState = await gatherAppState();
    const newIds = checkAllAchievements(appState);

    if (newIds.length > 0) {
      // Persist to Supabase (fire-and-forget — swallow errors)
      await insertUnlockedAchievements(newIds).catch(() => {});

      // Invalidate the achievements query so the UI picks up new unlocks
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: achievementsKeys.unlocked });
      }
    }
  } catch {
    // Swallow all errors — achievement checking is never critical
  }
}
