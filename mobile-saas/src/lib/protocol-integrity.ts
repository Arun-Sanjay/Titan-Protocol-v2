/**
 * Protocol Integrity System
 *
 * Replaces raw "streak" with a forgiving, game-like integrity system.
 *
 * Integrity Levels (based on streak length):
 *   1-6   → INITIALIZING (grace period, no break penalty)
 *   7-13  → STABLE
 *   14-29 → FORTIFIED
 *   30-59 → HARDENED
 *   60+   → UNBREAKABLE
 *
 * Break Handling:
 *   Miss 1 day  → INTEGRITY WARNING  (streak paused, not reset — recover tomorrow)
 *   Miss 2 days → INTEGRITY BREACH   (streak reduced by 50%)
 *   Miss 3+ days → PROTOCOL RESET    (streak resets to 0)
 *
 * Recovery Mechanic:
 *   After a break, completing 3 consecutive days restores to floor(oldStreak * 0.75)
 */

import { getJSON, setJSON } from "../db/storage";
import { getTodayKey, addDays } from "./date";

// ─── Types ───────────────────────────────────────────────────────────────────

export type IntegrityLevel =
  | "INITIALIZING"
  | "STABLE"
  | "FORTIFIED"
  | "HARDENED"
  | "UNBREAKABLE";

export type IntegrityStatus =
  | "ACTIVE"          // streak continuing normally
  | "WARNING"         // missed 1 day, can recover tomorrow
  | "BREACH"          // missed 2 days, streak halved
  | "RESET"           // missed 3+ days, streak zeroed
  | "RECOVERING";     // in recovery period (3 days to restore)

export type IntegrityState = {
  streak: number;
  level: IntegrityLevel;
  status: IntegrityStatus;
  lastCompletionDate: string | null;
  /** Streak value before the last break (for recovery) */
  preBreakStreak: number;
  /** Consecutive days completed since last break (for recovery mechanic) */
  recoveryDays: number;
  /** Number of consecutive missed days */
  missedDays: number;
};

// ─── Storage Keys ────────────────────────────────────────────────────────────

const INTEGRITY_KEY = "protocol_integrity";
/**
 * Engagement-based day counter. Advances by 1 only on the first
 * `recordCompletion()` of a new local day, and is monotonic — a streak
 * BREACH or RESET zeroes the streak but never the progress day. So a
 * user who reaches Day 7 and disappears for a week comes back to Day 7,
 * not Day 14 (calendar-based) and not Day 1 (streak-based).
 *
 * Read via `getProgressDay()` from `data/chapters.ts`, advanced via
 * `recordCompletion()` below. The "Reset Progress" button in Settings
 * is the only thing that walks it back.
 */
const PROGRESS_DAY_KEY = "progress_day";

const DEFAULT_STATE: IntegrityState = {
  streak: 0,
  level: "INITIALIZING",
  status: "ACTIVE",
  lastCompletionDate: null,
  preBreakStreak: 0,
  recoveryDays: 0,
  missedDays: 0,
};

// ─── Progress Day ────────────────────────────────────────────────────────────

/**
 * Read the engagement-based day counter. Returns 1 on a fresh install.
 * Stays put when the user is away — only `recordCompletion()` (called
 * from task / protocol completion chokepoints) advances it, and only
 * once per local day.
 */
export function getProgressDay(): number {
  return Math.max(1, getJSON<number>(PROGRESS_DAY_KEY, 1));
}

/**
 * Stamp the progress day directly. Used by the "Reset Progress" action
 * to walk the counter back to 1, and by onboarding to seed it. Normal
 * advancement happens inside `recordCompletion()`.
 */
export function setProgressDay(day: number): void {
  setJSON(PROGRESS_DAY_KEY, Math.max(1, Math.floor(day)));
}

// ─── Level Calculation ───────────────────────────────────────────────────────

