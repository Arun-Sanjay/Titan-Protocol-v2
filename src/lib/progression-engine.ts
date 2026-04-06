/**
 * Phase advancement logic
 *
 * Foundation (weeks 1-4) → Building (weeks 5-8) → Intensify (weeks 9-12) → Sustain (13+)
 */

import { getJSON } from "../db/storage";
import { getTodayKey, addDays } from "./date";

export type Phase = "foundation" | "building" | "intensify" | "sustain";

export type PhaseAdvancementResult = {
  shouldAdvance: boolean;
  newPhase: Phase | null;
  stats: PhaseStats;
};

export type PhaseStats = {
  avgScore: number;
  daysCompleted: number;
  totalDays: number;
  bestStreak: number;
  bestRank: string;
};

// ─── Phase config ───────────────────────────────────────────────────────────

const PHASE_TRANSITIONS: Record<Phase, { advanceWeek: number; nextPhase: Phase | null }> = {
  foundation: { advanceWeek: 5, nextPhase: "building" },
  building: { advanceWeek: 9, nextPhase: "intensify" },
  intensify: { advanceWeek: 13, nextPhase: "sustain" },
  sustain: { advanceWeek: Infinity, nextPhase: null },
};

export function getPhaseWeekRange(phase: Phase): { start: number; end: number } {
  const ranges: Record<Phase, { start: number; end: number }> = {
    foundation: { start: 1, end: 4 },
    building: { start: 5, end: 8 },
    intensify: { start: 9, end: 12 },
    sustain: { start: 13, end: Infinity },
  };
  return ranges[phase];
}

// ─── Check advancement ──────────────────────────────────────────────────────

/**
 * Check if current phase should advance.
 * Call on Monday (weekly check) or on app open.
 */
export function checkPhaseAdvancement(
  currentPhase: Phase,
  currentWeek: number,
): PhaseAdvancementResult {
  const config = PHASE_TRANSITIONS[currentPhase];
  const stats = computePhaseStats(currentPhase, currentWeek);

  if (currentWeek >= config.advanceWeek && config.nextPhase) {
    return {
      shouldAdvance: true,
      newPhase: config.nextPhase,
      stats,
    };
  }

  return {
    shouldAdvance: false,
    newPhase: null,
    stats,
  };
}

// ─── Compute stats for phase period ─────────────────────────────────────────

function computePhaseStats(phase: Phase, currentWeek: number): PhaseStats {
  const range = getPhaseWeekRange(phase);
  const weeksInPhase = Math.min(currentWeek, range.end) - range.start + 1;
  const totalDays = weeksInPhase * 7;

  // Read protocol completions for the phase period
  const today = getTodayKey();
  let daysCompleted = 0;
  let totalScore = 0;
  let scoreDays = 0;
  let bestStreak = 0;
  let currentStreak = 0;
  let bestDailyScore = 0;

  // Scan last N days (phase duration)
  for (let i = totalDays - 1; i >= 0; i--) {
    const dk = addDays(today, -i);
    const completion = getJSON<{ completed: boolean; score: number } | null>(
      `protocol_completions:${dk}`,
      null,
    );

    if (completion && completion.completed) {
      daysCompleted++;
      totalScore += completion.score;
      scoreDays++;
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
      bestDailyScore = Math.max(bestDailyScore, completion.score);
    } else {
      currentStreak = 0;
    }
  }

  const avgScore = scoreDays > 0 ? Math.round(totalScore / scoreDays) : 0;

  // Determine best rank from best daily score
  let bestRank = "D";
  if (bestDailyScore >= 95) bestRank = "SS";
  else if (bestDailyScore >= 85) bestRank = "S";
  else if (bestDailyScore >= 70) bestRank = "A";
  else if (bestDailyScore >= 50) bestRank = "B";
  else if (bestDailyScore >= 30) bestRank = "C";

  return {
    avgScore,
    daysCompleted,
    totalDays,
    bestStreak,
    bestRank,
  };
}

/**
 * Get motivational text for entering a new phase.
 */
export function getPhaseMotivation(phase: Phase): string {
  const texts: Record<Phase, string> = {
    foundation: "Build the foundation. Show up every day. The bar is low — just start.",
    building: "The bar rises. Strengthen your weak engines. Push beyond comfortable.",
    intensify: "Peak performance territory. Test your limits. No more warming up.",
    sustain: "You've proven yourself. Now maintain, evolve, and never plateau.",
  };
  return texts[phase];
}

/**
 * Should run on Monday app open to check weekly advancement.
 */
export function weeklyProgressionCheck(): PhaseAdvancementResult | null {
  const dayOfWeek = new Date().getDay();
  // Only check on Monday (1) or first app open of the week
  if (dayOfWeek !== 1) return null;

  // This is a convenience wrapper — the actual check is done via useProgressionStore.checkWeekAdvancement()
  return null;
}
