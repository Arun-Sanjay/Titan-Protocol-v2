/**
 * SM-2 Spaced Repetition Algorithm
 *
 * Based on the SuperMemo 2 algorithm by Piotr Wozniak.
 * Quality ratings: 0-5 where 3+ is correct.
 */

import { getTodayKey, addDays } from "./date";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SRSCard = {
  exerciseId: string;
  interval: number;       // days until next review
  easeFactor: number;     // starts at 2.5, min 1.3
  repetitions: number;    // successful review count
  nextReview: string;     // dateKey for next review
  lastReview: string;     // dateKey of last review
};

export type SRSResult = {
  interval: number;
  easeFactor: number;
  repetitions: number;
  nextReview: string;
};

// ─── SM-2 Algorithm ─────────────────────────────────────────────────────────

/**
 * Calculate next review parameters using SM-2.
 *
 * @param card — Current card state
 * @param quality — 0-5 rating:
 *   5 = perfect, instant recall
 *   4 = correct, slight hesitation
 *   3 = correct, with difficulty
 *   2 = incorrect, but close
 *   1 = incorrect
 *   0 = complete blank
 */
export function calculateNextReview(card: SRSCard, quality: number): SRSResult {
  const today = getTodayKey();
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  let { interval, easeFactor, repetitions } = card;

  if (q >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    // Incorrect — reset
    repetitions = 0;
    interval = 1;
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  easeFactor = Math.max(1.3, easeFactor);

  const nextReview = addDays(today, interval);

  return {
    interval,
    easeFactor: Math.round(easeFactor * 100) / 100,
    repetitions,
    nextReview,
  };
}

// ─── Card Management ────────────────────────────────────────────────────────

/**
 * Create a new SRS card for a completed exercise.
 */
export function createSRSCard(exerciseId: string): SRSCard {
  const today = getTodayKey();
  return {
    exerciseId,
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    nextReview: addDays(today, 1), // Review tomorrow
    lastReview: today,
  };
}

/**
 * Get all cards due for review on or before today.
 */
export function getDueCards(cards: SRSCard[], today?: string): SRSCard[] {
  const dateKey = today ?? getTodayKey();
  return cards.filter((card) => card.nextReview <= dateKey);
}

/**
 * Convert quality from exercise result to SM-2 quality rating.
 *
 * @param correct — whether the answer was correct
 * @param timeSpentMs — how long the user took (optional)
 */
export function qualityFromResult(correct: boolean, timeSpentMs?: number): number {
  if (!correct) return 1;

  // Fast = 5, medium = 4, slow = 3
  if (timeSpentMs === undefined) return 4; // default: correct with slight hesitation

  if (timeSpentMs < 5000) return 5;   // < 5s = instant recall
  if (timeSpentMs < 15000) return 4;  // < 15s = slight hesitation
  return 3;                            // > 15s = correct with difficulty
}