export function getIntegrityLevel(streak: number): IntegrityLevel {
  if (streak >= 60) return "UNBREAKABLE";
  if (streak >= 30) return "HARDENED";
  if (streak >= 14) return "FORTIFIED";
  if (streak >= 7) return "STABLE";
  return "INITIALIZING";
}

export function getIntegrityColor(level: IntegrityLevel): string {
  switch (level) {
    case "UNBREAKABLE": return "#F97316";  // orange
    case "HARDENED": return "#FBBF24";     // amber
    case "FORTIFIED": return "#34D399";    // green
    case "STABLE": return "#60A5FA";       // blue
    case "INITIALIZING": return "#A78BFA"; // purple
  }
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

export function loadIntegrity(): IntegrityState {
  return getJSON<IntegrityState>(INTEGRITY_KEY, DEFAULT_STATE);
}

/**
 * Called when the user has their first meaningful engagement of the
 * day (first task tick, morning protocol save, evening protocol save).
 * Returns the updated integrity state.
 *
 * Idempotent same-day: if `lastCompletionDate === today`, this is a
 * no-op. Cheap enough to call from every engagement chokepoint without
 * worrying about over-counting.
 *
 * Bumps `progress_day` exactly once per new local day. The progress day
 * is monotonic — a BREACH/RESET reduces the streak but does not touch
 * progress, so the narrative stays put when the user disappears.
 */
export function recordCompletion(): IntegrityState {
  const today = getTodayKey();
  const state = loadIntegrity();

  // Already completed today — leave both streak and progress untouched.
  if (state.lastCompletionDate === today) return state;

  // First engagement of a new local day — advance the monotonic
  // progress counter. Done OUTSIDE the streak/integrity branches below
  // so progress advances even on a BREACH/RESET return (e.g. user comes
  // back on calendar-day 14 after a 5-day gap on Day 7 → progress goes
  // 7 → 8, streak goes to RESET).
  //
  // The first-ever call (lastCompletionDate === null) is a special case:
  // onboarding has already seeded progress_day to 1, and we don't want
  // the user's first task tick to bump them to Day 2 on the same day.
  if (state.lastCompletionDate !== null) {
    setProgressDay(getProgressDay() + 1);
  }

  const yesterday = addDays(today, -1);
  const daysBefore = state.lastCompletionDate
    ? Math.max(0, Math.floor(
        (new Date(today + "T00:00:00").getTime() - new Date(state.lastCompletionDate + "T00:00:00").getTime()) / 86_400_000
      ) - 1)
    : 0;

  let newStreak = state.streak;
  let preBreakStreak = state.preBreakStreak;
  let recoveryDays = state.recoveryDays;
  let missedDays = 0;
  let status: IntegrityStatus = "ACTIVE";

  if (!state.lastCompletionDate || state.lastCompletionDate === yesterday) {
    // Consecutive day — normal increment
    newStreak = state.streak + 1;

    // Check recovery: if we were recovering and hit 3 consecutive days, restore
    if (state.status === "RECOVERING") {
      recoveryDays = state.recoveryDays + 1;
      if (recoveryDays >= 3 && preBreakStreak > newStreak) {
        // Recovery complete — restore to 75% of pre-break streak
        newStreak = Math.max(newStreak, Math.floor(preBreakStreak * 0.75));
        preBreakStreak = 0;
        recoveryDays = 0;
        status = "ACTIVE";
      } else {
        status = "RECOVERING";
      }
    }
  } else if (daysBefore === 1) {
    // Missed exactly 1 day — WARNING. Phase 1.3: do NOT advance the
    // streak on a missed day. The previous code did `state.streak + 1`
    // in BOTH branches, which contradicted the module header ("Miss 1
    // day → INTEGRITY WARNING (streak paused, not reset — recover
    // tomorrow)") and rewarded users for missing days. Now both
    // branches preserve the streak; the post-grace branch additionally
    // enters RECOVERING so the next consecutive day triggers the
    // recovery mechanic.
    if (state.streak <= 6) {
      // Grace period: pause, do not advance.
      newStreak = state.streak;
    } else {
      // Streak paused but not broken — preserve the value.
      newStreak = state.streak;
      status = "RECOVERING";
      recoveryDays = 1;
      preBreakStreak = state.streak;
    }
  } else if (daysBefore === 2) {
    // Missed 2 days — BREACH (50% reduction)
    preBreakStreak = state.streak;
    newStreak = Math.max(1, Math.floor(state.streak * 0.5));
    status = "RECOVERING";
    recoveryDays = 1;
  } else {
    // Missed 3+ days — PROTOCOL RESET
    preBreakStreak = state.streak;
    newStreak = 1;
    status = "RECOVERING";
    recoveryDays = 1;
  }

  const updated: IntegrityState = {
    streak: newStreak,
    level: getIntegrityLevel(newStreak),
    status,
    lastCompletionDate: today,
    preBreakStreak,
    recoveryDays,
    missedDays,
  };

  setJSON(INTEGRITY_KEY, updated);
  return updated;
}

/**
 * Check current integrity status (called on app open to detect missed days).
 */
export function checkIntegrityStatus(): IntegrityState & { warning?: string } {
  const state = loadIntegrity();
  if (!state.lastCompletionDate) return state;

  const today = getTodayKey();
  if (state.lastCompletionDate === today) return state;

  const daysMissed = Math.floor(
    (new Date(today + "T00:00:00").getTime() - new Date(state.lastCompletionDate + "T00:00:00").getTime()) / 86_400_000
  ) - 1;

  if (daysMissed <= 0) return state; // yesterday was last completion, no miss

  if (daysMissed === 1) {
    return {
      ...state,
      status: "WARNING",
      missedDays: 1,
      warning: "INTEGRITY WARNING: 1 day missed. Complete today to maintain streak.",
    };
  }
  if (daysMissed === 2) {
    return {
      ...state,
      status: "BREACH",
      missedDays: 2,
      warning: `INTEGRITY BREACH: 2 days missed. Streak will be reduced to ${Math.floor(state.streak * 0.5)}.`,
    };
  }
  return {
    ...state,
    status: "RESET",
    missedDays: daysMissed,
    warning: `PROTOCOL RESET: ${daysMissed} days missed. Streak will reset.`,
  };
}

// ─── Reset ───────────────────────────────────────────────────────────────────

/**
 * Wipe all narrative-progression state so the user can restart the
 * journey from Day 1. Called from the Settings "Reset Progress" action.
 *
 * Scope is deliberately narrow — this clears day/streak/integrity/story
 * flags only. Tasks, habits, journal, weight, sleep, etc. are kept; for
 * a full wipe the user uses "Delete All Data & Sign Out".
 */
export function resetProgress(): void {
  // Integrity + progress counter back to fresh-install defaults.
  setJSON(INTEGRITY_KEY, DEFAULT_STATE);
  setJSON(PROGRESS_DAY_KEY, 1);

  // Story / cinematic playback flags. We can't enumerate every key
  // template (Day cinematics, daily briefings, integrity-cinematic
  // markers, boss-cinematic markers) without coupling this module to
  // each producer, so we walk MMKV and prefix-match. These prefixes
  // are stable parts of the app's storage contract.
  const PREFIXES = [
    "cinematic_day_",
    "briefing_seen_",
    "integrity_cinematic_",
    "boss_cinematic_",
    "comeback_shown_",
  ];
  const SINGLE_KEYS = [
    "first_active_date",
    "max_day_reached",
    "protocol_streak",
    "story_flags",
    "story_current_act",
  ];

  // Lazy import so this module stays test-friendly (jest can mock
  // db/storage cheaply, and we don't want a circular dep at top level).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { storage } = require("../db/storage") as typeof import("../db/storage");
  const keys = storage.getAllKeys();
  for (const key of keys) {
    if (PREFIXES.some((p) => key.startsWith(p)) || SINGLE_KEYS.includes(key)) {
      storage.remove(key);
    }
  }
}
