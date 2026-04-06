import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import { createSRSCard, getDueCards as getSRSDueCards, type SRSCard } from "../lib/srs";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ExerciseType =
  | "bias_check"
  | "decision_drill"
  | "knowledge_drop"
  | "recall";

export type Exercise = {
  id: string;
  type: ExerciseType;
  difficulty: 1 | 2 | 3 | 4 | 5;
  category: string;
  scenario: string;
  question: string;
  options: { id: string; text: string; description?: string }[];
  correct: string;
  explanation: string;
  insight?: string;
  identity_tags?: string[];
};

export type ExerciseResult = {
  exerciseId: string;
  type: ExerciseType;
  category: string;
  correct: boolean;
  selectedOption: string;
  answeredAt: string;
  timeSpentMs?: number;
};

export type MindStats = {
  totalCompleted: number;
  totalCorrect: number;
  accuracy: number;
  byType: Record<string, { completed: number; correct: number; accuracy: number }>;
  byCategory: Record<string, { completed: number; correct: number }>;
};

// ─── MMKV keys ──────────────────────────────────────────────────────────────

const HISTORY_KEY = "exercise_history";
const STATS_KEY = "mind_stats";
const SEEN_KEY = "exercises_seen";
const SRS_KEY = "srs_cards";

// ─── Store ──────────────────────────────────────────────────────────────────

type MindTrainingState = {
  exerciseHistory: ExerciseResult[];
  seenIds: string[];
  currentExercise: Exercise | null;
  stats: MindStats;
  srsCards: SRSCard[];

  /** Set current exercise for display */
  startExercise: (exercise: Exercise) => void;
  /** Submit answer, returns whether correct. Also creates SRS card for new exercises. */
  submitAnswer: (exerciseId: string, selectedOption: string, correct: boolean, type: ExerciseType, category: string) => boolean;
  /** Get IDs of exercises not yet seen */
  getUnseenIds: (allIds: string[]) => string[];
  /** Get stats */
  getStats: () => MindStats;
  /** Get SRS cards due for review */
  getDueCards: () => SRSCard[];
  /** Update an SRS card after a recall challenge */
  updateSRSCard: (updatedCard: SRSCard) => void;
  /** Load from MMKV */
  load: () => void;
};

const EMPTY_STATS: MindStats = {
  totalCompleted: 0,
  totalCorrect: 0,
  accuracy: 0,
  byType: {},
  byCategory: {},
};

function recomputeStats(history: ExerciseResult[]): MindStats {
  if (history.length === 0) return EMPTY_STATS;

  const byType: MindStats["byType"] = {};
  const byCategory: MindStats["byCategory"] = {};
  let totalCorrect = 0;

  for (const r of history) {
    if (r.correct) totalCorrect++;

    // By type
    if (!byType[r.type]) byType[r.type] = { completed: 0, correct: 0, accuracy: 0 };
    byType[r.type].completed++;
    if (r.correct) byType[r.type].correct++;
    byType[r.type].accuracy = Math.round((byType[r.type].correct / byType[r.type].completed) * 100);

    // By category
    if (r.category) {
      if (!byCategory[r.category]) byCategory[r.category] = { completed: 0, correct: 0 };
      byCategory[r.category].completed++;
      if (r.correct) byCategory[r.category].correct++;
    }
  }

  return {
    totalCompleted: history.length,
    totalCorrect,
    accuracy: Math.round((totalCorrect / history.length) * 100),
    byType,
    byCategory,
  };
}

function persistAll(history: ExerciseResult[], seen: string[], stats: MindStats, srsCards?: SRSCard[]) {
  setJSON(HISTORY_KEY, history);
  setJSON(SEEN_KEY, seen);
  setJSON(STATS_KEY, stats);
  if (srsCards !== undefined) setJSON(SRS_KEY, srsCards);
}

export const useMindTrainingStore = create<MindTrainingState>()((set, get) => ({
  exerciseHistory: [],
  seenIds: [],
  currentExercise: null,
  stats: EMPTY_STATS,
  srsCards: [],

  startExercise: (exercise) => {
    set({ currentExercise: exercise });
  },

  submitAnswer: (exerciseId, selectedOption, correct, type, category) => {
    const { exerciseHistory, seenIds, srsCards } = get();

    const result: ExerciseResult = {
      exerciseId,
      type,
      category,
      correct,
      selectedOption,
      answeredAt: new Date().toISOString(),
    };

    const newHistory = [...exerciseHistory, result];
    const newSeen = seenIds.includes(exerciseId) ? seenIds : [...seenIds, exerciseId];
    const newStats = recomputeStats(newHistory);

    // Create SRS card if this is the first time seeing this exercise
    let newCards = srsCards;
    if (!srsCards.some((c) => c.exerciseId === exerciseId)) {
      newCards = [...srsCards, createSRSCard(exerciseId)];
    }

    set({
      exerciseHistory: newHistory,
      seenIds: newSeen,
      currentExercise: null,
      stats: newStats,
      srsCards: newCards,
    });
    persistAll(newHistory, newSeen, newStats, newCards);

    return correct;
  },

  getUnseenIds: (allIds) => {
    const { seenIds } = get();
    return allIds.filter((id) => !seenIds.includes(id));
  },

  getStats: () => get().stats,

  getDueCards: () => {
    return getSRSDueCards(get().srsCards);
  },

  updateSRSCard: (updatedCard) => {
    const { srsCards } = get();
    const newCards = srsCards.map((c) =>
      c.exerciseId === updatedCard.exerciseId ? updatedCard : c,
    );
    set({ srsCards: newCards });
    setJSON(SRS_KEY, newCards);
  },

  load: () => {
    const history = getJSON<ExerciseResult[]>(HISTORY_KEY, []);
    const seen = getJSON<string[]>(SEEN_KEY, []);
    const stats = getJSON<MindStats>(STATS_KEY, EMPTY_STATS);
    const srsCards = getJSON<SRSCard[]>(SRS_KEY, []);
    set({ exerciseHistory: history, seenIds: seen, stats, srsCards });
  },
}));

// ─── Selectors ──────────────────────────────────────────────────────────────

export function selectAccuracyForType(stats: MindStats, type: ExerciseType): number {
  return stats.byType[type]?.accuracy ?? 0;
}

export function selectConsecutiveCorrect(history: ExerciseResult[]): number {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].correct) streak++;
    else break;
  }
  return streak;
}
