import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

export type ExerciseOption = {
  id: string;
  text: string;
  description?: string;
};

export type Exercise = {
  id: string;
  type: string;
  category: string;
  scenario: string;
  question: string;
  options: ExerciseOption[];
  correct: string;
  explanation: string;
  insight?: string;
};

type ExerciseResult = {
  type: string;
  category?: string;
  exerciseId?: string;
  correct: boolean;
  timestamp: number;
};

type SRSCard = {
  exerciseId: string;
  interval: number;
  easeFactor: number;
  nextReview: string;
};

type MindTrainingStats = {
  totalCompleted: number;
  totalCorrect: number;
  streak: number;
};

type MindTrainingState = {
  stats: MindTrainingStats;
  exerciseHistory: ExerciseResult[];
  srsCards: SRSCard[];

  recordResult: (result: ExerciseResult) => void;
  getHabitStats: () => { accuracy: number; total: number };
};

export const useMindTrainingStore = create<MindTrainingState>((set, get) => ({
  stats: getJSON<MindTrainingStats>("mind_training_stats", {
    totalCompleted: 0,
    totalCorrect: 0,
    streak: 0,
  }),
  exerciseHistory: getJSON<ExerciseResult[]>("mind_training_history", []),
  srsCards: getJSON<SRSCard[]>("mind_srs_cards", []),

  recordResult: (result) => {
    set((s) => {
      const history = [...s.exerciseHistory, result];
      const stats: MindTrainingStats = {
        totalCompleted: s.stats.totalCompleted + 1,
        totalCorrect: s.stats.totalCorrect + (result.correct ? 1 : 0),
        streak: result.correct ? s.stats.streak + 1 : 0,
      };
      setJSON("mind_training_history", history);
      setJSON("mind_training_stats", stats);
      return { exerciseHistory: history, stats };
    });
  },

  getHabitStats: () => {
    const { stats } = get();
    const accuracy =
      stats.totalCompleted > 0
        ? Math.round((stats.totalCorrect / stats.totalCompleted) * 100)
        : 0;
    return { accuracy, total: stats.totalCompleted };
  },
}));
