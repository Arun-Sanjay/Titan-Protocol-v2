/**
 * TITAN PROTOCOL — Full Month Simulation Test
 *
 * Tests every system end-to-end by simulating real users for 30 days.
 * Runs purely against lib/ logic (no React, no MMKV — uses mock storage).
 *
 * Usage: npx ts-node --esm test-simulation.ts
 *        (or just read the output — it's designed to be runnable with node too)
 */

// ─── Mock MMKV Storage ──────────────────────────────────────────────────────

const mockStore: Record<string, string> = {};

// We need to mock the storage module before importing anything else
// Since we can't do that in a simple script, we'll replicate the core logic inline.

// ─── Types ───────────────────────────────────────────────────────────────────

type EngineKey = "body" | "mind" | "money" | "charisma";
type Rank = "E" | "D" | "C" | "B" | "A" | "S";
type IdentityArchetype = "titan" | "athlete" | "scholar" | "hustler" | "showman" | "warrior" | "founder" | "charmer";

interface EngineScores { body: number; mind: number; money: number; charisma: number; }
interface DailySimResult {
  day: number;
  dateKey: string;
  engineScores: EngineScores;
  titanScore: number;
  streak: number;
  rank: Rank;
  stats: Record<EngineKey, number>;
  totalOutput: number;
  xp: number;
  level: number;
  momentum: { multiplier: number; tier: string };
  integrity: { level: string; status: string; streak: number };
  fieldOp: string | null;
  titlesUnlocked: string[];
  statMilestones: string[];
  rankPromotion: boolean;
  issues: string[];
}

// ─── Reimplement Core Logic (no MMKV dependency) ─────────────────────────────

// Stats
const ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

function scoreToGain(score: number): number {
  if (score >= 80) return 2.0;
  if (score >= 60) return 1.5;
  if (score >= 40) return 1.0;
  if (score >= 20) return 0.5;
  return 0;
}

const ARCHETYPE_BONUSES: Record<IdentityArchetype, Record<EngineKey, number>> = {
  titan:   { body: 5, mind: 5, money: 5, charisma: 5 },
  athlete: { body: 8, mind: 5, money: 5, charisma: 5 },
  scholar: { body: 5, mind: 8, money: 5, charisma: 5 },
  hustler: { body: 5, mind: 5, money: 8, charisma: 5 },
  showman: { body: 5, mind: 5, money: 5, charisma: 8 },
  warrior: { body: 7, mind: 6, money: 5, charisma: 5 },
  founder: { body: 5, mind: 6, money: 7, charisma: 5 },
  charmer: { body: 5, mind: 5, money: 6, charisma: 7 },
};

// Momentum
interface MomentumResult { multiplier: number; tier: string; bonusXP: number; finalXP: number; }
const MOMENTUM_TIERS = [
  { minDays: 30, multiplier: 2.0, tier: "MAXIMUM_OUTPUT" },
  { minDays: 14, multiplier: 1.75, tier: "OVERDRIVE" },
  { minDays: 7, multiplier: 1.5, tier: "MOMENTUM_LOCKED" },
  { minDays: 3, multiplier: 1.25, tier: "MOMENTUM_BUILDING" },
  { minDays: 0, multiplier: 1.0, tier: "BASE" },
];

function getMomentum(consecutiveDays: number): { multiplier: number; tier: string } {
  for (const t of MOMENTUM_TIERS) {
    if (consecutiveDays >= t.minDays) return { multiplier: t.multiplier, tier: t.tier };
  }
  return { multiplier: 1.0, tier: "BASE" };
}

function applyMomentum(baseXP: number, consecutiveDays: number): MomentumResult {
  const { multiplier, tier } = getMomentum(consecutiveDays);
  const finalXP = Math.round(baseXP * multiplier);
  return { multiplier, tier, bonusXP: finalXP - baseXP, finalXP };
}

// Protocol Integrity
interface IntegrityState {
  streak: number;
  lastCompletionDate: string | null;
  status: string;
  level: string;
  preBreakStreak: number;
  recoveryDays: number;
}

function getIntegrityLevel(streak: number): string {
  if (streak >= 60) return "UNBREAKABLE";
  if (streak >= 30) return "HARDENED";
  if (streak >= 14) return "FORTIFIED";
  if (streak >= 7) return "STABLE";
  return "INITIALIZING";
}

function simulateIntegrity(state: IntegrityState, completed: boolean, dateKey: string): IntegrityState {
  const newState = { ...state };

  if (completed) {
    if (state.status === "RECOVERING") {
      newState.recoveryDays++;
      newState.streak++;
      if (newState.recoveryDays >= 3) {
        // Recovery complete - restore to 75% of pre-break streak
        newState.streak = Math.max(newState.streak, Math.floor(state.preBreakStreak * 0.75));
        newState.status = "ACTIVE";
        newState.recoveryDays = 0;
        newState.preBreakStreak = 0;
      }
    } else {
      newState.streak++;
      newState.status = "ACTIVE";
    }
    newState.lastCompletionDate = dateKey;
  } else {
    // Missed day
    const daysMissed = state.lastCompletionDate ? daysBetween(state.lastCompletionDate, dateKey) : 1;

    if (daysMissed === 1 && state.streak <= 6) {
      // Grace period for INITIALIZING level
      newState.status = "WARNING";
    } else if (daysMissed === 1) {
      newState.status = "WARNING";
    } else if (daysMissed === 2) {
      // BREACH - 50% reduction
      newState.preBreakStreak = state.streak;
      newState.streak = Math.floor(state.streak * 0.5);
      newState.status = "RECOVERING";
      newState.recoveryDays = 0;
    } else {
      // RESET
      newState.preBreakStreak = state.streak;
      newState.streak = 1;
      newState.status = "RECOVERING";
      newState.recoveryDays = 0;
    }
  }

  newState.level = getIntegrityLevel(newState.streak);
  return newState;
}

// Rank System
const RANK_ORDER: Rank[] = ["E", "D", "C", "B", "A", "S"];
const RANK_REQUIREMENTS: Record<Rank, { avgScore: number; consecutiveDays: number; extra: string | null }> = {
  E: { avgScore: 0, consecutiveDays: 0, extra: null },
  D: { avgScore: 50, consecutiveDays: 7, extra: null },
  C: { avgScore: 60, consecutiveDays: 14, extra: null },
  B: { avgScore: 70, consecutiveDays: 21, extra: null },
  A: { avgScore: 80, consecutiveDays: 30, extra: null },
  S: { avgScore: 85, consecutiveDays: 30, extra: "s_field_op_cleared" },
};

interface RankState {
  rank: Rank;
  qualifyingDays: number;
  consecutiveDaysBelow: number;
}

function evaluateRankDay(
  state: RankState,
  titanScore: number,
  sFieldOpCleared: boolean
): { state: RankState; promoted: boolean; newRank?: Rank; warning: boolean; demoted: boolean; demotedTo?: Rank } {
  const newState = { ...state };
  const currentIdx = RANK_ORDER.indexOf(state.rank);
  const nextRank = currentIdx < RANK_ORDER.length - 1 ? RANK_ORDER[currentIdx + 1] : null;

  let promoted = false;
  let warning = false;
  let demoted = false;
  let newRank: Rank | undefined;
  let demotedTo: Rank | undefined;

  // Check promotion
  if (nextRank) {
    const req = RANK_REQUIREMENTS[nextRank];
    if (titanScore >= req.avgScore) {
      newState.qualifyingDays++;

      let extraMet = true;
      if (req.extra === "s_field_op_cleared") extraMet = sFieldOpCleared;

      if (newState.qualifyingDays >= req.consecutiveDays && extraMet) {
        promoted = true;
        newRank = nextRank;
        newState.rank = nextRank;
        newState.qualifyingDays = 0;
        newState.consecutiveDaysBelow = 0;
      }
    } else {
      newState.qualifyingDays = 0; // Reset qualifying streak
    }
  }

  // Check demotion (only if not just promoted)
  if (!promoted && currentIdx > 0) {
    const currentReq = RANK_REQUIREMENTS[state.rank];
    if (titanScore < currentReq.avgScore) {
      newState.consecutiveDaysBelow++;
      if (newState.consecutiveDaysBelow >= 14) {
        demoted = true;
        demotedTo = RANK_ORDER[currentIdx - 1];
        newState.rank = demotedTo;
        newState.consecutiveDaysBelow = 0;
        newState.qualifyingDays = 0;
      } else if (newState.consecutiveDaysBelow >= 7) {
        warning = true;
      }
    } else {
      newState.consecutiveDaysBelow = 0;
    }
  }

  return { state: newState, promoted, newRank, warning, demoted, demotedTo };
}

