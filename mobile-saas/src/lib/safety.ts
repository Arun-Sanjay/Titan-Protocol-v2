/**
 * Edge case safety utilities
 *
 * Handles MMKV corruption, missing data, date consistency,
 * and protocol interruption recovery.
 */

import { getJSON, setJSON } from "../db/storage";
import { useIdentityStore } from "../stores/useIdentityStore";
import { generateWeeklyQuests } from "./quest-generator";
import { insertWeeklyQuests, listActiveQuests } from "../services/quests";
import {
  getProgression,
  upsertProgression,
} from "../services/progression";
import { phaseFromWeek } from "../types/progression-ui";
import { queryClient } from "./query-client";
import { questsKeys } from "../hooks/queries/useQuests";
import { progressionKeys } from "../hooks/queries/useProgression";
import { logError } from "./error-log";
import { getTodayKey } from "./date";

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
 * Handle app open / foreground / new-day. Reads SQLite directly (not the
 * React Query cache) so we don't race the cache hydration on cold start.
 *
 *   - Generates this week's quests if Monday and none active.
 *   - Advances `progression.current_phase` if the user's week number has
 *     crossed a phase boundary since the last app open.
 *
 * Idempotent: safe to call from app boot AND from app resume — the quest
 * insert is gated on `listActiveQuests().length === 0`, and the phase
 * upsert only writes when the derived phase actually differs.
 */
export async function handleAppOpenAfterGap(): Promise<void> {
  const today = getTodayKey();
  const dayOfWeek = new Date(today + "T00:00:00").getDay();

  // Quest generation — Monday only. Read live from SQLite (cache may
  // not be hydrated on cold start, which previously meant we generated
  // a duplicate set of quests on top of an existing one).
  if (dayOfWeek === 1) {
    try {
      const active = await listActiveQuests();
      if (active.length === 0) {
        const progression = await getProgression();
        const phase = progression?.current_phase ?? "foundation";
        const identity = useIdentityStore.getState().archetype ?? "operator";
        const quests = generateWeeklyQuests(phase, identity);
        if (quests.length > 0) {
          await insertWeeklyQuests(quests);
          queryClient.invalidateQueries({ queryKey: questsKeys.active });
        }
      }
    } catch (e) {
      logError("safety.insertWeeklyQuests", e);
    }
  }

  // Phase advancement — read live progression so we never derive against
  // a stale React Query cache.
  try {
    const progression = await getProgression();
    const week = progression?.current_week ?? 1;
    const currentPhase = progression?.current_phase ?? "foundation";
    const derivedPhase = phaseFromWeek(week);
    if (derivedPhase !== currentPhase) {
      await upsertProgression({ current_phase: derivedPhase });
      queryClient.invalidateQueries({ queryKey: progressionKeys.all });
    }
  } catch (e) {
    logError("safety.upsertProgression", e);
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
