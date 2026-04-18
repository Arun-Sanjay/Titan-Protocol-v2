/**
 * Achievement integration — fire-and-forget bridge.
 *
 * Gathers current AppState from SQLite (profile, protocol session,
 * progression, task completions), runs the achievement checker, and
 * persists any newly unlocked achievements via the achievements service.
 * Also invalidates the React Query cache so the UI picks up new unlocks.
 *
 * Designed to be called from mutation `onSettled` callbacks.
 * All errors are swallowed — a failed achievement check must never
 * block the core user flow.
 */

import { getTodayKey } from "./date";
import { checkAllAchievements, type AppState } from "./achievement-checker";
import { insertUnlockedAchievements } from "../services/achievements";
import {
  computeEngineScore,
  ENGINES,
  listCompletionsForDate,
  listTasks,
} from "../services/tasks";
import { getProfile } from "../services/profile";
import { getProgression } from "../services/progression";
import { getProtocolSession } from "../services/protocol";
import type { QueryClient } from "@tanstack/react-query";
import { achievementsKeys } from "../hooks/queries/useAchievements";

/**
 * Build the current AppState from the local (SQLite) source of truth.
 * Each read is independent so we fire them in parallel.
 */
async function gatherAppState(): Promise<AppState> {
  const todayKey = getTodayKey();

  const [profile, session, progression, tasks, completions] = await Promise.all([
    getProfile(),
    getProtocolSession(todayKey),
    getProgression(),
    listTasks(),
    listCompletionsForDate(todayKey),
  ]);

  const streak = profile?.streak_current ?? 0;

  // Day number (days since first_use_date, 1-based)
  const firstUse = profile?.first_use_date;
  let dayNumber = 1;
  if (firstUse) {
    const start = new Date(firstUse + "T00:00:00");
    const now = new Date(todayKey + "T00:00:00");
    dayNumber = Math.max(
      1,
      Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1,
    );
  }

  const protocolCompleteToday = Boolean(
    session?.morning_completed_at || session?.evening_completed_at,
  );
  let protocolCompletionHour: number | undefined;
  const completedAt =
    session?.evening_completed_at ?? session?.morning_completed_at;
  if (completedAt) {
    protocolCompletionHour = new Date(completedAt).getHours();
  }
  const titanScore = session?.titan_score ?? 0;

  const engineScores: Record<string, number> = {};
  for (const engine of ENGINES) {
    engineScores[engine] = computeEngineScore(tasks, completions, engine);
  }

  // `current_phase` is read off progression but no longer needed by the
  // checker's app-state (it uses cachedCurrentPhase directly). Preserved
  // here just to keep the shape consistent with the older signature.
  void progression;

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
 * Fire-and-forget: errors are caught internally so a failed check
 * never breaks the calling mutation flow.
 */
export async function runAchievementCheck(
  queryClient?: QueryClient,
): Promise<void> {
  try {
    const appState = await gatherAppState();
    const newIds = checkAllAchievements(appState);

    if (newIds.length > 0) {
      await insertUnlockedAchievements(newIds).catch(() => {});
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: achievementsKeys.unlocked });
      }
    }
  } catch {
    // Swallow all errors — achievement checking is never critical
  }
}
