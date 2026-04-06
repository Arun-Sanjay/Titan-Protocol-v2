/**
 * Surprise Engine — Random event system for mid-session engagement.
 *
 * Triggers unpredictable events on app open to break routine:
 *   - EMERGENCY_OP: Bonus task for weakest engine with 2-hour deadline
 *   - BONUS_CHALLENGE: Opt-in extra objective for 2x XP
 *   - PROTOCOL_TRANSMISSION: Random motivational voice message (passive)
 *   - DOUBLE_XP_WINDOW: 30-minute all-completions-worth-2x window
 *
 * Rules:
 *   - Grace period: Days 1-7 excluded (onboarding)
 *   - Max 1 surprise per day
 *   - 8-hour minimum cooldown between surprises
 *   - Time window: 10am-8pm only
 *   - Base probability ~30%, modified by streak + consistency
 */

import { getJSON, setJSON } from "../db/storage";
import { getTodayKey } from "./date";
import { getDayNumber } from "../data/chapters";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SurpriseType =
  | "EMERGENCY_OP"
  | "BONUS_CHALLENGE"
  | "PROTOCOL_TRANSMISSION"
  | "DOUBLE_XP_WINDOW";

export type Surprise = {
  type: SurpriseType;
  voiceId: string;
  title: string;
  subtitle: string;
  message: string;
  /** Whether the user can accept/dismiss (false = passive, auto-dismiss) */
  actionable: boolean;
  /** Duration in ms for time-limited types (DOUBLE_XP_WINDOW) */
  durationMs?: number;
  /** Bonus XP for completing (EMERGENCY_OP, BONUS_CHALLENGE) */
  bonusXP?: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const LAST_SURPRISE_KEY = "surprise_last_timestamp";
const SURPRISE_TODAY_KEY_PREFIX = "surprise_fired_";
const COOLDOWN_HOURS = 8;
const GRACE_PERIOD_DAYS = 7;
const BASE_PROBABILITY = 0.30;

// Weighted type selection (must sum to 1.0)
const TYPE_WEIGHTS: { type: SurpriseType; weight: number }[] = [
  { type: "PROTOCOL_TRANSMISSION", weight: 0.40 },
  { type: "BONUS_CHALLENGE", weight: 0.25 },
  { type: "DOUBLE_XP_WINDOW", weight: 0.20 },
  { type: "EMERGENCY_OP", weight: 0.15 },
];

// Voice line pools per type (randomly selected)
const VOICE_POOLS: Record<SurpriseType, string[]> = {
  EMERGENCY_OP: ["SURP-EMRG-001", "SURP-EMRG-002", "SURP-EMRG-003"],
  BONUS_CHALLENGE: ["SURP-BONUS-001", "SURP-BONUS-002", "SURP-BONUS-003"],
  PROTOCOL_TRANSMISSION: ["SURP-TRANS-001", "SURP-TRANS-002", "SURP-TRANS-003", "SURP-TRANS-004"],
  DOUBLE_XP_WINDOW: ["SURP-2XP-001", "SURP-2XP-002"],
};

// ─── Surprise templates ───────────────────────────────────────────────────────

function buildSurprise(type: SurpriseType): Surprise {
  const pool = VOICE_POOLS[type];
  const voiceId = pool[Math.floor(Math.random() * pool.length)];

  switch (type) {
    case "EMERGENCY_OP":
      return {
        type,
        voiceId,
        title: "EMERGENCY OPERATION",
        subtitle: "Weakest engine critical",
        message: "Your weakest engine needs immediate attention. Complete a bonus task within 2 hours for extra XP.",
        actionable: true,
        bonusXP: 50,
      };

    case "BONUS_CHALLENGE":
      return {
        type,
        voiceId,
        title: "BONUS CHALLENGE",
        subtitle: "Momentum detected",
        message: "Your consistency triggered a bonus objective. Accept it for double XP on completion.",
        actionable: true,
        bonusXP: 40,
      };

    case "PROTOCOL_TRANSMISSION":
      return {
        type,
        voiceId,
        title: "PROTOCOL TRANSMISSION",
        subtitle: "Incoming message",
        message: "The Protocol has something to say.",
        actionable: false,
      };

    case "DOUBLE_XP_WINDOW":
      return {
        type,
        voiceId,
        title: "DOUBLE XP ACTIVE",
        subtitle: "30-minute window",
        message: "All task completions are worth double experience for the next 30 minutes. Move fast.",
        actionable: true,
        durationMs: 30 * 60 * 1000, // 30 minutes
      };
  }
}

// ─── Trigger Logic ────────────────────────────────────────────────────────────

/**
 * Check if a surprise should fire. Call on every app open.
 * Returns a Surprise object if one should fire, null otherwise.
 */
export function checkForSurprise(streak: number, consistencyRate: number): Surprise | null {
  const now = Date.now();
  const today = getTodayKey();
  const hour = new Date().getHours();

  // 1. Time window: 10am-8pm only
  if (hour < 10 || hour >= 20) return null;

  // 2. Grace period: no surprises during days 1-7
  const firstActiveDate = getJSON<string | null>("first_active_date", null);
  const dayNumber = getDayNumber(firstActiveDate);
  if (dayNumber <= GRACE_PERIOD_DAYS) return null;

  // 3. Already fired today
  const todayKey = `${SURPRISE_TODAY_KEY_PREFIX}${today}`;
  if (getJSON<boolean>(todayKey, false)) return null;

  // 4. Cooldown: 8 hours since last surprise
  const lastTimestamp = getJSON<number>(LAST_SURPRISE_KEY, 0);
  const hoursSinceLast = (now - lastTimestamp) / (1000 * 60 * 60);
  if (hoursSinceLast < COOLDOWN_HOURS) return null;

  // 5. Probability roll (modified by streak + consistency)
  let probability = BASE_PROBABILITY;

  // Streak bonus: higher streaks = slightly more surprises (reward engagement)
  if (streak >= 14) probability += 0.10;
  else if (streak >= 7) probability += 0.05;

  // Consistency bonus
  if (consistencyRate >= 80) probability += 0.05;

  // Cap at 50%
  probability = Math.min(probability, 0.50);

  if (Math.random() > probability) return null;

  // 6. Select type via weighted random
  const roll = Math.random();
  let cumulative = 0;
  let selectedType: SurpriseType = "PROTOCOL_TRANSMISSION";

  for (const { type, weight } of TYPE_WEIGHTS) {
    cumulative += weight;
    if (roll <= cumulative) {
      selectedType = type;
      break;
    }
  }

  // 7. Mark as fired
  setJSON(LAST_SURPRISE_KEY, now);
  setJSON(todayKey, true);

  return buildSurprise(selectedType);
}

/**
 * Check if Double XP is currently active.
 */
export function isDoubleXPActive(): boolean {
  const expiresAt = getJSON<number>("surprise_double_xp_expires", 0);
  return Date.now() < expiresAt;
}

/**
 * Activate the Double XP window for 30 minutes.
 */
export function activateDoubleXP(): void {
  const expiresAt = Date.now() + 30 * 60 * 1000;
  setJSON("surprise_double_xp_expires", expiresAt);
}

/**
 * Get remaining Double XP time in milliseconds (0 if expired).
 */
export function getDoubleXPRemainingMs(): number {
  const expiresAt = getJSON<number>("surprise_double_xp_expires", 0);
  return Math.max(0, expiresAt - Date.now());
}
