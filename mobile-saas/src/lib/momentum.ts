/**
 * Momentum Amplifier System
 *
 * XP multiplier that increases with consecutive protocol completions.
 *
 * Tiers:
 *   0-2 days  → 1.0x  (BASE)
 *   3-6 days  → 1.25x (MOMENTUM BUILDING)
 *   7-13 days → 1.5x  (MOMENTUM LOCKED)
 *   14-29 days → 1.75x (OVERDRIVE)
 *   30+ days  → 2.0x  (MAXIMUM OUTPUT)
 *
 * Breaking streak resets multiplier to 1.0x.
 */

import { getJSON, setJSON } from "../db/storage";

// ─── Types ───────────────────────────────────────────────────────────────────

export type MomentumTier =
  | "BASE"
  | "MOMENTUM_BUILDING"
  | "MOMENTUM_LOCKED"
  | "OVERDRIVE"
  | "MAXIMUM_OUTPUT";

export type MomentumState = {
  multiplier: number;
  tier: MomentumTier;
  tierLabel: string;
  consecutiveDays: number;
  nextTierAt: number | null;  // days needed for next tier, null if maxed
};

// ─── Constants ───────────────────────────────────────────────────────────────

const TIERS: { minDays: number; multiplier: number; tier: MomentumTier; label: string }[] = [
  { minDays: 30, multiplier: 2.0, tier: "MAXIMUM_OUTPUT", label: "MAXIMUM OUTPUT" },
  { minDays: 14, multiplier: 1.75, tier: "OVERDRIVE", label: "OVERDRIVE" },
  { minDays: 7, multiplier: 1.5, tier: "MOMENTUM_LOCKED", label: "MOMENTUM LOCKED" },
  { minDays: 3, multiplier: 1.25, tier: "MOMENTUM_BUILDING", label: "MOMENTUM BUILDING" },
  { minDays: 0, multiplier: 1.0, tier: "BASE", label: "BASE" },
];

// ─── Core ────────────────────────────────────────────────────────────────────

export function getMomentum(consecutiveDays: number): MomentumState {
  const currentTier = TIERS.find((t) => consecutiveDays >= t.minDays) ?? TIERS[TIERS.length - 1];
  const nextTierIdx = TIERS.indexOf(currentTier) - 1;
  const nextTier = nextTierIdx >= 0 ? TIERS[nextTierIdx] : null;

  return {
    multiplier: currentTier.multiplier,
    tier: currentTier.tier,
    tierLabel: currentTier.label,
    consecutiveDays,
    nextTierAt: nextTier ? nextTier.minDays - consecutiveDays : null,
  };
}

/**
 * Apply momentum multiplier to an XP amount.
 */
export function applyMomentum(baseXP: number, consecutiveDays: number): {
  finalXP: number;
  multiplier: number;
  bonusXP: number;
} {
  const { multiplier } = getMomentum(consecutiveDays);
  const finalXP = Math.round(baseXP * multiplier);
  return {
    finalXP,
    multiplier,
    bonusXP: finalXP - baseXP,
  };
}

/**
 * Get the color for the momentum tier (for UI glow effects).
 */
export function getMomentumColor(tier: MomentumTier): string {
  switch (tier) {
    case "MAXIMUM_OUTPUT": return "#F97316";   // orange
    case "OVERDRIVE": return "#FBBF24";        // amber
    case "MOMENTUM_LOCKED": return "#34D399";  // green
    case "MOMENTUM_BUILDING": return "#60A5FA"; // blue
    case "BASE": return "#6B7280";             // gray
  }
}