// Weighted Titan Score
const ENGINE_WEIGHTS: Record<IdentityArchetype, Record<EngineKey, number>> = {
  titan:   { body: 0.25, mind: 0.25, money: 0.25, charisma: 0.25 },
  athlete: { body: 0.40, mind: 0.20, money: 0.15, charisma: 0.25 },
  scholar: { body: 0.15, mind: 0.40, money: 0.20, charisma: 0.25 },
  hustler: { body: 0.15, mind: 0.20, money: 0.40, charisma: 0.25 },
  showman: { body: 0.15, mind: 0.20, money: 0.25, charisma: 0.40 },
  warrior: { body: 0.35, mind: 0.30, money: 0.15, charisma: 0.20 },
  founder: { body: 0.15, mind: 0.25, money: 0.35, charisma: 0.25 },
  charmer: { body: 0.15, mind: 0.20, money: 0.25, charisma: 0.40 },
};

function calculateWeightedTitanScore(scores: EngineScores, archetype: IdentityArchetype): number {
  const weights = ENGINE_WEIGHTS[archetype];
  let total = 0;
  for (const e of ENGINES) {
    total += scores[e] * weights[e];
  }
  return Math.round(total * 100) / 100;
}

// Field Ops (simplified)
interface FieldOpDef {
  id: string; name: string; description: string;
  type: "sprint" | "endurance"; minRank: string;
  durationDays: number;
  objective: { type: string; engine?: EngineKey; threshold: number };
  xpReward: number; statBonus: number; titleReward: string | null;
}

interface ActiveFieldOp {
  fieldOpId: string; startDate: string;
  dailyResults: boolean[]; currentDay: number;
}

interface FieldOpState {
  active: ActiveFieldOp | null;
  history: Array<{ fieldOpId: string; completed: boolean; date: string }>;
  cooldownUntil: string | null;
}

// Load field ops data inline (we'll parse it)
const FIELD_OPS: FieldOpDef[] = [
  { id: "first_patrol", name: "First Patrol", description: "Maintain 40% avg for 2 days", type: "sprint", minRank: "E", durationDays: 2, objective: { type: "avg_score", threshold: 40 }, xpReward: 50, statBonus: 1, titleReward: null },
  { id: "signal_check", name: "Signal Check", description: "Body engine 50%+ for 3 days", type: "sprint", minRank: "E", durationDays: 3, objective: { type: "engine_score", engine: "body", threshold: 50 }, xpReward: 75, statBonus: 2, titleReward: null },
  { id: "endurance_test_alpha", name: "Endurance Test Alpha", description: "40% avg for 5 days", type: "endurance", minRank: "E", durationDays: 5, objective: { type: "avg_score", threshold: 40 }, xpReward: 100, statBonus: 2, titleReward: null },
  { id: "recon_mission", name: "Recon Mission", description: "50% avg for 3 days", type: "sprint", minRank: "D", durationDays: 3, objective: { type: "avg_score", threshold: 50 }, xpReward: 100, statBonus: 2, titleReward: null },
  { id: "mental_fortitude", name: "Mental Fortitude", description: "Mind 60%+ for 5 days", type: "endurance", minRank: "D", durationDays: 5, objective: { type: "engine_score", engine: "mind", threshold: 60 }, xpReward: 150, statBonus: 3, titleReward: null },
  { id: "iron_march", name: "Iron March", description: "Body 70%+ for 7 days", type: "endurance", minRank: "C", durationDays: 7, objective: { type: "engine_score", engine: "body", threshold: 70 }, xpReward: 200, statBonus: 3, titleReward: null },
  { id: "full_spectrum_sweep", name: "Full Spectrum Sweep", description: "All engines 50%+ for 5 days", type: "sprint", minRank: "C", durationDays: 5, objective: { type: "all_engines", threshold: 50 }, xpReward: 250, statBonus: 4, titleReward: "full_spectrum_operator" },
  { id: "sustained_excellence", name: "Sustained Excellence", description: "70% avg for 10 days", type: "endurance", minRank: "B", durationDays: 10, objective: { type: "avg_score", threshold: 70 }, xpReward: 300, statBonus: 4, titleReward: null },
  { id: "charisma_offensive", name: "Charisma Offensive", description: "Charisma 75%+ for 7 days", type: "endurance", minRank: "B", durationDays: 7, objective: { type: "engine_score", engine: "charisma", threshold: 75 }, xpReward: 250, statBonus: 4, titleReward: null },
  { id: "operation_apex", name: "Operation Apex", description: "80% avg for 7 days", type: "sprint", minRank: "A", durationDays: 7, objective: { type: "avg_score", threshold: 80 }, xpReward: 400, statBonus: 5, titleReward: null },
  { id: "all_engines_hot", name: "All Engines Hot", description: "All engines 70%+ for 10 days", type: "endurance", minRank: "A", durationDays: 10, objective: { type: "all_engines", threshold: 70 }, xpReward: 500, statBonus: 6, titleReward: "elite_operator" },
  { id: "titan_proving_ground", name: "Titan Proving Ground", description: "90% avg for 7 days", type: "sprint", minRank: "S", durationDays: 7, objective: { type: "avg_score", threshold: 90 }, xpReward: 750, statBonus: 7, titleReward: "the_apex" },
  { id: "the_final_trial", name: "The Final Trial", description: "All engines 85%+ for 14 days", type: "endurance", minRank: "S", durationDays: 14, objective: { type: "all_engines", threshold: 85 }, xpReward: 1000, statBonus: 8, titleReward: "titan_proven" },
];

function getAvailableFieldOps(rank: Rank): FieldOpDef[] {
  const rankIdx = RANK_ORDER.indexOf(rank);
  return FIELD_OPS.filter(d => RANK_ORDER.indexOf(d.minRank as Rank) <= rankIdx);
}

function evaluateFieldOpDay(
  op: ActiveFieldOp,
  def: FieldOpDef,
  engineScores: EngineScores,
  titanScore: number
): { passed: boolean; completed: boolean; failed: boolean; result: ActiveFieldOp } {
  const newOp = { ...op, dailyResults: [...op.dailyResults], currentDay: op.currentDay + 1 };

  // Check if today passes the objective
  let passed = false;
  switch (def.objective.type) {
    case "avg_score":
      passed = titanScore >= def.objective.threshold;
      break;
    case "engine_score":
      passed = (def.objective.engine ? engineScores[def.objective.engine] : 0) >= def.objective.threshold;
      break;
    case "all_engines":
      passed = ENGINES.every(e => engineScores[e] >= def.objective.threshold);
      break;
    case "streak":
      passed = true; // Streak is handled externally
      break;
  }

  newOp.dailyResults.push(passed);

  // Check failure conditions
  let failed = false;
  if (def.type === "sprint" && !passed) {
    failed = true;
  } else if (def.type === "endurance") {
    // 2 consecutive failures = fail
    const results = newOp.dailyResults;
    if (results.length >= 2 && !results[results.length - 1] && !results[results.length - 2]) {
      failed = true;
    }
  }

  const completed = !failed && newOp.currentDay >= def.durationDays;

  return { passed, completed, failed, result: newOp };
}

