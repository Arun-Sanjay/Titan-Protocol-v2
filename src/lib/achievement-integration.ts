/**
 * Achievement integration — fire-and-forget bridge.
 *
 * Gathers current AppState from SQLite, reads the authoritative set of
 * already-unlocked achievement IDs from SQLite, runs the checker with
 * both, persists any new unlocks, THEN pushes to the celebration queue,
 * THEN invalidates the React Query cache.
 *
 * Ordering matters: a toast that fires before the SQLite write lands is
 * the exact failure mode that caused "First Blood fires every app open"
 * — if the write silently failed (auth race, serialization error, etc.)
 * the `alreadyUnlocked` set on the next session wouldn't include it, so
 * the same unlock would re-fire forever.
 *
 * A single-flight guard prevents overlapping runs from rapid-fire taps
 * (tap task 1 → onSettled fires a check; tap task 2 before the first
 * check's write lands → second check sees empty alreadyUnlocked → both
 * push the same toast). Concurrent callers all await the same promise.
 */

import { getTodayKey } from "./date";
import { checkAllAchievements, type AppState } from "./achievement-checker";
import { useAchievementStore } from "../stores/useAchievementStore";
import { logError } from "./error-log";
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
import { sqliteCount } from "../db/sqlite/service-helpers";
import { getProfile } from "../services/profile";
import { getProgression } from "../services/progression";
import { getProtocolSession } from "../services/protocol";
import type { QueryClient } from "@tanstack/react-query";
import { achievementsKeys } from "../hooks/queries/useAchievements";

async function gatherAppState(): Promise<AppState> {
  const todayKey = getTodayKey();

  const [profile, session, progression, tasks, completions, totalCompletionsCount] =
    await Promise.all([
      getProfile(),
      getProtocolSession(todayKey),
      getProgression(),
      listTasks(),
      listCompletionsForDate(todayKey),
      sqliteCount("completions"),
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
    totalCompletionsCount,
  };
}

// Single-flight guard — if a check is already in progress, any new
// callers join the same promise rather than spinning up a parallel run.
// Resets on completion so the next mutation's onSettled is independent.
let inFlight: Promise<void> | null = null;

export async function runAchievementCheck(
  queryClient?: QueryClient,
): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = runOnce(queryClient).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runOnce(queryClient?: QueryClient): Promise<void> {
  let appState: AppState;
  let unlockedRows: Awaited<ReturnType<typeof listUnlockedAchievements>>;
  try {
    [appState, unlockedRows] = await Promise.all([
      gatherAppState(),
      listUnlockedAchievements(),
    ]);
  } catch (e) {
    // Can't evaluate without state — surface to Sentry so we notice if
    // auth/SQLite is broken, but don't interrupt the user's action.
    logError("achievement.gatherState", e);
    return;
  }

  const alreadyUnlocked = new Set(
    unlockedRows.map((row) => row.achievement_id),
  );

  const pending = checkAllAchievements(appState, alreadyUnlocked);
  if (pending.length === 0) return;

  // Persist BEFORE pushing the celebration — a toast that fires without
  // a backing SQLite row would re-fire on the next check, forever.
  try {
    await insertUnlockedAchievements(pending.map((p) => p.id));
  } catch (e) {
    logError("achievement.insert", e, {
      ids: pending.map((p) => p.id),
    });
    return;
  }

  const store = useAchievementStore.getState();
  for (const p of pending) {
    store.pushCelebration(p.def);
  }

  if (queryClient) {
    queryClient.invalidateQueries({ queryKey: achievementsKeys.unlocked });
  }
}

/** Test-only: drain the single-flight guard between tests. */
export function _resetAchievementCheckForTests(): void {
  inFlight = null;
}
