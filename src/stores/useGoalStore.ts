import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";
import type { Goal } from "../db/schema";

// ─── Store ──────────────────────────────────────────────────────────────────

type GoalState = {
  goals: Goal[];

  addGoal: (goal: Omit<Goal, "id" | "created_at">) => void;
  removeGoal: (id: number) => void;
  load: () => void;
};

export const useGoalStore = create<GoalState>((set) => ({
  goals: getJSON<Goal[]>("user_goals", []),

  addGoal: (goalData) => {
    const id = nextId();
    const goal: Goal = {
      ...goalData,
      id,
      created_at: Date.now(),
    };
    set((s) => {
      const goals = [...s.goals, goal];
      setJSON("user_goals", goals);
      return { goals };
    });
  },

  removeGoal: (id) => {
    set((s) => {
      const goals = s.goals.filter((g) => g.id !== id);
      setJSON("user_goals", goals);
      return { goals };
    });
  },

  load: () => {
    const goals = getJSON<Goal[]>("user_goals", []);
    set({ goals });
  },
}));