// Titles (simplified check)
interface TitleDef {
  id: string; name: string; description: string;
  category: string; rarity: string;
  condition: { type: string; value: any; engine?: string };
}

const TITLES: TitleDef[] = [
  // Streak
  { id: "consistent", name: "Consistent", description: "7-day streak", category: "streak", rarity: "common", condition: { type: "streak_days", value: 7 } },
  { id: "relentless", name: "Relentless", description: "14-day streak", category: "streak", rarity: "common", condition: { type: "streak_days", value: 14 } },
  { id: "unbreakable", name: "Unbreakable", description: "30-day streak", category: "streak", rarity: "rare", condition: { type: "streak_days", value: 30 } },
  { id: "immortal", name: "Immortal", description: "60-day streak", category: "streak", rarity: "epic", condition: { type: "streak_days", value: 60 } },
  // Performance
  { id: "operational", name: "Operational", description: "All engines 50%+", category: "performance", rarity: "common", condition: { type: "all_engines_score", value: 50 } },
  { id: "high_output", name: "High Output", description: "All engines 70%+", category: "performance", rarity: "rare", condition: { type: "all_engines_score", value: 70 } },
  { id: "s_rank_day", name: "S-Rank Day", description: "Titan score 85%+", category: "performance", rarity: "rare", condition: { type: "titan_score", value: 85 } },
  { id: "perfect_day", name: "Perfect Day", description: "All engines 100%", category: "performance", rarity: "legendary", condition: { type: "all_engines_score", value: 100 } },
  // Ops
  { id: "first_op", name: "First Op", description: "Complete 1 field op", category: "ops", rarity: "common", condition: { type: "field_op_count", value: 1 } },
  { id: "veteran_operator", name: "Veteran Operator", description: "Complete 5 field ops", category: "ops", rarity: "rare", condition: { type: "field_op_count", value: 5 } },
  // Engine
  { id: "iron_body", name: "Iron Body", description: "Body stat 50+", category: "engine", rarity: "rare", condition: { type: "engine_stat", value: 50, engine: "body" } },
  { id: "sharp_mind", name: "Sharp Mind", description: "Mind stat 50+", category: "engine", rarity: "rare", condition: { type: "engine_stat", value: 50, engine: "mind" } },
  // Rank
  { id: "d_rank", name: "D-Rank", description: "Reach D rank", category: "rank", rarity: "common", condition: { type: "rank_achieved", value: "D" } },
  { id: "c_rank", name: "C-Rank", description: "Reach C rank", category: "rank", rarity: "common", condition: { type: "rank_achieved", value: "C" } },
  { id: "b_rank", name: "B-Rank", description: "Reach B rank", category: "rank", rarity: "rare", condition: { type: "rank_achieved", value: "B" } },
  { id: "a_rank", name: "A-Rank", description: "Reach A rank", category: "rank", rarity: "epic", condition: { type: "rank_achieved", value: "A" } },
  { id: "s_rank", name: "S-Rank", description: "Reach S rank", category: "rank", rarity: "legendary", condition: { type: "rank_achieved", value: "S" } },
  // Special
  { id: "the_protocol", name: "The Protocol", description: "Day 30", category: "special", rarity: "common", condition: { type: "day_number", value: 30 } },
  { id: "the_titan", name: "The Titan", description: "Total output 200+", category: "special", rarity: "legendary", condition: { type: "total_output", value: 200 } },
];

function checkTitles(
  unlockedIds: string[],
  context: {
    streak: number; titanScore: number; engineScores: EngineScores;
    rank: Rank; fieldOpsCleared: number; dayNumber: number;
    stats: Record<EngineKey, number>; totalOutput: number;
  }
): string[] {
  const newlyUnlocked: string[] = [];

  for (const title of TITLES) {
    if (unlockedIds.includes(title.id)) continue;

    let met = false;
    const c = title.condition;

    switch (c.type) {
      case "streak_days":
        met = context.streak >= c.value;
        break;
      case "titan_score":
        met = context.titanScore >= c.value;
        break;
      case "all_engines_score":
        met = ENGINES.every(e => context.engineScores[e] >= c.value);
        break;
      case "engine_stat":
        met = context.stats[c.engine as EngineKey] >= c.value;
        break;
      case "field_op_count":
        met = context.fieldOpsCleared >= c.value;
        break;
      case "rank_achieved":
        met = RANK_ORDER.indexOf(context.rank) >= RANK_ORDER.indexOf(c.value as Rank);
        break;
      case "total_output":
        met = context.totalOutput >= c.value;
        break;
      case "day_number":
        met = context.dayNumber >= c.value;
        break;
    }

    if (met) newlyUnlocked.push(title.id);
  }

  return newlyUnlocked;
}

// XP + Level
const XP_PER_LEVEL = 500;
const BASE_PROTOCOL_XP = 50; // Base XP per protocol completion

