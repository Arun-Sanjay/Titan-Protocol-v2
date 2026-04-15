// Phase 2.3: trimmed to the parts that still have consumers.
//
// What stays here:
//   - RANKS, DAILY_RANKS — XP-tier and daily-grade ladders (constants)
//   - getDailyRank(score) — 6 production callers (HQ, protocol, briefing,
//     ceremony, stat screen, power ring)
//   - getRankForLevel(level) — 4 production callers (profile, XPBar,
//     ceremony, stat screen)
//
// What was removed:
//   - getProfile, saveProfile, awardXP, updateStreak — these had moved
//     to useProfileStore (MMKV) and services/profile.ts (cloud); the
//     copies in this file were dead.
//   - XP_REWARDS — duplicated in useProfileStore.ts; that's the version
//     consumers actually import.
//   - XP_PER_LEVEL constant — only used by the deleted awardXP.

// Rank names and XP thresholds aligned with web version (CLAUDE.md)
// Initiate (0), Operator (500 XP), Specialist (1500 XP), Vanguard (3500 XP), Sentinel (7000 XP), Titan (15000 XP)
export const RANKS = [
  { name: "Initiate", minLevel: 1, color: "#6B7280" },    // 0 XP
  { name: "Operator", minLevel: 2, color: "#A78BFA" },    // 500 XP
  { name: "Specialist", minLevel: 4, color: "#60A5FA" },  // 1500 XP
  { name: "Vanguard", minLevel: 8, color: "#34D399" },    // 3500 XP
  { name: "Sentinel", minLevel: 15, color: "#FBBF24" },   // 7000 XP
  { name: "Titan", minLevel: 31, color: "#F97316" },      // 15000 XP
] as const;

export const DAILY_RANKS = [
  { letter: "D", min: 0, color: "#6B7280" },
  { letter: "C", min: 30, color: "#A78BFA" },
  { letter: "B", min: 50, color: "#60A5FA" },
  { letter: "A", min: 70, color: "#34D399" },
  { letter: "S", min: 85, color: "#FBBF24" },
  { letter: "SS", min: 95, color: "#F97316" },
] as const;

export function getDailyRank(score: number) {
  for (let i = DAILY_RANKS.length - 1; i >= 0; i--) {
    if (score >= DAILY_RANKS[i].min) return DAILY_RANKS[i];
  }
  return DAILY_RANKS[0];
}

export function getRankForLevel(level: number) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (level >= RANKS[i].minLevel) return RANKS[i];
  }
  return RANKS[0];
}

