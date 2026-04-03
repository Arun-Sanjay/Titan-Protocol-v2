import { getJSON, setJSON } from "../db/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Rank =
  | "initiate"
  | "operative"
  | "agent"
  | "specialist"
  | "commander"
  | "vanguard"
  | "sentinel"
  | "titan";

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

export const RANK_ORDER: Rank[] = [
  "initiate",
  "operative",
  "agent",
  "specialist",
  "commander",
  "vanguard",
  "sentinel",
  "titan",
];

export const RANK_REQUIREMENTS: Record<Rank, RankRequirement> = {
  initiate:   { avgScore: 0,  consecutiveDays: 0,  extra: null },
  operative:  { avgScore: 40, consecutiveDays: 5,  extra: null },
  agent:      { avgScore: 50, consecutiveDays: 7,  extra: null },
  specialist: { avgScore: 60, consecutiveDays: 14, extra: null },
  commander:  { avgScore: 70, consecutiveDays: 21, extra: null },
  vanguard:   { avgScore: 75, consecutiveDays: 25, extra: null },
  sentinel:   { avgScore: 80, consecutiveDays: 30, extra: null },
  titan:      { avgScore: 85, consecutiveDays: 30, extra: "s_field_op_cleared" },
};

export const RANK_COLORS: Record<Rank, string> = {
  initiate:   "#6B7280",
  operative:  "#9CA3AF",
  agent:      "#A78BFA",
  specialist: "#60A5FA",
  commander:  "#34D399",
  vanguard:   "#FBBF24",
  sentinel:   "#F97316",
  titan:      "#FF4444",
};

export const RANK_NAMES: Record<Rank, string> = {
  initiate:   "Initiate",
  operative:  "Operative",
  agent:      "Agent",
  specialist: "Specialist",
  commander:  "Commander",
  vanguard:   "Vanguard",
  sentinel:   "Sentinel",
  titan:      "Titan",
};

export const RANK_ABBREVIATIONS: Record<Rank, string> = {
  initiate:   "INI",
  operative:  "OPR",
  agent:      "AGT",
  specialist: "SPC",
  commander:  "CMD",
  vanguard:   "VGD",
  sentinel:   "SNT",
  titan:      "TTN",
};

const MMKV_KEY = "player_rank";
const WARNING_THRESHOLD = 7;
const DEMOTION_THRESHOLD = 14;

// ─── Migration ───────────────────────────────────────────────────────────────

/** Legacy rank values from the old E/D/C/B/A/S system. */
type LegacyRank = "E" | "D" | "C" | "B" | "A" | "S";

const LEGACY_RANK_MAP: Record<LegacyRank, Rank> = {
  E: "initiate",
  D: "agent",
  C: "specialist",
  B: "commander",
  A: "sentinel",
  S: "titan",
};

/**
 * Migrate a rank value from the old E/D/C/B/A/S system to the new IDs.
 * Returns the input unchanged if it is already a valid new-system rank.
 */
export function migrateRank(raw: string): Rank {
  // Already a valid new rank
  if ((RANK_ORDER as string[]).includes(raw)) {
    return raw as Rank;
  }
  // Legacy rank
  if (raw in LEGACY_RANK_MAP) {
    return LEGACY_RANK_MAP[raw as LegacyRank];
  }
  // Unknown value -- fall back to initiate
  return "initiate";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

function hasClearedSFieldOp(): boolean {
  const history = getJSON<Array<{ fieldOpId: string; completed: boolean }>>(
    "field_op_history",
    [],
  );
  const sRankFieldOpIds = new Set([
    "the_final_trial",
    "titan_proving_ground",
  ]);
  return history.some(
    (entry) => entry.completed && sRankFieldOpIds.has(entry.fieldOpId),
  );
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/** Load current rank state from MMKV, migrating legacy ranks if needed. */
export function loadRank(): RankState {
  const raw = getJSON<RankState & { rank: string }>(MMKV_KEY, {
    rank: "initiate",
    qualifyingDays: 0,
    consecutiveDaysBelow: 0,
  });

  const migrated = migrateRank(raw.rank);

  // Persist migration if the rank value changed
  if (migrated !== raw.rank) {
    const updated: RankState = {
      rank: migrated,
      qualifyingDays: raw.qualifyingDays,
      consecutiveDaysBelow: raw.consecutiveDaysBelow,
    };
    setJSON(MMKV_KEY, updated);
    return updated;
  }

  return {
    rank: migrated,
    qualifyingDays: raw.qualifyingDays,
    consecutiveDaysBelow: raw.consecutiveDaysBelow,
  };
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
        // Check extra conditions (titan rank requires field op clear)
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

// ─── Utility Functions ───────────────────────────────────────────────────────

/** Get the display color for a rank. */
export function getRankColor(rank: string): string {
  return RANK_COLORS[rank as Rank] ?? RANK_COLORS.initiate;
}

/**
 * Returns the requirements for the next rank, or null if already at titan rank.
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
 * Returns 100 if already at titan rank.
 */
export function getRankProgress(rank: string, qualifyingDays: number): number {
  const next = getNextRankRequirement(rank);
  if (!next) return 100;
  if (next.consecutiveDays === 0) return 100;
  return Math.min(100, Math.round((qualifyingDays / next.consecutiveDays) * 100));
}