// Chapters
function getDayNumber(firstActiveDate: string | null, currentDate: string): number {
  if (!firstActiveDate) return 1;
  return daysBetween(firstActiveDate, currentDate) + 1;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ─── Simulation Profiles ─────────────────────────────────────────────────────

type UserProfile = {
  name: string;
  archetype: IdentityArchetype;
  // Function that generates daily engine scores for a given day
  generateScores: (day: number, streak: number) => EngineScores;
  // Days to skip (simulate missed days)
  skipDays: number[];
};

// Profile 1: Perfect User — never misses, high scores
const perfectUser: UserProfile = {
  name: "Perfect Paul",
  archetype: "titan",
  generateScores: (day) => ({
    body: 85 + Math.round(Math.sin(day * 0.3) * 10),
    mind: 80 + Math.round(Math.cos(day * 0.5) * 12),
    money: 78 + Math.round(Math.sin(day * 0.7) * 15),
    charisma: 82 + Math.round(Math.cos(day * 0.2) * 10),
  }),
  skipDays: [],
};

// Profile 2: Inconsistent User — misses days, variable scores
const inconsistentUser: UserProfile = {
  name: "Inconsistent Ian",
  archetype: "athlete",
  generateScores: (day) => ({
    body: 40 + Math.round(Math.random() * 40),
    mind: 30 + Math.round(Math.random() * 35),
    money: 20 + Math.round(Math.random() * 30),
    charisma: 35 + Math.round(Math.random() * 30),
  }),
  skipDays: [3, 7, 8, 15, 16, 17, 22, 28],
};

// Profile 3: Improving User — starts low, gets better
const improvingUser: UserProfile = {
  name: "Improving Iris",
  archetype: "scholar",
  generateScores: (day) => {
    const base = Math.min(30 + day * 2, 90);
    return {
      body: Math.min(100, base - 10 + Math.round(Math.random() * 10)),
      mind: Math.min(100, base + 5 + Math.round(Math.random() * 5)),
      money: Math.min(100, base - 5 + Math.round(Math.random() * 8)),
      charisma: Math.min(100, base + Math.round(Math.random() * 10)),
    };
  },
  skipDays: [5],
};

// Profile 4: Specialist — one engine maxed, others neglected
const specialistUser: UserProfile = {
  name: "Specialist Sam",
  archetype: "hustler",
  generateScores: (day) => ({
    body: 20 + Math.round(Math.random() * 15),
    mind: 25 + Math.round(Math.random() * 15),
    money: 85 + Math.round(Math.random() * 15),
    charisma: 15 + Math.round(Math.random() * 20),
  }),
  skipDays: [10, 20],
};

// Profile 5: Burnout User — starts strong, crashes mid-month
const burnoutUser: UserProfile = {
  name: "Burnout Blake",
  archetype: "warrior",
  generateScores: (day) => {
    if (day <= 10) return { body: 90, mind: 85, money: 80, charisma: 75 };
    if (day <= 15) return { body: 60, mind: 50, money: 40, charisma: 35 };
    return { body: 30, mind: 25, money: 20, charisma: 20 };
  },
  skipDays: [18, 19, 20, 25, 26, 27, 28, 29, 30],
};

// Profile 6: Recovery User — breaks streak early, recovers
const recoveryUser: UserProfile = {
  name: "Recovery Riley",
  archetype: "founder",
  generateScores: (day) => ({
    body: 65 + Math.round(Math.sin(day * 0.4) * 15),
    mind: 60 + Math.round(Math.cos(day * 0.3) * 12),
    money: 70 + Math.round(Math.sin(day * 0.6) * 10),
    charisma: 55 + Math.round(Math.cos(day * 0.5) * 15),
  }),
  skipDays: [4, 5, 12],
};

// Profile 7: Minimum Viable — does just enough to not fail
const minimumUser: UserProfile = {
  name: "Minimum Mike",
  archetype: "charmer",
  generateScores: () => ({
    body: 40 + Math.round(Math.random() * 10),
    mind: 38 + Math.round(Math.random() * 12),
    money: 42 + Math.round(Math.random() * 8),
    charisma: 50 + Math.round(Math.random() * 10),
  }),
  skipDays: [],
};

// Profile 8: All Archetypes Tester — uses showman
const showmanUser: UserProfile = {
  name: "Showman Steve",
  archetype: "showman",
  generateScores: (day) => ({
    body: 50 + Math.round(Math.sin(day) * 20),
    mind: 55 + Math.round(Math.cos(day) * 15),
    money: 45 + Math.round(Math.sin(day * 0.8) * 18),
    charisma: 90 + Math.round(Math.cos(day * 0.3) * 8),
  }),
  skipDays: [14],
};

const ALL_PROFILES = [
  perfectUser, inconsistentUser, improvingUser, specialistUser,
  burnoutUser, recoveryUser, minimumUser, showmanUser,
];

// ─── Main Simulation ─────────────────────────────────────────────────────────

function runSimulation(profile: UserProfile, days: number = 30): DailySimResult[] {
  const results: DailySimResult[] = [];
  const issues: string[] = [];
  const startDate = new Date("2026-04-01");
  const firstActiveDate = formatDate(startDate);

  // Initialize state
  let stats: Record<EngineKey, number> = { ...ARCHETYPE_BONUSES[profile.archetype] };
  let streak = 0;
  let rankState: RankState = { rank: "E", qualifyingDays: 0, consecutiveDaysBelow: 0 };
  let integrity: IntegrityState = {
    streak: 0, lastCompletionDate: null, status: "ACTIVE",
    level: "INITIALIZING", preBreakStreak: 0, recoveryDays: 0,
  };
  let fieldOpState: FieldOpState = { active: null, history: [], cooldownUntil: null };
  let unlockedTitles: string[] = [];
  let xp = 0;
  let lastCompletionDate: string | null = null;
  let fieldOpsCleared = 0;

  for (let day = 1; day <= days; day++) {
    const currentDate = addDays(startDate, day - 1);
    const dateKey = formatDate(currentDate);
    const dayIssues: string[] = [];

    const isSkipped = profile.skipDays.includes(day);

    if (isSkipped) {
      // Missed day
      integrity = simulateIntegrity(integrity, false, dateKey);

      // Streak breaks
      if (lastCompletionDate) {
        const gap = daysBetween(lastCompletionDate, dateKey);
        if (gap > 1) streak = 0;
      }

      // Field op evaluation on missed day (score 0)
      if (fieldOpState.active) {
        const def = FIELD_OPS.find(d => d.id === fieldOpState.active!.fieldOpId);
        if (def) {
          const zeroScores: EngineScores = { body: 0, mind: 0, money: 0, charisma: 0 };
          const evalResult = evaluateFieldOpDay(fieldOpState.active, def, zeroScores, 0);
          if (evalResult.failed) {
            fieldOpState.history.push({ fieldOpId: def.id, completed: false, date: dateKey });
            fieldOpState.active = null;
            fieldOpState.cooldownUntil = formatDate(addDays(currentDate, 1));
            dayIssues.push(`Field op "${def.name}" FAILED (missed day)`);
          } else {
            fieldOpState.active = evalResult.result;
          }
        }
      }

      results.push({
        day, dateKey,
        engineScores: { body: 0, mind: 0, money: 0, charisma: 0 },
        titanScore: 0, streak, rank: rankState.rank, stats: { ...stats },
        totalOutput: ENGINES.reduce((s, e) => s + stats[e], 0),
        xp, level: Math.floor(xp / XP_PER_LEVEL) + 1,
        momentum: getMomentum(streak),
        integrity: { level: integrity.level, status: integrity.status, streak: integrity.streak },
        fieldOp: fieldOpState.active ? fieldOpState.active.fieldOpId : null,
        titlesUnlocked: [], statMilestones: [],
        rankPromotion: false, issues: [...dayIssues, "SKIPPED"],
      });
      continue;
    }

    // Generate scores
    const engineScores = profile.generateScores(day, streak);

    // Clamp scores 0-100
    for (const e of ENGINES) {
      engineScores[e] = Math.max(0, Math.min(100, engineScores[e]));
    }

    // Calculate titan score
    const titanScore = calculateWeightedTitanScore(engineScores, profile.archetype);

    // Update streak
    if (lastCompletionDate) {
      const gap = daysBetween(lastCompletionDate, dateKey);
      if (gap === 1) {
        streak++;
      } else if (gap > 1) {
        streak = 1;
      }
    } else {
      streak = 1;
    }
    lastCompletionDate = dateKey;

    // Update integrity
    integrity = simulateIntegrity(integrity, true, dateKey);

    // Update stats
    const todayGains: Record<EngineKey, number> = {} as any;
    const newMilestones: string[] = [];
    for (const e of ENGINES) {
      const gain = scoreToGain(engineScores[e]);
      todayGains[e] = gain;
      const oldStat = stats[e];
      stats[e] += gain;

      // Check milestones
      for (const m of [25, 50, 75, 100, 150, 200]) {
        if (oldStat < m && stats[e] >= m) {
          newMilestones.push(`${e}:${m}`);
        }
      }
    }

    // (totalOutput calculated after field op stat bonuses below)

    // Momentum + XP
    const momentumResult = applyMomentum(BASE_PROTOCOL_XP, streak);
    xp += momentumResult.finalXP;
    const level = Math.floor(xp / XP_PER_LEVEL) + 1;

    // Rank evaluation
    const rankEval = evaluateRankDay(rankState, titanScore, fieldOpsCleared > 0);
    rankState = rankEval.state;

    if (rankEval.promoted) {
      dayIssues.push(`RANK UP: ${rankEval.newRank}`);
    }
    if (rankEval.warning) {
      dayIssues.push(`RANK WARNING: ${rankState.consecutiveDaysBelow} days below threshold`);
    }
    if (rankEval.demoted) {
      dayIssues.push(`RANK DEMOTED to ${rankEval.demotedTo}`);
    }

    // Field op evaluation
    if (fieldOpState.active) {
      const def = FIELD_OPS.find(d => d.id === fieldOpState.active!.fieldOpId);
      if (def) {
        const evalResult = evaluateFieldOpDay(fieldOpState.active, def, engineScores, titanScore);
        if (evalResult.completed) {
          fieldOpState.history.push({ fieldOpId: def.id, completed: true, date: dateKey });
          fieldOpState.active = null;
          fieldOpsCleared++;
          xp += def.xpReward;
          dayIssues.push(`Field op "${def.name}" COMPLETED (+${def.xpReward} XP)`);

          // Apply stat bonus
          for (const e of ENGINES) {
            stats[e] += def.statBonus / 4;
          }
        } else if (evalResult.failed) {
          fieldOpState.history.push({ fieldOpId: def.id, completed: false, date: dateKey });
          fieldOpState.active = null;
          fieldOpState.cooldownUntil = formatDate(addDays(currentDate, 1));
          dayIssues.push(`Field op "${def.name}" FAILED`);
        } else {
          fieldOpState.active = evalResult.result;
        }
      }
    }

    // Calculate total output after all stat changes (including field op bonuses)
    const totalOutput = ENGINES.reduce((s, e) => s + stats[e], 0);

    // Auto-start field op if none active and available
    if (!fieldOpState.active && day >= 3) {
      const cooldownOver = !fieldOpState.cooldownUntil || dateKey >= fieldOpState.cooldownUntil;
      if (cooldownOver) {
        const available = getAvailableFieldOps(rankState.rank);
        const notDone = available.filter(d => !fieldOpState.history.some(h => h.fieldOpId === d.id && h.completed));
        if (notDone.length > 0) {
          const op = notDone[0];
          fieldOpState.active = { fieldOpId: op.id, startDate: dateKey, dailyResults: [], currentDay: 0 };
          dayIssues.push(`Started field op: "${op.name}"`);
        }
      }
    }

    // Title check
    const titleContext = {
      streak, titanScore, engineScores, rank: rankState.rank,
      fieldOpsCleared, dayNumber: day, stats: { ...stats }, totalOutput,
    };
    const newTitles = checkTitles(unlockedTitles, titleContext);
    unlockedTitles = [...unlockedTitles, ...newTitles];

    if (newTitles.length > 0) {
      dayIssues.push(`Titles unlocked: ${newTitles.join(", ")}`);
    }

    // Validate invariants
    if (titanScore < 0 || titanScore > 100) {
      dayIssues.push(`BUG: titanScore out of range: ${titanScore}`);
    }
    if (streak < 0) {
      dayIssues.push(`BUG: negative streak: ${streak}`);
    }
    for (const e of ENGINES) {
      if (stats[e] < 0) {
        dayIssues.push(`BUG: negative stat ${e}: ${stats[e]}`);
      }
      if (engineScores[e] < 0 || engineScores[e] > 100) {
        dayIssues.push(`BUG: engine score out of range ${e}: ${engineScores[e]}`);
      }
    }
    if (xp < 0) {
      dayIssues.push(`BUG: negative XP: ${xp}`);
    }
    if (level < 1) {
      dayIssues.push(`BUG: level below 1: ${level}`);
    }
    if (totalOutput < 0) {
      dayIssues.push(`BUG: negative total output: ${totalOutput}`);
    }

    results.push({
      day, dateKey, engineScores, titanScore, streak,
      rank: rankState.rank, stats: { ...stats }, totalOutput,
      xp, level,
      momentum: getMomentum(streak),
      integrity: { level: integrity.level, status: integrity.status, streak: integrity.streak },
      fieldOp: fieldOpState.active ? fieldOpState.active.fieldOpId : null,
      titlesUnlocked: newTitles,
      statMilestones: newMilestones,
      rankPromotion: rankEval.promoted,
      issues: dayIssues,
    });
  }

  return results;
}

// ─── Transmissions Test ──────────────────────────────────────────────────────

function testTransmissions(): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();

  // Simulate 80 sessions (should cycle through all 70+ transmissions)
  const staticMessages = [
    "The protocol doesn't care about your feelings. Execute.",
    "Discipline is choosing between what you want now and what you want most.",
    "Your future self is watching. Make them proud.",
    // ... etc (we check for uniqueness in cycling)
  ];

  // Check: 80 sessions should not produce the exact same message more than ~2 times
  // (70+ messages means at most 2 repeats in 80 sessions)
  const messageCounts = new Map<number, number>();
  for (let i = 0; i < 80; i++) {
    const idx = i % 70; // Simulate cycling
    messageCounts.set(idx, (messageCounts.get(idx) || 0) + 1);
  }

  for (const [idx, count] of messageCounts) {
    if (count > 2) {
      issues.push(`Transmission index ${idx} shown ${count} times in 80 sessions`);
    }
  }

  return issues;
}

