import { getJSON, setJSON } from "../db/storage";
import titleDefs from "../data/titles.json";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TitleCondition = {
  type:
    | "streak_days"
    | "titan_score"
    | "engine_stat"
    | "field_op_count"
    | "field_op_specific"
    | "rank_achieved"
    | "total_output"
    | "all_engines_score"
    | "day_number"
    | "custom";
  value: number | string;
  engine?: string;
};

export type TitleDef = {
  id: string;
  name: string;
  description: string;
  category: "streak" | "performance" | "ops" | "engine" | "rank" | "special";
  rarity: "common" | "rare" | "epic" | "legendary";
  condition: TitleCondition;
};

export type TitleCheckContext = {
  streak: number;
  titanScore: number;
  engineScores: Record<string, number>;
  stats: Record<string, number>;
  totalOutput: number;
  rank: string;
  fieldOpsCleared: number;
  dayNumber: number;
  protocolCompleteToday: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const RARITY_COLORS: Record<string, string> = {
  common: "#9CA3AF",
  rare: "#34D399",
  epic: "#A78BFA",
  legendary: "#FFD700",
};

const MMKV_UNLOCKED = "titles_unlocked";
const MMKV_EQUIPPED = "title_equipped";

const RANK_ORDER = ["initiate", "operative", "agent", "specialist", "commander", "vanguard", "sentinel", "titan"];

// ─── Condition Evaluator ──────────────────────────────────────────────────────

export function evaluateCondition(
  condition: TitleCondition,
  context: TitleCheckContext,
): boolean {
  switch (condition.type) {
    case "streak_days":
      return context.streak >= (condition.value as number);

    case "titan_score":
      return context.titanScore >= (condition.value as number);

    case "engine_stat": {
      const engine = condition.engine;
      if (!engine) return false;
      return (context.stats[engine] ?? 0) >= (condition.value as number);
    }

    case "field_op_count":
      return context.fieldOpsCleared >= (condition.value as number);

    case "field_op_specific": {
      // value is a rank string (e.g. "S") — check if any field op of that
      // rank tier was cleared. We rely on field op history stored in MMKV.
      const requiredRank = condition.value as string;
      const history = getJSON<
        Array<{ fieldOpId: string; completed: boolean }>
      >("field_op_history", []);
      // S-rank field op IDs by convention
      const titanRankIds = new Set(["the_final_trial", "titan_proving_ground"]);
      const sentinelRankIds = new Set(["the_gauntlet", "peak_protocol"]);
      const commanderRankIds = new Set(["the_crucible", "the_specialist"]);

      const rankIdMap: Record<string, Set<string>> = {
        titan: titanRankIds,
        sentinel: sentinelRankIds,
        commander: commanderRankIds,
      };

      const ids = rankIdMap[requiredRank];
      if (!ids) return false;
      return history.some((e) => e.completed && ids.has(e.fieldOpId));
    }

    case "rank_achieved": {
      const required = condition.value as string;
      return (
        RANK_ORDER.indexOf(context.rank) >= RANK_ORDER.indexOf(required)
      );
    }

    case "total_output":
      return context.totalOutput >= (condition.value as number);

    case "all_engines_score": {
      const threshold = condition.value as number;
      const engines = ["body", "mind", "money", "charisma"];
      return engines.every(
        (e) => (context.engineScores[e] ?? 0) >= threshold,
      );
    }

    case "day_number":
      return context.dayNumber >= (condition.value as number);

    case "custom":
      // Custom conditions are evaluated externally; we just return false
      // here unless the caller has set a flag. The caller should handle
      // these via specific logic before calling checkTitles.
      return false;

    default:
      return false;
  }
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Checks all title definitions against the current context.
 * Returns newly unlocked titles and persists them to MMKV.
 */
export function checkTitles(context: TitleCheckContext): TitleDef[] {
  const unlocked = getJSON<string[]>(MMKV_UNLOCKED, []);
  const unlockedSet = new Set(unlocked);
  const newlyUnlocked: TitleDef[] = [];

  for (const def of titleDefs as TitleDef[]) {
    if (unlockedSet.has(def.id)) continue;
    if (evaluateCondition(def.condition, context)) {
      newlyUnlocked.push(def);
      unlockedSet.add(def.id);
    }
  }

  if (newlyUnlocked.length > 0) {
    setJSON(MMKV_UNLOCKED, Array.from(unlockedSet));
  }

  return newlyUnlocked;
}

/** Returns IDs of all unlocked titles. */
export function getUnlockedTitles(): string[] {
  return getJSON<string[]>(MMKV_UNLOCKED, []);
}

/** Returns the currently equipped title ID, or null. */
export function getEquippedTitle(): string | null {
  return getJSON<string | null>(MMKV_EQUIPPED, null);
}

/** Equip a title by ID. */
export function equipTitle(titleId: string): void {
  setJSON(MMKV_EQUIPPED, titleId);
}

/** Unequip the current title. */
export function unequipTitle(): void {
  setJSON(MMKV_EQUIPPED, null);
}

/** Look up a title definition by ID. */
export function getTitleDef(titleId: string): TitleDef | undefined {
  return (titleDefs as TitleDef[]).find((t) => t.id === titleId);
}

/** Returns all title definitions. */
export function getAllTitleDefs(): TitleDef[] {
  return titleDefs as TitleDef[];
}
