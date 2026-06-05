/**
 * Rank ladder for the web rank-up system.
 *
 * The 8-tier progression NAMES are lifted from the Classic mobile app
 * (`mobile/src/lib/ranks-v2.ts`) — names + colors only; the level thresholds
 * here are web-specific and tunable. This is web-local on purpose: it leaves
 * the shared 6-tier `RANKS` (`@titan/shared/db/gamification`) untouched so
 * other surfaces/tests that assume it keep working.
 */
import { XP_PER_LEVEL } from "./xp-math";

export interface Rank {
  name: string;
  /** Lowest level at which this rank is shown. */
  minLevel: number;
  /** Accent color (matches Classic's RANK_COLORS). */
  color: string;
}

/** Ascending ladder. Climbed via level (500 XP/level). Thresholds tunable. */
export const RANKS_V2: readonly Rank[] = [
  { name: "Initiate", minLevel: 1, color: "#6B7280" },
  { name: "Operative", minLevel: 4, color: "#9CA3AF" },
  { name: "Agent", minLevel: 8, color: "#A78BFA" },
  { name: "Specialist", minLevel: 13, color: "#60A5FA" },
  { name: "Commander", minLevel: 19, color: "#34D399" },
  { name: "Vanguard", minLevel: 26, color: "#FBBF24" },
  { name: "Sentinel", minLevel: 34, color: "#F97316" },
  { name: "Titan", minLevel: 43, color: "#FF4444" },
] as const;

/** Highest rank whose `minLevel <= level`. */
export function rankForLevel(level: number): Rank {
  for (let i = RANKS_V2.length - 1; i >= 0; i--) {
    if (level >= RANKS_V2[i]!.minLevel) return RANKS_V2[i]!;
  }
  return RANKS_V2[0]!;
}

/** The next rank above the current level, or `null` at max rank. */
export function nextRank(level: number): Rank | null {
  return RANKS_V2.find((r) => r.minLevel > level) ?? null;
}

/** 0-100 progress through the current level toward the next (500 XP/level). */
export function levelProgressPct(xp: number): number {
  return Math.round(((Math.max(xp, 0) % XP_PER_LEVEL) / XP_PER_LEVEL) * 100);
}