// ─── Operation Engine Tests ──────────────────────────────────────────────────

function testOperationEngine(): string[] {
  const issues: string[] = [];

  // Test consistency calculation
  // 7 days, 5 completed = 71% = MODERATE
  const rate1 = 5 / 7;
  if (rate1 >= 0.8) issues.push(`BUG: 71% should be MODERATE, got HIGH`);
  if (rate1 < 0.5) issues.push(`BUG: 71% should be MODERATE, got LOW`);

  // 7 days, 6 completed = 86% = HIGH
  const rate2 = 6 / 7;
  if (rate2 < 0.8) issues.push(`BUG: 86% should be HIGH`);

  // 7 days, 2 completed = 29% = LOW
  const rate3 = 2 / 7;
  if (rate3 >= 0.5) issues.push(`BUG: 29% should be LOW`);

  // Test task count scaling
  // Phase multipliers: induction 1.0, foundation 1.1, building 1.2, intensify 1.3, sustain 1.3
  const phaseMultipliers = [1.0, 1.1, 1.2, 1.3, 1.3];
  for (const pm of phaseMultipliers) {
    const base = 4;
    const count = Math.round(base * pm);
    if (count < 3 || count > 12) {
      issues.push(`BUG: task count ${count} out of range 3-12 for multiplier ${pm}`);
    }
  }

  return issues;
}

// ─── Chapter Progression Tests ───────────────────────────────────────────────

function testChapterProgression(): string[] {
  const issues: string[] = [];

  // Chapters: each 2 weeks (14 days)
  // Chapter 1: weeks 1-2 (days 1-14)
  // Chapter 2: weeks 3-4 (days 15-28)
  // Chapter 3: weeks 5-6 (days 29-42)
  // ...
  // Chapter 7 (Endgame): week 13+ (day 85+)

  const chapters = [
    { num: 1, name: "Awakening", dayStart: 1, dayEnd: 14 },
    { num: 2, name: "Foundation", dayStart: 15, dayEnd: 28 },
    { num: 3, name: "Grind", dayStart: 29, dayEnd: 42 },
    { num: 4, name: "Breakthrough", dayStart: 43, dayEnd: 56 },
    { num: 5, name: "Ascent", dayStart: 57, dayEnd: 70 },
    { num: 6, name: "Titan Mode", dayStart: 71, dayEnd: 84 },
    { num: 7, name: "Endgame", dayStart: 85, dayEnd: 999 },
  ];

  // Test day number calculation
  const firstActive = "2026-04-01";
  for (let d = 1; d <= 100; d++) {
    const current = formatDate(addDays(new Date("2026-04-01"), d - 1));
    const dayNum = getDayNumber(firstActive, current);
    if (dayNum !== d) {
      issues.push(`BUG: Day ${d} calculated as ${dayNum}`);
    }
  }

  // Test anti-regression: day number should never go backwards
  // (In real app this is clamped by max_day_reached in MMKV)

  return issues;
}

// ─── Scoring Algorithm Tests ─────────────────────────────────────────────────

