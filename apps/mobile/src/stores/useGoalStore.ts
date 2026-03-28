import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";
import type { Goal, GoalTask } from "../db/schema";

const GOALS_KEY = "goals";
function goalTasksKey(goalId: number) {
  return `goal_tasks:${goalId}`;
}

type GoalState = {
  goals: Goal[];
  goalTasks: Record<number, GoalTask[]>;

  load: () => void;
  addGoal: (goal: Omit<Goal, "id" | "created_at">) => number;
  deleteGoal: (id: number) => void;
  loadGoalTasks: (goalId: number) => void;
  addGoalTask: (goalId: number, title: string) => void;
  toggleGoalTask: (taskId: number, goalId: number) => void;
};

export const useGoalStore = create<GoalState>()((set, get) => ({
  goals: [],
  goalTasks: {},

  load: () => {
    set({ goals: getJSON<Goal[]>(GOALS_KEY, []) });
  },

  addGoal: (goalData) => {
    const id = nextId();
    const goal: Goal = { ...goalData, id, created_at: Date.now() };
    const goals = [...get().goals, goal];
    setJSON(GOALS_KEY, goals);
    set({ goals });
    return id;
  },

  deleteGoal: (id) => {
    const goals = get().goals.filter((g) => g.id !== id);
    setJSON(GOALS_KEY, goals);
    set({ goals });
  },

  loadGoalTasks: (goalId) => {
    const tasks = getJSON<GoalTask[]>(goalTasksKey(goalId), []);
    set((s) => ({ goalTasks: { ...s.goalTasks, [goalId]: tasks } }));
  },

  addGoalTask: (goalId, title) => {
    const id = nextId();
    const task: GoalTask = {
      id,
      goal_id: goalId,
      title,
      task_type: "once",
      engine: null,
      completed: 0,
      created_at: Date.now(),
    };
    const tasks = [...(get().goalTasks[goalId] ?? []), task];
    setJSON(goalTasksKey(goalId), tasks);
    set((s) => ({ goalTasks: { ...s.goalTasks, [goalId]: tasks } }));
  },

  toggleGoalTask: (taskId, goalId) => {
    const tasks = (get().goalTasks[goalId] ?? []).map((t) =>
      t.id === taskId ? { ...t, completed: t.completed === 1 ? 0 : 1 } : t,
    );
    setJSON(goalTasksKey(goalId), tasks);
    set((s) => ({ goalTasks: { ...s.goalTasks, [goalId]: tasks } }));
  },
}));
