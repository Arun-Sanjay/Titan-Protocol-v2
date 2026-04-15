/**
 * Edge case safety utilities
 *
 * Handles MMKV corruption, missing data, date consistency,
 * and protocol interruption recovery.
 */

import { getJSON, setJSON } from "../db/storage";
import { getTodayKey } from "./date";
import { useProtocolStore } from "../stores/useProtocolStore";
import { useProgressionStore } from "../stores/useProgressionStore";
import { useQuestStore } from "../stores/useQuestStore";
import { useIdentityStore } from "../stores/useIdentityStore";

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
 * - Handles missed streak resets
 */
export function handleAppOpenAfterGap(): void {
  const today = getTodayKey();
  const dayOfWeek = new Date(today + "T00:00:00").getDay();

  // Check if quests need generation (Monday = 1)
  if (dayOfWeek === 1) {
    const questStore = useQuestStore.getState();
    if (questStore.weeklyQuests.length === 0) {
      const phase = useProgressionStore.getState().currentPhase;
      const identity = useIdentityStore.getState().archetype ?? "operator";
      questStore.generateWeeklyQuests(phase, identity);
    }
  }

  // Check phase advancement
  useProgressionStore.getState().checkWeekAdvancement();

  // Refresh protocol status for today
  useProtocolStore.getState().checkTodayStatus();
}

// ─── Protocol Interruption ──────────────────────────────────────────────────

/**
 * Check if a protocol was interrupted (started but not finished).
 * Returns true if there's an active protocol that should be resumed or restarted.
 */
export function checkProtocolInterruption(): { interrupted: boolean; canResume: boolean } {
  const store = useProtocolStore.getState();
  const today = getTodayKey();

  if (store.isActive && store.startedAt === today) {
    // Active protocol from today — can resume
    return { interrupted: true, canResume: true };
  }

  if (store.isActive && store.startedAt !== today) {
    // Active protocol from a previous day — can't resume, reset
    store.resetDaily();
    return { interrupted: true, canResume: false };
  }

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