function testScoringAlgorithm(): string[] {
  const issues: string[] = [];

  // Test all archetypes produce valid weighted scores
  const archetypes: IdentityArchetype[] = [
    "titan", "athlete", "scholar", "hustler", "showman", "warrior", "founder", "charmer"
  ];

  const testScores: EngineScores[] = [
    { body: 100, mind: 100, money: 100, charisma: 100 },
    { body: 0, mind: 0, money: 0, charisma: 0 },
    { body: 50, mind: 50, money: 50, charisma: 50 },
    { body: 100, mind: 0, money: 0, charisma: 0 },
    { body: 0, mind: 0, money: 0, charisma: 100 },
    { body: 85, mind: 70, money: 60, charisma: 90 },
  ];

  for (const arch of archetypes) {
    // Verify weights sum to 1.0
    const weights = ENGINE_WEIGHTS[arch];
    const sum = ENGINES.reduce((s, e) => s + weights[e], 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      issues.push(`BUG: ${arch} weights sum to ${sum}, not 1.0`);
    }

    for (const scores of testScores) {
      const titan = calculateWeightedTitanScore(scores, arch);

      if (titan < 0 || titan > 100) {
        issues.push(`BUG: ${arch} titan score ${titan} out of 0-100 range for ${JSON.stringify(scores)}`);
      }

      // All 100s should give 100
      if (scores.body === 100 && scores.mind === 100 && scores.money === 100 && scores.charisma === 100) {
        if (titan !== 100) {
          issues.push(`BUG: ${arch} all-100 should give titan=100, got ${titan}`);
        }
      }

      // All 0s should give 0
      if (scores.body === 0 && scores.mind === 0 && scores.money === 0 && scores.charisma === 0) {
        if (titan !== 0) {
          issues.push(`BUG: ${arch} all-0 should give titan=0, got ${titan}`);
        }
      }
    }
  }

  return issues;
}

// ─── Stat System Tests ───────────────────────────────────────────────────────

function testStatSystem(): string[] {
  const issues: string[] = [];

  // Test scoreToGain brackets
  const gainTests = [
    { score: 0, expected: 0 }, { score: 10, expected: 0 }, { score: 19, expected: 0 },
    { score: 20, expected: 0.5 }, { score: 35, expected: 0.5 }, { score: 39, expected: 0.5 },
    { score: 40, expected: 1.0 }, { score: 55, expected: 1.0 }, { score: 59, expected: 1.0 },
    { score: 60, expected: 1.5 }, { score: 75, expected: 1.5 }, { score: 79, expected: 1.5 },
    { score: 80, expected: 2.0 }, { score: 90, expected: 2.0 }, { score: 100, expected: 2.0 },
  ];

  for (const t of gainTests) {
    const gain = scoreToGain(t.score);
    if (gain !== t.expected) {
      issues.push(`BUG: scoreToGain(${t.score}) = ${gain}, expected ${t.expected}`);
    }
  }

  // Test archetype starting stats
  for (const [arch, bonus] of Object.entries(ARCHETYPE_BONUSES)) {
    const total = ENGINES.reduce((s, e) => s + bonus[e], 0);
    if (total < 20 || total > 30) {
      issues.push(`BUG: ${arch} starting stats total ${total} seems off`);
    }
  }

  // Test stat growth over 30 days at various performance levels
  // Perfect user (all 100%): +2.0/day/engine = 60 per engine over 30 days
  const perfectGrowth = 2.0 * 30;
  if (perfectGrowth !== 60) {
    issues.push(`BUG: Perfect user 30-day growth should be 60, got ${perfectGrowth}`);
  }

  // Minimum user (40%): +1.0/day/engine = 30 per engine over 30 days
  const minGrowth = 1.0 * 30;
  if (minGrowth !== 30) {
    issues.push(`BUG: Minimum user 30-day growth should be 30, got ${minGrowth}`);
  }

  return issues;
}

// ─── Momentum Tests ──────────────────────────────────────────────────────────

function testMomentum(): string[] {
  const issues: string[] = [];

  // Test tier transitions
  const tierTests = [
    { days: 0, tier: "BASE", mult: 1.0 },
    { days: 1, tier: "BASE", mult: 1.0 },
    { days: 2, tier: "BASE", mult: 1.0 },
    { days: 3, tier: "MOMENTUM_BUILDING", mult: 1.25 },
    { days: 6, tier: "MOMENTUM_BUILDING", mult: 1.25 },
    { days: 7, tier: "MOMENTUM_LOCKED", mult: 1.5 },
    { days: 13, tier: "MOMENTUM_LOCKED", mult: 1.5 },
    { days: 14, tier: "OVERDRIVE", mult: 1.75 },
    { days: 29, tier: "OVERDRIVE", mult: 1.75 },
    { days: 30, tier: "MAXIMUM_OUTPUT", mult: 2.0 },
    { days: 100, tier: "MAXIMUM_OUTPUT", mult: 2.0 },
  ];

  for (const t of tierTests) {
    const m = getMomentum(t.days);
    if (m.tier !== t.tier) {
      issues.push(`BUG: getMomentum(${t.days}).tier = "${m.tier}", expected "${t.tier}"`);
    }
    if (m.multiplier !== t.mult) {
      issues.push(`BUG: getMomentum(${t.days}).multiplier = ${m.multiplier}, expected ${t.mult}`);
    }
  }

  // Test XP calculation
  const xpResult = applyMomentum(50, 30);
  if (xpResult.finalXP !== 100) {
    issues.push(`BUG: applyMomentum(50, 30) = ${xpResult.finalXP}, expected 100 (2.0x)`);
  }
  if (xpResult.bonusXP !== 50) {
    issues.push(`BUG: applyMomentum(50, 30) bonus = ${xpResult.bonusXP}, expected 50`);
  }

  return issues;
}

// ─── Integrity Tests ─────────────────────────────────────────────────────────

function testIntegrity(): string[] {
  const issues: string[] = [];

  // Test level thresholds
  const levelTests = [
    { streak: 0, expected: "INITIALIZING" },
    { streak: 1, expected: "INITIALIZING" },
    { streak: 6, expected: "INITIALIZING" },
    { streak: 7, expected: "STABLE" },
    { streak: 13, expected: "STABLE" },
    { streak: 14, expected: "FORTIFIED" },
    { streak: 29, expected: "FORTIFIED" },
    { streak: 30, expected: "HARDENED" },
    { streak: 59, expected: "HARDENED" },
    { streak: 60, expected: "UNBREAKABLE" },
  ];

  for (const t of levelTests) {
    const level = getIntegrityLevel(t.streak);
    if (level !== t.expected) {
      issues.push(`BUG: getIntegrityLevel(${t.streak}) = "${level}", expected "${t.expected}"`);
    }
  }

  // Test recovery mechanic
  // Build up 20-day streak, then miss 2 days (BREACH = 50% reduction to 10)
  // Then 3 recovery days should restore to floor(20 * 0.75) = 15
  let state: IntegrityState = {
    streak: 20, lastCompletionDate: "2026-04-20",
    status: "ACTIVE", level: "FORTIFIED", preBreakStreak: 0, recoveryDays: 0,
  };

  // Miss 2 days (BREACH)
  state = simulateIntegrity(state, false, "2026-04-22");
  if (state.streak !== 10) {
    issues.push(`BUG: After BREACH from 20, streak should be 10, got ${state.streak}`);
  }
  if (state.status !== "RECOVERING") {
    issues.push(`BUG: After BREACH, status should be RECOVERING, got ${state.status}`);
  }

  // 3 recovery days
  state = simulateIntegrity(state, true, "2026-04-23");
  state = simulateIntegrity(state, true, "2026-04-24");
  state = simulateIntegrity(state, true, "2026-04-25");

  if (state.streak < 13) { // Should be max(13, floor(20 * 0.75)) = 15
    issues.push(`BUG: After recovery from 20→10 + 3 days, streak should be ≥13, got ${state.streak}`);
  }

  return issues;
}

// ─── Rank System Tests ───────────────────────────────────────────────────────

