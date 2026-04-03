import { getJSON, setJSON } from "../db/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Rank = "E" | "D" | "C" | "B" | "A" | "S";

export type RankState = {
  rank: Rank;
  qualifyingDays: number;
  consecutiveDaysBelow: number;
};

type RankRequirement = {
  avgScore: number;
  consecutiveDays: number;
  extra: string | null;
};

type EvaluationResult = {
  promoted: boolean;
  newRank?: Rank;
  warning: boolean;
  demoted: boolean;
  demotedTo?: Rank;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const RANK_REQUIREMENTS: Record<Rank, RankRequirement> = {
  E: { avgScore: 0, consecutiveDays: 0, extra: null },
  D: { avgScore: 50, consecutiveDays: 7, extra: null },
  C: { avgScore: 60, consecutiveDays: 14, extra: null },
  B: { avgScore: 70, consecutiveDays: 21, extra: null },
  A: { avgScore: 80, consecutiveDays: 30, extra: null },
  S: { avgScore: 85, consecutiveDays: 30, extra: "s_field_op_cleared" },
};

export const RANK_ORDER: Rank[] = ["E", "D", "C", "B", "A", "S"];

export const RANK_COLORS: Record<Rank, string> = {
  E: "#6B7280",
  D: "#A78BFA",
  C: "#60A5FA",
  B: "#34D399",
  A: "#FBBF24",
  S: "#F97316",
};

const MMKV_KEY = "player_rank";
const WARNING_THRESHOLD = 7;
const DEMOTION_THRESHOLD = 14;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

function hasClearedSFieldOp(): boolean {
  const history = getJSON<Array<{ fieldOpId: string; completed: boolean }>>(
    "field_op_history",
    [],
  );
  // Load field op definitions lazily to check minRank
  // We check by convention: S-rank field op IDs are "the_final_trial" and "titan_proving_ground"
  const sRankFieldOpIds = new Set([
    "the_final_trial",
    "titan_proving_ground",
  ]);
  return history.some(
    (entry) => entry.completed && sRankFieldOpIds.has(entry.fieldOpId),
  );
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/** Load current rank state from MMKV. */
export function loadRank(): RankState {
  return getJSON<RankState>(MMKV_KEY, {
    rank: "E",
    qualifyingDays: 0,
    consecutiveDaysBelow: 0,
  });
}

/** Persist rank state to MMKV. */
export function saveRank(state: RankState): void {
  setJSON(MMKV_KEY, state);
}

/**
 * Evaluate a day's titan score against rank requirements.
 * Call this once per day after scoring is finalized.
 *
 * - Checks promotion eligibility toward the next rank.
 * - Tracks consecutive days below current rank threshold for demotion.
 * - Warning fires at 7 consecutive days below; demotion at 14.
 */
export function evaluateRankDay(titanScore: number): EvaluationResult {
  const state = loadRank();
  const result: EvaluationResult = {
    promoted: false,
    warning: false,
    demoted: false,
  };

  const currentIdx = rankIndex(state.rank);
  const nextIdx = currentIdx + 1;

  // ── Promotion check ─────────────────────────────────────────────────────
  if (nextIdx < RANK_ORDER.length) {
    const nextRank = RANK_ORDER[nextIdx];
    const req = RANK_REQUIREMENTS[nextRank];

    if (titanScore >= req.avgScore) {
      state.qualifyingDays += 1;

      if (state.qualifyingDays >= req.consecutiveDays) {
        // Check extra conditions (S-rank requires field op clear)
        const extraSatisfied =
          req.extra === "s_field_op_cleared"
            ? hasClearedSFieldOp()
            : true;

        if (extraSatisfied) {
          state.rank = nextRank;
          state.qualifyingDays = 0;
          state.consecutiveDaysBelow = 0;
          result.promoted = true;
          result.newRank = nextRank;
          saveRank(state);
          return result;
        }
      }
    } else {
      // Reset qualifying progress if score drops below next-rank threshold
      state.qualifyingDays = 0;
    }
  }

  // ── Demotion check ──────────────────────────────────────────────────────
  if (currentIdx > 0) {
    const currentReq = RANK_REQUIREMENTS[state.rank];
    if (titanScore < currentReq.avgScore) {
      state.consecutiveDaysBelow += 1;

      if (state.consecutiveDaysBelow >= DEMOTION_THRESHOLD) {
        const demotedRank = RANK_ORDER[currentIdx - 1];
        state.rank = demotedRank;
        state.consecutiveDaysBelow = 0;
        state.qualifyingDays = 0;
        result.demoted = true;
        result.demotedTo = demotedRank;
      } else if (state.consecutiveDaysBelow >= WARNING_THRESHOLD) {
        result.warning = true;
      }
    } else {
      state.consecutiveDaysBelow = 0;
    }
  }

  saveRank(state);
  return result;
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/** Get the display color for a rank. */
export function getRankColor(rank: string): string {
  return RANK_COLORS[rank as Rank] ?? RANK_COLORS.E;
}

/**
 * Returns the requirements for the next rank, or null if already S-rank.
 */
export function getNextRankRequirement(
  rank: string,
): { rank: Rank; avgScore: number; consecutiveDays: number } | null {
  const idx = rankIndex(rank as Rank);
  if (idx < 0 || idx >= RANK_ORDER.length - 1) return null;

  const nextRank = RANK_ORDER[idx + 1];
  const req = RANK_REQUIREMENTS[nextRank];
  return {
    rank: nextRank,
    avgScore: req.avgScore,
    consecutiveDays: req.consecutiveDays,
  };
}

/**
 * Returns 0-100 progress toward the next rank based on qualifying days.
 * Returns 100 if already at S-rank.
 */
export function getRankProgress(rank: string, qualifyingDays: number): number {
  const next = getNextRankRequirement(rank);
  if (!next) return 100;
  if (next.consecutiveDays === 0) return 100;
  return Math.min(100, Math.round((qualifyingDays / next.consecutiveDays) * 100));
}
