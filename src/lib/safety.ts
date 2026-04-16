/**
 * Edge case safety utilities
 *
 * Handles MMKV corruption, missing data, date consistency,
 * and protocol interruption recovery.
 */

import { getJSON, setJSON } from "../db/storage";
import { useIdentityStore } from "../stores/useIdentityStore";
import {
  cachedActiveQuests,
  cachedCurrentPhase,
  cachedCurrentWeek,
} from "./cached-cloud";
import { generateWeeklyQuests } from "./quest-generator";
import { insertWeeklyQuests } from "../services/quests";
import { upsertProgression } from "../services/progression";
import { phaseFromWeek } from "../types/progression-ui";
import { queryClient } from "./query-client";
import { questsKeys } from "../hooks/queries/useQuests";
import { progressionKeys } from "../hooks/queries/useProgression";
import { logError } from "./error-log";

// ─── MMKV Safe Read ─────────────────────────────────────────────────────────

/**
 * Safe JSON read with corruption recovery.
 * If MMKV data is corrupted, returns the fallback and clears the key.
 */
export function safeGetJSON<T>(key: string, fallback: T): T {
  try {
    return getJSON<T>(key, fallback);
  } catch {
    // Corrupted — reset to fallback
    try {
      setJSON(key, fallback);
    } catch {
      // Can't write either — just return fallback
    }
    return fallback;
  }
}

// ─── Monday Gap Handler ─────────────────────────────────────────────────────

/**
 * Handle app open after a gap (especially crossing Monday).
 * - Generates weekly quests if Monday and none exist
 * - Checks phase advancement
 *
 * Protocol today-status no longer needs refresh — it's now derived
 * from the useProtocolSession(today) React Query cache.
 */
export function handleAppOpenAfterGap(): void {
  const today = new Date().toISOString().slice(0, 10);
  const dayOfWeek = new Date(today + "T00:00:00").getDay();

  // Check if quests need generation (Monday = 1)
  if (dayOfWeek === 1) {
    const active = cachedActiveQuests();
    if (active.length === 0) {
      const phase = cachedCurrentPhase();
      const identity = useIdentityStore.getState().archetype ?? "operator";
      const quests = generateWeeklyQuests(phase, identity);
      insertWeeklyQuests(quests)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: questsKeys.active });
        })
        .catch((e) => logError("safety.insertWeeklyQuests", e));
    }
  }

  // Phase advancement from cached week number.
  const week = cachedCurrentWeek();
  const derivedPhase = phaseFromWeek(week);
  if (derivedPhase !== cachedCurrentPhase()) {
    upsertProgression({ current_phase: derivedPhase })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: progressionKeys.all });
      })
      .catch((e) => logError("safety.upsertProgression", e));
  }
}

// ─── Protocol Interruption ──────────────────────────────────────────────────

/**
 * Legacy interruption check. The `isActive`/`startedAt` flags this
 * relied on were only ever MMKV state and never set to true, so this
 * function was always a no-op. Kept as an export to avoid breaking
 * callers; always returns { interrupted: false, canResume: false }.
 */
export function checkProtocolInterruption(): { interrupted: boolean; canResume: boolean } {
  return { interrupted: false, canResume: false };
}

// ─── Empty State Messages ───────────────────────────────────────────────────

export const EMPTY_STATES = {
  missions: {
    icon: "🎯",
    title: "No missions yet",
    hint: "Go to an engine and add your first mission",
  },
  habits: {
    icon: "🌱",
    title: "No habits yet",
    hint: "Start building your daily practice",
  },
  quests: {
    icon: "🏴",
    title: "No quests this week",
    hint: "Quests generate every Monday",
  },
  narrative: {
    icon: "📖",
    title: "Your story hasn't started",
    hint: "Complete your first protocol to begin",
  },
  achievements: {
    icon: "🏆",
    title: "No achievements yet",
    hint: "Keep showing up — they'll surprise you",
  },
  skillTree: {
    icon: "🌳",
    title: "Skill tree empty",
    hint: "Complete tasks to unlock nodes",
  },
  mindTraining: {
    icon: "🧠",
    title: "Ready to train",
    hint: "Start your first exercise",
  },
  journal: {
    icon: "📝",
    title: "No entries yet",
    hint: "Write your first reflection",
  },
} as const;

// ─── Date Validation ────────────────────────────────────────────────────────

/**
 * Validate a dateKey is in correct YYYY-MM-DD format.
 */
export function isValidDateKey(dateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  const d = new Date(dateKey + "T00:00:00");
  return !isNaN(d.getTime());
}