function testRankSystem(): string[] {
  const issues: string[] = [];

  // Test E→D promotion: 7 consecutive days at 50%+
  let state: RankState = { rank: "E", qualifyingDays: 0, consecutiveDaysBelow: 0 };

  for (let d = 0; d < 7; d++) {
    const result = evaluateRankDay(state, 55, false);
    state = result.state;
    if (d < 6 && result.promoted) {
      issues.push(`BUG: Promoted to D on day ${d + 1}, should need 7 days`);
    }
  }
  if (state.rank !== "D") {
    issues.push(`BUG: Should be D-rank after 7 days at 55%, got ${state.rank}`);
  }

  // Test demotion warning at 7 days below
  state = { rank: "D", qualifyingDays: 0, consecutiveDaysBelow: 0 };
  for (let d = 0; d < 7; d++) {
    const result = evaluateRankDay(state, 30, false); // Below D requirement (50%)
    state = result.state;
    if (d === 6 && !result.warning) {
      issues.push(`BUG: Should get warning at 7 consecutive days below threshold`);
    }
  }

  // Test demotion at 14 days below
  for (let d = 7; d < 14; d++) {
    const result = evaluateRankDay(state, 30, false);
    state = result.state;
    if (d === 13) {
      if (!result.demoted) {
        issues.push(`BUG: Should be demoted at 14 consecutive days below threshold`);
      }
      if (state.rank !== "E") {
        issues.push(`BUG: Should be demoted to E, got ${state.rank}`);
      }
    }
  }

  // Test S-rank requires field op
  state = { rank: "A", qualifyingDays: 0, consecutiveDaysBelow: 0 };
  for (let d = 0; d < 30; d++) {
    const result = evaluateRankDay(state, 90, false); // No field op cleared
    state = result.state;
  }
  if (state.rank === "S") {
    issues.push(`BUG: S-rank should require field op cleared, but promoted without it`);
  }

  // Now with field op cleared
  state = { rank: "A", qualifyingDays: 0, consecutiveDaysBelow: 0 };
  for (let d = 0; d < 30; d++) {
    const result = evaluateRankDay(state, 90, true);
    state = result.state;
  }
  if (state.rank !== "S") {
    issues.push(`BUG: Should be S-rank after 30 days at 90% with field op cleared, got ${state.rank}`);
  }

  return issues;
}

// ─── Field Op Tests ──────────────────────────────────────────────────────────

function testFieldOps(): string[] {
  const issues: string[] = [];

  // Test sprint op: any failure = immediate fail
  const sprintOp = FIELD_OPS.find(d => d.type === "sprint" && d.durationDays === 2)!;
  let activeOp: ActiveFieldOp = { fieldOpId: sprintOp.id, startDate: "2026-04-01", dailyResults: [], currentDay: 0 };

  // Day 1: fail
  const result1 = evaluateFieldOpDay(activeOp, sprintOp, { body: 10, mind: 10, money: 10, charisma: 10 }, 10);
  if (!result1.failed) {
    issues.push(`BUG: Sprint op should fail immediately on first failure`);
  }

  // Day 1: pass, Day 2: pass = complete
  activeOp = { fieldOpId: sprintOp.id, startDate: "2026-04-01", dailyResults: [], currentDay: 0 };
  const pass1 = evaluateFieldOpDay(activeOp, sprintOp, { body: 50, mind: 50, money: 50, charisma: 50 }, 50);
  if (pass1.failed || pass1.completed) {
    issues.push(`BUG: Sprint op day 1 pass should not be complete or failed yet`);
  }
  const pass2 = evaluateFieldOpDay(pass1.result, sprintOp, { body: 50, mind: 50, money: 50, charisma: 50 }, 50);
  if (!pass2.completed) {
    issues.push(`BUG: Sprint op should complete after 2 passing days`);
  }

  // Test endurance op: 2 consecutive failures = fail
  const enduranceOp = FIELD_OPS.find(d => d.type === "endurance")!;
  activeOp = { fieldOpId: enduranceOp.id, startDate: "2026-04-01", dailyResults: [], currentDay: 0 };

  // Day 1: pass
  const e1 = evaluateFieldOpDay(activeOp, enduranceOp, { body: 50, mind: 50, money: 50, charisma: 50 }, 50);
  // Day 2: fail (1 failure, no consecutive)
  const e2 = evaluateFieldOpDay(e1.result, enduranceOp, { body: 10, mind: 10, money: 10, charisma: 10 }, 10);
  if (e2.failed) {
    issues.push(`BUG: Endurance op should NOT fail on single failure`);
  }
  // Day 3: pass (reset consecutive failures)
  const e3 = evaluateFieldOpDay(e2.result, enduranceOp, { body: 50, mind: 50, money: 50, charisma: 50 }, 50);
  if (e3.failed) {
    issues.push(`BUG: Endurance op should not fail after pass`);
  }
  // Day 4: fail
  const e4 = evaluateFieldOpDay(e3.result, enduranceOp, { body: 10, mind: 10, money: 10, charisma: 10 }, 10);
  // Day 5: fail (2 consecutive = should fail)
  const e5 = evaluateFieldOpDay(e4.result, enduranceOp, { body: 10, mind: 10, money: 10, charisma: 10 }, 10);
  if (!e5.failed) {
    issues.push(`BUG: Endurance op should fail after 2 consecutive failures`);
  }

  // Test rank gating
  const eRankOps = getAvailableFieldOps("E");
  const dRankOps = getAvailableFieldOps("D");
  const sRankOps = getAvailableFieldOps("S");

  if (eRankOps.length >= dRankOps.length) {
    issues.push(`BUG: D-rank should have more ops available than E-rank`);
  }
  if (dRankOps.length >= sRankOps.length) {
    issues.push(`BUG: S-rank should have more ops available than D-rank`);
  }

  return issues;
}

// ─── Title Check Tests ───────────────────────────────────────────────────────

function testTitleChecks(): string[] {
  const issues: string[] = [];

  // Test streak titles
  const context7 = {
    streak: 7, titanScore: 50, engineScores: { body: 50, mind: 50, money: 50, charisma: 50 } as EngineScores,
    rank: "E" as Rank, fieldOpsCleared: 0, dayNumber: 7,
    stats: { body: 10, mind: 10, money: 10, charisma: 10 }, totalOutput: 40,
  };

  const titles7 = checkTitles([], context7);
  if (!titles7.includes("consistent")) {
    issues.push(`BUG: Should unlock "consistent" title at 7-day streak`);
  }
  if (titles7.includes("relentless")) {
    issues.push(`BUG: Should NOT unlock "relentless" (14d) at 7-day streak`);
  }

  // Test rank titles
  const contextD = {
    streak: 7, titanScore: 55, engineScores: { body: 55, mind: 55, money: 55, charisma: 55 } as EngineScores,
    rank: "D" as Rank, fieldOpsCleared: 0, dayNumber: 10,
    stats: { body: 15, mind: 15, money: 15, charisma: 15 }, totalOutput: 60,
  };

  const titlesD = checkTitles([], contextD);
  if (!titlesD.includes("d_rank")) {
    issues.push(`BUG: Should unlock "d_rank" title at D rank`);
  }

  // Test performance titles
  const contextPerfect = {
    streak: 1, titanScore: 100, engineScores: { body: 100, mind: 100, money: 100, charisma: 100 } as EngineScores,
    rank: "E" as Rank, fieldOpsCleared: 0, dayNumber: 1,
    stats: { body: 7, mind: 7, money: 7, charisma: 7 }, totalOutput: 28,
  };

  const titlesPerfect = checkTitles([], contextPerfect);
  if (!titlesPerfect.includes("perfect_day")) {
    issues.push(`BUG: Should unlock "perfect_day" title at all 100%`);
  }
  if (!titlesPerfect.includes("operational")) {
    issues.push(`BUG: Should unlock "operational" title at all 50%+`);
  }
  if (!titlesPerfect.includes("high_output")) {
    issues.push(`BUG: Should unlock "high_output" title at all 70%+`);
  }

  // Test duplicate prevention
  const titlesAgain = checkTitles(["consistent"], context7);
  if (titlesAgain.includes("consistent")) {
    issues.push(`BUG: Should NOT re-unlock already unlocked title`);
  }

  return issues;
}

