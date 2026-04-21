/**
 * Achievement integration — fire-and-forget bridge.
 *
 * Gathers current AppState from SQLite, reads the authoritative set of
 * already-unlocked achievement IDs from SQLite, runs the checker with
 * both, and persists any new unlocks. Also invalidates the React Query
 * cache so the Profile tab picks up the new unlock.
 *
 * Call from mutation `onSettled`. All errors are swallowed — a failed
 * achievement check must never break the user's primary action.
 */

import { getTodayKey } from "./date";
import { checkAllAchievements, type AppState } from "./achievement-checker";
import {
  insertUnlockedAchievements,
  listUnlockedAchievements,
} from "../services/achievements";
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
 * Run the full achievement check. Gathers app state AND the unlocked
 * set from SQLite so the checker sees a consistent snapshot. Any new
 * unlocks are persisted to SQLite and the React Query cache is
 * invalidated so UI components observing the unlocked list pick them
 * up.
 *
 * Fire-and-forget: errors are caught internally.
 */
export async function runAchievementCheck(
  queryClient?: QueryClient,
): Promise<void> {
  try {
    const [appState, unlockedRows] = await Promise.all([
      gatherAppState(),
      listUnlockedAchievements(),
    ]);
    const alreadyUnlocked = new Set(
      unlockedRows.map((row) => row.achievement_id),
    );

    const newIds = checkAllAchievements(appState, alreadyUnlocked);
    if (newIds.length === 0) return;

    await insertUnlockedAchievements(newIds).catch(() => {});

    if (queryClient) {
      queryClient.invalidateQueries({ queryKey: achievementsKeys.unlocked });
    }
  } catch {
    // Swallow — achievement checking never blocks the user's flow.
  }
}
