/**
 * Achievement integration — fire-and-forget bridge (web).
 *
 * Gathers current app state from SQLite + the profile, reads the
 * authoritative set of already-unlocked IDs from SQLite, runs the checker,
 * persists any new unlocks cloud-first, THEN surfaces a toast, THEN
 * invalidates the React Query cache.
 *
 * Ordering matters (mirrors the mobile lesson): a toast that fires before
 * the write lands would re-fire forever, because the next check's
 * `alreadyUnlocked` set wouldn't include the un-persisted unlock. So we
 * persist first. A single-flight guard collapses overlapping runs from
 * rapid-fire completion taps onto one promise.
 *
 * Called from `useToggleCompletion` (and any future mutation that can move
 * an achievement condition) via `runAchievementCheck(queryClient)`.
 */
import type { QueryClient } from "@tanstack/react-query";

import { checkAllAchievements, type WebAppState } from "./achievement-checker";
import { getProfile } from "../services/profile";
import { sqliteCount } from "../db/sqlite/service-helpers";
import {
  insertUnlockedAchievements,
  listUnlockedAchievements,
} from "../services/achievements";
import { achievementsKeys } from "../hooks/queries/useAchievements";
import { logError } from "./error-log";
import { toast } from "./toast";

async function gatherAppState(): Promise<WebAppState> {
  const [profile, totalCompletionsCount, journalEntryCount] =
    await Promise.all([
      getProfile(),
      sqliteCount("completions"),
      sqliteCount("journal_entries"),
    ]);

  const streakCurrent = profile?.streak_current ?? 0;

  let dayNumber = 1;
  const firstUse = profile?.first_use_date;
  if (firstUse) {
    const start = new Date(`${firstUse}T00:00:00`);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!Number.isNaN(start.getTime())) {
      dayNumber = Math.max(
        1,
        Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1,
      );
    }
  }

  return { totalCompletionsCount, streakCurrent, dayNumber, journalEntryCount };
}

// Single-flight guard — overlapping callers join the same promise.
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
  let state: WebAppState;
  let unlockedRows: Awaited<ReturnType<typeof listUnlockedAchievements>>;
  try {
    [state, unlockedRows] = await Promise.all([
      gatherAppState(),
      listUnlockedAchievements(),
    ]);
  } catch (e) {
    // Can't evaluate without state — log, but never interrupt the user.
    logError("achievement.gatherState", e);
    return;
  }

  const alreadyUnlocked = new Set(unlockedRows.map((r) => r.achievement_id));
  const pending = checkAllAchievements(state, alreadyUnlocked);
  if (pending.length === 0) return;

  // Persist BEFORE the toast — a notification without a backing row would
  // re-fire on every subsequent check.
  try {
    await insertUnlockedAchievements(pending.map((p) => p.id));
  } catch (e) {
    logError("achievement.insert", e);
    return;
  }

  for (const p of pending) {
    toast.success(`🏆 Achievement unlocked — ${p.def.name}`, {
      duration: 6000,
    });
  }

  queryClient?.invalidateQueries({ queryKey: achievementsKeys.unlocked });
}
