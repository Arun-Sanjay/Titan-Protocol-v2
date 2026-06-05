/**
 * Pure XP / streak math for the rank-up system. No DB, no React — fully
 * unit-tested in `__tests__/xp-math.test.ts`. The DB-aware award + streak
 * settlement live in `services/xp.ts`; this file is the single source of the
 * numbers so the rules stay consistent and testable.
 *
 * Mirrors web's `web/src/lib/xp-math.ts` exactly — keep the two in lockstep so
 * a task earns the same XP on every platform.
 */

export type TaskKind = "main" | "secondary";

/** XP per level — matches the existing `profiles.level = floor(xp/500)+1` rule. */
export const XP_PER_LEVEL = 500;

/** Only the first N task completions per day earn XP (the 11th+ earn nothing). */
export const DAILY_XP_TASK_CAP = 10;

/** A day counts toward the streak when its overall Titan score is >= this %. */
export const STREAK_CONSISTENCY_THRESHOLD = 60;

/** Base XP for a task before the streak multiplier. Main is worth 2x a
 *  secondary, mirroring the 2:1 scoring weight in `lib/scoring.ts`. */
export function baseXpForKind(kind: TaskKind): number {
  return kind === "secondary" ? 10 : 20;
}

/**
 * Streak multiplier: 1x at streak 0, +0.2x per streak day, **capped at 3x**
 * (reached at a 10-day streak). Rounded to 2 decimals so stored/compared
 * values are clean (avoids float drift like 1.6000000000000001).
 */
export function streakMultiplier(streak: number): number {
  const capped = Math.min(Math.max(streak, 0), 10);
  return Math.round((1 + capped * 0.2) * 100) / 100;
}

/** Final XP for one task completion at a given streak. */
export function xpForTask(kind: TaskKind, streak: number): number {
  return Math.round(baseXpForKind(kind) * streakMultiplier(streak));
}

/** Level for a total XP amount. */
export function levelForXp(xp: number): number {
  return Math.floor(Math.max(xp, 0) / XP_PER_LEVEL) + 1;
}

/**
 * One day's effect on the streak: continue (+1) if the day was consistent
 * (Titan score >= threshold), else reset to 0. Pure fold used by the
 * settlement loop in `services/xp.ts`.
 */
export function foldStreak(prevStreak: number, dayPercent: number): number {
  return dayPercent >= STREAK_CONSISTENCY_THRESHOLD ? prevStreak + 1 : 0;
}
