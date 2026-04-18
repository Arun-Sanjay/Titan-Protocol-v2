/**
 * Exponential backoff — next-attempt scheduling for the outbox. Capped
 * at `MAX_DELAY_MS` so a long-running offline spell doesn't push the
 * next attempt into next week.
 *
 * Schedule:
 *   attempt 0 →   5 s
 *   attempt 1 →  15 s
 *   attempt 2 →  45 s
 *   attempt 3 → 2.25 min
 *   attempt 4 → 6.75 min
 *   attempt 5 → 20 min
 *   attempt 6 → 60 min (cap)
 *
 * A small jitter (±20%) is added so a cohort of mutations doesn't pile
 * onto Supabase in lockstep after an outage ends.
 */

const BASE_DELAY_MS = 5_000;
const GROWTH = 3;
const MAX_DELAY_MS = 60 * 60 * 1000;

export function backoffMs(attempts: number): number {
  const raw = BASE_DELAY_MS * Math.pow(GROWTH, Math.max(0, attempts));
  const capped = Math.min(raw, MAX_DELAY_MS);
  const jitter = capped * (0.8 + Math.random() * 0.4);
  return Math.round(jitter);
}

/** Returns an ISO-8601 timestamp `ms` from now (UTC). */
export function isoPlus(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

/** Attempt threshold beyond which a mutation is surfaced as "needs manual retry". */
export const MAX_ATTEMPTS = 20;