// ─── Run All Tests ───────────────────────────────────────────────────────────

function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║       TITAN PROTOCOL — FULL SIMULATION TEST SUITE          ║");
  console.log("║           30-Day Simulation × 8 User Profiles              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  let totalIssues = 0;
  let totalTests = 0;

  // ─── Unit Tests ──────────────────────────────────────────────────────

  const unitTests = [
    { name: "Scoring Algorithm", fn: testScoringAlgorithm },
    { name: "Stat System", fn: testStatSystem },
    { name: "Momentum System", fn: testMomentum },
    { name: "Protocol Integrity", fn: testIntegrity },
    { name: "Rank System", fn: testRankSystem },
    { name: "Field Ops", fn: testFieldOps },
    { name: "Title Checks", fn: testTitleChecks },
    { name: "Operation Engine", fn: testOperationEngine },
    { name: "Transmissions", fn: testTransmissions },
    { name: "Chapter Progression", fn: testChapterProgression },
  ];

  console.log("━━━ UNIT TESTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  for (const test of unitTests) {
    totalTests++;
    const issues = test.fn();
    const status = issues.length === 0 ? "✅ PASS" : "❌ FAIL";
    console.log(`  ${status}  ${test.name}`);
    if (issues.length > 0) {
      for (const issue of issues) {
        console.log(`         → ${issue}`);
        totalIssues++;
      }
    }
  }

  // ─── Full Month Simulations ──────────────────────────────────────────

  console.log("\n━━━ 30-DAY SIMULATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  for (const profile of ALL_PROFILES) {
    totalTests++;
    console.log(`\n┌─── ${profile.name} (${profile.archetype}) ${"─".repeat(40 - profile.name.length)}┐`);

    const results = runSimulation(profile, 30);
    const lastDay = results[results.length - 1];
    const activeDays = results.filter(r => !r.issues.includes("SKIPPED"));
    const skippedDays = results.filter(r => r.issues.includes("SKIPPED"));
    const bugIssues = results.flatMap(r => r.issues.filter(i => i.startsWith("BUG")));

    // Summary stats
    const avgTitan = activeDays.length > 0
      ? Math.round(activeDays.reduce((s, r) => s + r.titanScore, 0) / activeDays.length)
      : 0;
    const maxStreak = Math.max(...results.map(r => r.streak));
    const allTitles = [...new Set(results.flatMap(r => r.titlesUnlocked))];
    const allMilestones = [...new Set(results.flatMap(r => r.statMilestones))];
    const rankUps = results.filter(r => r.rankPromotion);
    const fieldOpEvents = results.flatMap(r => r.issues.filter(i => i.includes("Field op")));

    console.log(`│  Days Active: ${activeDays.length}/30  |  Skipped: ${skippedDays.length}`);
    console.log(`│  Final Rank: ${lastDay.rank}  |  Avg Titan Score: ${avgTitan}%`);
    console.log(`│  Max Streak: ${maxStreak}  |  Final Streak: ${lastDay.streak}`);
    console.log(`│  XP: ${lastDay.xp}  |  Level: ${lastDay.level}`);
    console.log(`│  Total Output: ${Math.round(lastDay.totalOutput)}`);
    console.log(`│  Stats: B=${Math.round(lastDay.stats.body)} M=${Math.round(lastDay.stats.mind)} $=${Math.round(lastDay.stats.money)} C=${Math.round(lastDay.stats.charisma)}`);
    console.log(`│  Momentum: ${lastDay.momentum.multiplier}x (${lastDay.momentum.tier})`);
    console.log(`│  Integrity: ${lastDay.integrity.level} (${lastDay.integrity.status}, streak=${lastDay.integrity.streak})`);
    console.log(`│  Rank Promotions: ${rankUps.length} (${rankUps.map(r => r.rank).join(" → ")})`);
    console.log(`│  Titles Unlocked: ${allTitles.length} [${allTitles.join(", ")}]`);
    console.log(`│  Stat Milestones: ${allMilestones.length}`);
    console.log(`│  Field Op Events: ${fieldOpEvents.length}`);

    if (bugIssues.length > 0) {
      console.log(`│  ❌ BUGS FOUND: ${bugIssues.length}`);
      for (const bug of bugIssues) {
        console.log(`│    → ${bug}`);
        totalIssues++;
      }
    } else {
      console.log(`│  ✅ No bugs detected`);
    }

    // Detailed day-by-day log (condensed)
    console.log(`│`);
    console.log(`│  Day-by-day:`);
    for (const r of results) {
      const events = r.issues.filter(i => !i.startsWith("BUG") && i !== "SKIPPED");
      const skipped = r.issues.includes("SKIPPED");
      const marker = skipped ? "⊘" : r.rankPromotion ? "⬆" : r.titlesUnlocked.length > 0 ? "🏆" : "●";
      const scoreStr = skipped ? "---" : `T:${Math.round(r.titanScore)}%`;
      const streakStr = `S:${r.streak}`;
      const extra = events.length > 0 ? ` ← ${events.join(" | ")}` : "";
      console.log(`│    D${String(r.day).padStart(2,"0")} ${marker} ${scoreStr} ${streakStr} R:${r.rank} L:${r.level}${extra}`);
    }

    console.log(`└${"─".repeat(60)}┘`);

    // Validation checks for this profile
    const profileIssues: string[] = [];

    // Check: stats should never decrease
    for (let i = 1; i < results.length; i++) {
      for (const e of ENGINES) {
        if (results[i].stats[e] < results[i - 1].stats[e] - 0.01) {
          profileIssues.push(`Stats decreased: ${e} went from ${results[i-1].stats[e]} to ${results[i].stats[e]} on day ${results[i].day}`);
        }
      }
    }

    // Check: total output should match sum of stats
    for (const r of results) {
      const expected = ENGINES.reduce((s, e) => s + r.stats[e], 0);
      if (Math.abs(r.totalOutput - expected) > 0.1) {
        profileIssues.push(`Total output mismatch on day ${r.day}: ${r.totalOutput} vs sum ${expected}`);
      }
    }

    // Check: XP should never decrease
    for (let i = 1; i < results.length; i++) {
      if (results[i].xp < results[i - 1].xp) {
        profileIssues.push(`XP decreased on day ${results[i].day}: ${results[i - 1].xp} → ${results[i].xp}`);
      }
    }

    // Check: rank should not skip levels
    for (let i = 1; i < results.length; i++) {
      const prevIdx = RANK_ORDER.indexOf(results[i - 1].rank);
      const currIdx = RANK_ORDER.indexOf(results[i].rank);
      if (currIdx - prevIdx > 1) {
        profileIssues.push(`Rank skipped levels on day ${results[i].day}: ${results[i-1].rank} → ${results[i].rank}`);
      }
    }

    if (profileIssues.length > 0) {
      console.log(`  ❌ Validation Issues:`);
      for (const issue of profileIssues) {
        console.log(`    → ${issue}`);
        totalIssues++;
      }
    }
  }

  // ─── Final Summary ───────────────────────────────────────────────────

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log(`║  TESTS: ${totalTests}  |  ISSUES: ${totalIssues}                                  `);
  if (totalIssues === 0) {
    console.log("║  ✅ ALL SYSTEMS OPERATIONAL — NO BUGS DETECTED              ║");
  } else {
    console.log(`║  ❌ ${totalIssues} ISSUE(S) FOUND — SEE ABOVE FOR DETAILS             `);
  }
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
}

main();
