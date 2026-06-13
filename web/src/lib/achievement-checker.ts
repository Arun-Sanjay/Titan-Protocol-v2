/**
 * Web achievement checker.
 *
 * The mobile checker reads a pile of MMKV `getJSON` keys
 * (`completions:engine:date`, `journal:date`, `protocol_completions:date`,
 * …) that simply don't exist on web — web keeps everything in SQLite. So
 * this is a web-native re-implementation that evaluates the condition
 * types whose data web actually has:
 *
 *   - `tasks_completed_total`  → lifetime row count in `completions`
 *   - `streak_days`            → `profiles.streak_current`
 *   - `protocol_completed`     → streak proxy (web has no protocol ritual)
 *   - `app_days_total`         → days since `profiles.first_use_date`
 *   - `journal_entries_total`  → row count in `journal_entries`
 *
 * Condition types that depend on mobile-only concepts (mind training,
 * skill trees, boss fights, quests, habit chains, engine-score windows)
 * evaluate to `false` for now — those achievements just won't unlock on
 * web yet. This is deliberate and visible (see `isSupportedOnWeb`), not a
 * silent gap: the Achievements screen marks unsupported ones so they don't
 * read as "locked, try harder" when they're actually "not wired on web".
 */
import achievementDefs from "../data/achievements.json";

export type AchDef = {
  id: string;
  name: string;
  description: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  xpReward: number;
  conditionType: string;
  conditionValue: number | string;
  conditionEngine?: string;
  conditionThreshold?: number;
  conditionTag?: string;
  iconName: string;
};

export const ALL_ACHIEVEMENTS = achievementDefs as AchDef[];

export type WebAppState = {
  totalCompletionsCount: number;
  streakCurrent: number;
  dayNumber: number;
  journalEntryCount: number;
};

/** Condition types web can currently evaluate from its own data. */
const SUPPORTED = new Set([
  "tasks_completed_total",
  "streak_days",
  "protocol_completed",
  "app_days_total",
  "journal_entries_total",
]);

export function isSupportedOnWeb(conditionType: string): boolean {
  return SUPPORTED.has(conditionType);
}

function evaluate(def: AchDef, s: WebAppState): boolean {
  const val = typeof def.conditionValue === "number" ? def.conditionValue : 0;
  switch (def.conditionType) {
    case "tasks_completed_total":
      return s.totalCompletionsCount >= val;
    case "streak_days":
    case "protocol_completed":
      // Web has no separate "protocol" ritual — the streak is the proxy.
      return s.streakCurrent >= val;
    case "app_days_total":
      return s.dayNumber >= val;
    case "journal_entries_total":
      return s.journalEntryCount >= val;
    default:
      return false; // not yet supported on web
  }
}

export type PendingUnlock = { id: string; def: AchDef };

/**
 * Evaluate every achievement against `state` and return defs for any that
 * newly qualify (not already in `alreadyUnlocked`). Pure — does not
 * persist or toast; the caller is responsible for ordering the write
 * before any UI so a failed write can't leave a ghost notification.
 */
export function checkAllAchievements(
  state: WebAppState,
  alreadyUnlocked: Set<string>,
): PendingUnlock[] {
  const pending: PendingUnlock[] = [];
  for (const def of ALL_ACHIEVEMENTS) {
    if (alreadyUnlocked.has(def.id)) continue;
    if (evaluate(def, state)) pending.push({ id: def.id, def });
  }
  return pending;
}
