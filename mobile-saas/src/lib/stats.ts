import { getJSON, setJSON } from "../db/storage";
import type { EngineKey } from "../db/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

const MILESTONES = [25, 50, 75, 100, 150, 200] as const;

const ARCHETYPE_BONUSES: Record<string, Record<EngineKey, number>> = {
  titan: { body: 5, mind: 5, money: 5, charisma: 5 },
  athlete: { body: 8, mind: 5, money: 5, charisma: 5 },
  scholar: { body: 5, mind: 8, money: 5, charisma: 5 },
  hustler: { body: 5, mind: 5, money: 8, charisma: 5 },
  showman: { body: 5, mind: 5, money: 5, charisma: 8 },
  warrior: { body: 7, mind: 7, money: 5, charisma: 5 },
  founder: { body: 5, mind: 7, money: 7, charisma: 5 },
  charmer: { body: 7, mind: 5, money: 5, charisma: 7 },
};

// ─── Score → Stat Gain Mapping ────────────────────────────────────────────────

/**
 * Maps a daily engine score percentage to a stat point gain.
 *   0-19%  → 0.0
 *  20-39%  → 0.5
 *  40-59%  → 1.0
 *  60-79%  → 1.5
 *  80-100% → 2.0
 */
export function scoreToGain(percent: number): number {
  if (percent < 20) return 0;
  if (percent < 40) return 0.5;
  if (percent < 60) return 1.0;
  if (percent < 80) return 1.5;
  return 2.0;
}

// ─── Starting Stats ───────────────────────────────────────────────────────────

/**
 * Returns the base stats for a given archetype.
 * Base is 5 per engine, with archetype-specific bonuses applied.
 */
export function getStartingStats(
  archetype: string,
): Record<EngineKey, number> {
  const bonuses = ARCHETYPE_BONUSES[archetype];
  if (bonuses) return { ...bonuses };
  // Fallback: balanced base stats
  return { body: 5, mind: 5, money: 5, charisma: 5 };
}

// ─── Daily Recording ──────────────────────────────────────────────────────────

/**
 * Records stat gains for a given day. Idempotent — skips engines
 * that already have a recorded daily gain for that dateKey.
 */
export function recordDailyStats(
  dateKey: string,
  engineScores: Record<EngineKey, number>,
): void {
  for (const engine of ENGINES) {
    const dailyKey = `stat:daily:${dateKey}:${engine}`;
    const existing = getJSON<number | null>(dailyKey, null);
    if (existing !== null) continue; // already recorded

    const score = engineScores[engine] ?? 0;
    const gain = scoreToGain(score);

    // Persist daily gain
    setJSON(dailyKey, gain);

    // Update cumulative stat
    const cumKey = `stat:${engine}`;
    const current = getJSON<number>(cumKey, 0);
    setJSON(cumKey, current + gain);
  }
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/** Returns current cumulative stats for all four engines. */
export function getStats(): Record<EngineKey, number> {
  return {
    body: getJSON<number>("stat:body", 0),
    mind: getJSON<number>("stat:mind", 0),
    money: getJSON<number>("stat:money", 0),
    charisma: getJSON<number>("stat:charisma", 0),
  };
}

/** Sum of all four engine stats. */
export function getTotalOutput(): number {
  const s = getStats();
  return s.body + s.mind + s.money + s.charisma;
}

/** Returns today's gain per engine (0 if not yet recorded). */
export function getTodayGains(
  dateKey: string,
): Record<EngineKey, number> {
  return {
    body: getJSON<number>(`stat:daily:${dateKey}:body`, 0),
    mind: getJSON<number>(`stat:daily:${dateKey}:mind`, 0),
    money: getJSON<number>(`stat:daily:${dateKey}:money`, 0),
    charisma: getJSON<number>(`stat:daily:${dateKey}:charisma`, 0),
  };
}

// ─── Milestone Tracking ───────────────────────────────────────────────────────

/**
 * Checks for newly reached stat milestones.
 * Returns only milestones not previously seen.
 */
export function checkStatMilestones(
  _dateKey: string,
): Array<{ engine: EngineKey; milestone: number }> {
  const stats = getStats();
  const seen = getJSON<string[]>("stat:milestones_seen", []);
  const newMilestones: Array<{ engine: EngineKey; milestone: number }> = [];

  for (const engine of ENGINES) {
    const value = stats[engine];
    for (const milestone of MILESTONES) {
      const key = `${engine}:${milestone}`;
      if (value >= milestone && !seen.includes(key)) {
        newMilestones.push({ engine, milestone });
        seen.push(key);
      }
    }
  }

  if (newMilestones.length > 0) {
    setJSON("stat:milestones_seen", seen);
  }

  return newMilestones;
}

// ─── Initialization ───────────────────────────────────────────────────────────

/**
 * Called once during onboarding to set archetype-based starting stats.
 * No-ops if already initialized.
 */
export function initializeStats(archetype: string): void {
  const initialized = getJSON<boolean>("stat:initialized", false);
  if (initialized) return;

  const starting = getStartingStats(archetype);
  for (const engine of ENGINES) {
    setJSON(`stat:${engine}`, starting[engine]);
  }
  setJSON("stat:initialized", true);
}
