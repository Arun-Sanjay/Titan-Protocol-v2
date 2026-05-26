/**
 * Identity-weighted Titan Score calculation
 *
 * In most modes, the Titan Score is a weighted average of engine scores
 * based on the user's identity archetype. In Titan Mode, all engines
 * are equally weighted at 25%.
 */

import type { Archetype } from "../stores/useIdentityStore";

// ─── Weight lookup (duplicated from store to keep lib pure) ─────────────────

const ENGINE_WEIGHTS: Record<Archetype, Record<string, number>> = {
  titan:    { body: 0.25, mind: 0.25, money: 0.25, charisma: 0.25 },
  athlete:  { body: 0.40, mind: 0.20, money: 0.15, charisma: 0.25 },
  scholar:  { body: 0.15, mind: 0.45, money: 0.15, charisma: 0.25 },
  hustler:  { body: 0.15, mind: 0.25, money: 0.40, charisma: 0.20 },
  showman:  { body: 0.15, mind: 0.20, money: 0.20, charisma: 0.45 },
  warrior:  { body: 0.30, mind: 0.35, money: 0.15, charisma: 0.20 },
  founder:  { body: 0.10, mind: 0.30, money: 0.40, charisma: 0.20 },
  charmer:  { body: 0.30, mind: 0.10, money: 0.15, charisma: 0.45 },
};

const EQUAL_WEIGHTS: Record<string, number> = { body: 0.25, mind: 0.25, money: 0.25, charisma: 0.25 };

// ─── Public API ─────────────────────────────────────────────────────────────
//
// Phase 2.2: removed the dead `calculateRank(score)` function and its
// `RANK_THRESHOLDS` constant. Both duplicated `getDailyRank` from
// `db/gamification.ts`, which is the version that 6 production files
// already import. There's no replacement needed — call sites should
// use `getDailyRank(score).letter` for the D-SS grade and
// `getDailyRank(score).color` for the display color.

/**
 * Calculate the weighted Titan Score.
 *
 * @param engineScores — Map of engine key to score (0-100)
 * @param identity — Current archetype (null = equal weights)
 * @param isTitanMode — If true, forces equal 25% weighting regardless of identity
 * @param activeEngines — If provided (Focus mode), only these engines contribute.
 *                        Weights are renormalized to sum to 1.
 */
export function calculateWeightedTitanScore(
  engineScores: Record<string, number>,
  identity: Archetype | null,
  isTitanMode: boolean = false,
  activeEngines?: string[],
): number {
  const baseWeights = isTitanMode || !identity
    ? EQUAL_WEIGHTS
    : ENGINE_WEIGHTS[identity] ?? EQUAL_WEIGHTS;

  // Filter to active engines if specified
  const engines = activeEngines ?? Object.keys(baseWeights);
  if (engines.length === 0) return 0;

  // Renormalize weights to sum to 1 for active engines
  let totalWeight = 0;
  for (const e of engines) {
    totalWeight += baseWeights[e] ?? 0;
  }
  if (totalWeight === 0) return 0;

  let weighted = 0;
  for (const e of engines) {
    const w = (baseWeights[e] ?? 0) / totalWeight;
    const score = engineScores[e] ?? 0;
    weighted += w * score;
  }

  return Math.round(weighted);
}

