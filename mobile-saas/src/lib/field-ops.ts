import { getJSON, setJSON } from "../db/storage";
import { getTodayKey } from "./date";
import type { EngineKey } from "../db/schema";
import fieldOpDefs from "../data/field-ops.json";
import { RANK_ORDER } from "./ranks-v2";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FieldOpObjectiveType =
  | "avg_score"
  | "engine_score"
  | "all_engines"
  | "streak";

export type FieldOpDef = {
  id: string;
  name: string;
  description: string;
  type: "sprint" | "endurance";
  minRank: string;
  durationDays: number;
  objective: {
    type: FieldOpObjectiveType;
    engine?: EngineKey;
    threshold: number;
  };
  xpReward: number;
  statBonus: number;
  titleReward: string | null;
};

export type ActiveFieldOp = {
  fieldOpId: string;
  startDate: string;
  dailyResults: boolean[];
  currentDay: number;
};

export type FieldOpHistoryEntry = {
  fieldOpId: string;
  completed: boolean;
  completedDate: string;
};

type DayResult = "passed" | "failed" | "completed" | null;

// ─── Constants ────────────────────────────────────────────────────────────────

const ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

const MMKV_ACTIVE = "field_op_active";
const MMKV_HISTORY = "field_op_history";
const MMKV_COOLDOWN = "field_op_cooldown";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rankIndex(rank: string): number {
  return RANK_ORDER.indexOf(rank as import("./ranks-v2").Rank);
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Returns field ops available to the player based on their current rank.
 * A field op is available if the player's rank is >= the field op's minRank.
 */
export function getAvailableFieldOps(rank: string): FieldOpDef[] {
  const playerIdx = rankIndex(rank);
  if (playerIdx < 0) return [];
  return (fieldOpDefs as FieldOpDef[]).filter(
    (d) => rankIndex(d.minRank) <= playerIdx,
  );
}

/** Returns the currently active field op, or null. */
export function getActiveFieldOp(): ActiveFieldOp | null {
  return getJSON<ActiveFieldOp | null>(MMKV_ACTIVE, null);
}

/**
 * Start a new field op. Validates:
 * - No active field op already running
 * - Player rank meets minimum requirement
 * - Not on cooldown
 */
export function startFieldOp(fieldOpId: string): void {
  const active = getActiveFieldOp();
  if (active) {
    throw new Error("A field op is already active. Complete or abandon it first.");
  }

  if (isOnCooldown()) {
    throw new Error("On cooldown. Wait before starting another field op.");
  }

  const def = getFieldOpDef(fieldOpId);
  if (!def) {
    throw new Error(`Unknown field op: ${fieldOpId}`);
  }

  // Rank gate check
  const playerRank = getJSON<{ rank: string }>("player_rank", { rank: "initiate" });
  if (rankIndex(playerRank.rank) < rankIndex(def.minRank)) {
    throw new Error(
      `Rank ${def.minRank} required. Current rank: ${playerRank.rank}`,
    );
  }

  const fieldOp: ActiveFieldOp = {
    fieldOpId,
    startDate: getTodayKey(),
    dailyResults: [],
    currentDay: 1,
  };

  setJSON(MMKV_ACTIVE, fieldOp);
}

/**
 * Evaluate the current field op day against today's scores.
 * Returns:
 *   "passed"    — day objective met
 *   "failed"    — day objective not met (sprint: immediate fail; endurance: track consecutive)
 *   "completed" — final day passed, field op cleared
 *   null        — no active field op
 */
export function evaluateFieldOpDay(
  engineScores: Record<string, number>,
  titanScore: number,
): DayResult {
  const active = getActiveFieldOp();
  if (!active) return null;

  const def = getFieldOpDef(active.fieldOpId);
  if (!def) return null;

  const obj = def.objective;
  let dayPassed = false;

  switch (obj.type) {
    case "avg_score":
      dayPassed = titanScore >= obj.threshold;
      break;

    case "engine_score": {
      const engine = obj.engine;
      if (engine) {
        dayPassed = (engineScores[engine] ?? 0) >= obj.threshold;
      }
      break;
    }

    case "all_engines":
      dayPassed = ENGINES.every(
        (e) => (engineScores[e] ?? 0) >= obj.threshold,
      );
      break;

    case "streak":
      // Streak objective: passes as long as the protocol was completed
      // (any non-zero titan score counts as protocol completed)
      dayPassed = titanScore > 0;
      break;
  }

  active.dailyResults.push(dayPassed);

  // ── Failure conditions ────────────────────────────────────────────────
  if (!dayPassed) {
    if (def.type === "sprint") {
      // Sprint: any single failure = immediate field op fail
      setJSON(MMKV_ACTIVE, active);
      failFieldOp();
      return "failed";
    }

    // Endurance: 2 consecutive failures = field op fail
    const results = active.dailyResults;
    if (
      results.length >= 2 &&
      !results[results.length - 1] &&
      !results[results.length - 2]
    ) {
      setJSON(MMKV_ACTIVE, active);
      failFieldOp();
      return "failed";
    }
  }

  // ── Completion check ──────────────────────────────────────────────────
  if (active.dailyResults.length >= def.durationDays && dayPassed) {
    active.currentDay = active.dailyResults.length;
    setJSON(MMKV_ACTIVE, active);
    return "completed";
  }

  // ── Advance day ───────────────────────────────────────────────────────
  active.currentDay = active.dailyResults.length + 1;
  setJSON(MMKV_ACTIVE, active);

  return dayPassed ? "passed" : "failed";
}

/**
 * Mark the active field op as completed.
 * Moves it to history, clears active state, and returns the field op def
 * so the caller can display rewards.
 */
export function completeFieldOp(): FieldOpDef {
  const active = getActiveFieldOp();
  if (!active) throw new Error("No active field op to complete.");

  const def = getFieldOpDef(active.fieldOpId);
  if (!def) throw new Error("Field op definition not found.");

  // Add to history
  const history = getJSON<FieldOpHistoryEntry[]>(MMKV_HISTORY, []);
  history.push({
    fieldOpId: active.fieldOpId,
    completed: true,
    completedDate: getTodayKey(),
  });
  setJSON(MMKV_HISTORY, history);

  // Clear active
  setJSON(MMKV_ACTIVE, null);

  return def;
}

/** Mark the active field op as failed. Applies 24h cooldown. */
export function failFieldOp(): void {
  const active = getActiveFieldOp();
  if (!active) return;

  // Add to history as failed
  const history = getJSON<FieldOpHistoryEntry[]>(MMKV_HISTORY, []);
  history.push({
    fieldOpId: active.fieldOpId,
    completed: false,
    completedDate: getTodayKey(),
  });
  setJSON(MMKV_HISTORY, history);

  // Set cooldown (next day)
  setJSON(MMKV_COOLDOWN, getTodayKey());

  // Clear active
  setJSON(MMKV_ACTIVE, null);
}

/** Abandon the active field op. Same consequences as failure. */
export function abandonFieldOp(): void {
  failFieldOp();
}

/** Returns the full field op history (completed and failed). */
export function getFieldOpHistory(): FieldOpHistoryEntry[] {
  return getJSON<FieldOpHistoryEntry[]>(MMKV_HISTORY, []);
}

/** Returns the number of successfully cleared field ops. */
export function getClearedCount(): number {
  return getFieldOpHistory().filter((e) => e.completed).length;
}

/**
 * Check if the player is on cooldown after a failed/abandoned field op.
 * Cooldown lasts until the day after failure.
 */
export function isOnCooldown(): boolean {
  const cooldownDate = getJSON<string | null>(MMKV_COOLDOWN, null);
  if (!cooldownDate) return false;
  return getTodayKey() <= cooldownDate;
}

/** Look up a field op definition by ID. */
export function getFieldOpDef(id: string): FieldOpDef | undefined {
  return (fieldOpDefs as FieldOpDef[]).find((d) => d.id === id);
}
