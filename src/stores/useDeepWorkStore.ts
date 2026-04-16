import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types (re-exported via lib/deep-work-helpers.ts) ───────────────────────

export type DeepWorkCategory =
  | "Main Job / College"
  | "Side Hustle"
  | "Freelance"
  | "Investments"
  | "Other";

export type DeepWorkTask = {
  id: number;
  taskName: string;
  category: DeepWorkCategory;
  createdAt: number;
};

// ─── Store ───────────────────────────────────────────────────────���──────────

type DeepWorkState = {
  tasks: DeepWorkTask[];
  todayMinutes: number;
  goalMinutes: number;

  addTask: (task: Omit<DeepWorkTask, "id">) => void;
  completeTask: (id: number) => void;
  setGoalMinutes: (minutes: number) => void;
  load: () => void;
};

export const useDeepWorkStore = create<DeepWorkState>((set) => ({
  tasks: getJSON<DeepWorkTask[]>("deep_work_tasks", []),
  todayMinutes: getJSON<number>("deep_work_today_min", 0),
  goalMinutes: getJSON<number>("deep_work_goal_min", 120),

  addTask: (taskData) => {
    set((s) => {
      const id = Date.now();
      const task: DeepWorkTask = { ...taskData, id };
      const tasks = [...s.tasks, task];
      setJSON("deep_work_tasks", tasks);
      return { tasks };
    });
  },

  completeTask: (id) => {
    // Mark task as complete (no-op in store, handled by logs)
  },

  setGoalMinutes: (minutes) => {
    setJSON("deep_work_goal_min", minutes);
    set({ goalMinutes: minutes });
  },

  load: () => {
    set({
      tasks: getJSON<DeepWorkTask[]>("deep_work_tasks", []),
      todayMinutes: getJSON<number>("deep_work_today_min", 0),
      goalMinutes: getJSON<number>("deep_work_goal_min", 120),
    });
  },
}));
