/**
 * Pure selectors for engine strength/weakness analysis.
 *
 * Context: the dashboard's "Protocol voice" surfaces the weakest engine to
 * nudge the user. The naive `min(scores)` version had three failure modes:
 *
 *   1. An engine with zero tasks scores 0 — "unstaffed" was flagged as
 *      "weak", even though the user just hasn't set that engine up yet.
 *   2. When all engines tie at the same score, one still got picked as
 *      "weakest" — including the 100% / 100% / 100% / 100% case.
 *   3. A 5-point gap (e.g. 95 vs 90) surfaced as a weakness — not
 *      meaningful, just noise.
 *
 * These functions encode the real semantics: a weak engine only exists
 * when there's a STAFFED engine, CLEARLY below the others, BELOW the
 * floor we consider "good". Everything else returns null — the caller
 * renders a different copy path (or nothing).
 */

export type EngineKey = "body" | "mind" | "money" | "charisma";

export const ENGINES: readonly EngineKey[] = ["body", "mind", "money", "charisma"] as const;

/** Floor above which we never call an engine "weak". */
export const WEAK_ENGINE_SCORE_CEILING = 80;
/** Minimum gap between weakest and strongest to bother surfacing. */
export const WEAK_ENGINE_MIN_GAP = 20;

export interface EngineSnapshot {
  /** 0-100 score for the engine. */
  score: number;
  /** Number of active (non-deleted) tasks in the engine. */
  taskCount: number;
}

export type EngineSnapshotMap = Record<EngineKey, EngineSnapshot>;

/**
 * Return the weakest engine that's worth surfacing to the user, or null
 * if none of the "weak" criteria are met. Criteria:
 *   - At least 2 engines must be staffed (taskCount > 0).
 *   - Weakest must be strictly below {@link WEAK_ENGINE_SCORE_CEILING}.
 *   - Gap between weakest and strongest staffed engine must be at least
 *     {@link WEAK_ENGINE_MIN_GAP}.
 *   - Ties (everyone at the same score) return null.
 *
 * On ties among multiple "weakest" candidates with the same score, the
 * first in {@link ENGINES} wins — stable ordering for deterministic UI.
 */
export function selectWeakEngine(snapshot: EngineSnapshotMap): EngineKey | null {
  const staffed = ENGINES.filter((e) => snapshot[e].taskCount > 0);
  if (staffed.length < 2) return null;

  const ranked = staffed
    .map((e) => ({ engine: e, score: snapshot[e].score }))
    .sort((a, b) => a.score - b.score);

  const weakest = ranked[0];
  const strongest = ranked[ranked.length - 1];

  if (weakest.score === strongest.score) return null;
  if (weakest.score >= WEAK_ENGINE_SCORE_CEILING) return null;
  if (strongest.score - weakest.score < WEAK_ENGINE_MIN_GAP) return null;

  return weakest.engine;
}

/**
 * Return the strongest staffed engine, or null when fewer than 2 engines
 * are staffed or all scores are tied. The "strong" concept is a mirror of
 * the weak one: if there's no meaningful difference, don't call anyone
 * out.
 */
export function selectStrongEngine(snapshot: EngineSnapshotMap): EngineKey | null {
  const staffed = ENGINES.filter((e) => snapshot[e].taskCount > 0);
  if (staffed.length < 2) return null;

  const ranked = staffed
    .map((e) => ({ engine: e, score: snapshot[e].score }))
    .sort((a, b) => b.score - a.score);

  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];

  if (strongest.score === weakest.score) return null;

  return strongest.engine;
}

/**
 * Build a snapshot from the raw inputs the UI already has on hand. Pure
 * helper — services/React Query data goes in, a typed map comes out.
 */
export function buildEngineSnapshot(input: {
  scores: Record<EngineKey, number>;
  taskCounts: Record<EngineKey, number>;
}): EngineSnapshotMap {
  const out = {} as EngineSnapshotMap;
  for (const engine of ENGINES) {
    out[engine] = {
      score: Math.max(0, Math.min(100, Math.round(input.scores[engine] ?? 0))),
      taskCount: Math.max(0, input.taskCounts[engine] ?? 0),
    };
  }
  return out;
}
