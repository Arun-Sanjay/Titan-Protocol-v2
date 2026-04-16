import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { EngineKey } from "../db/schema";

export type WalkthroughTask = { title: string; kind: "main" | "secondary" };
export type WalkthroughHabit = { title: string; trigger: string; icon: string; engine: string };
export type WalkthroughGoal = { title: string; engine: string };

type WalkthroughState = {
  page: number;
  completed: boolean;
  engineTasks: Record<EngineKey, WalkthroughTask[]>;
  habits: WalkthroughHabit[];
  goals: WalkthroughGoal[];
  pinnedTools: string[];

  next: () => void;
  back: () => void;
  finish: () => void;
  addEngineTask: (engine: EngineKey, task: WalkthroughTask) => void;
  removeEngineTask: (engine: EngineKey, index: number) => void;
  addGoal: (goal: WalkthroughGoal) => void;
  removeGoal: (index: number) => void;
  addHabit: (habit: WalkthroughHabit) => void;
  removeHabit: (index: number) => void;
  toggleTool: (tool: string) => void;
  setPinnedTools: (tools: string[]) => void;
};

const DEFAULT_ENGINE_TASKS: Record<EngineKey, WalkthroughTask[]> = {
  body: [],
  mind: [],
  money: [],
  charisma: [],
};

export const useWalkthroughStore = create<WalkthroughState>((set, get) => ({
  page: getJSON<number>("walkthrough_page", 0),
  completed: getJSON<boolean>("walkthrough_completed", false),
  engineTasks: getJSON("walkthrough_engine_tasks", DEFAULT_ENGINE_TASKS),
  habits: getJSON<WalkthroughHabit[]>("walkthrough_habits", []),
  goals: getJSON<WalkthroughGoal[]>("walkthrough_goals", []),
  pinnedTools: getJSON<string[]>("walkthrough_pinned_tools", []),

  next: () => {
    const nextPage = get().page + 1;
    setJSON("walkthrough_page", nextPage);
    set({ page: nextPage });
  },

  back: () => {
    const prevPage = Math.max(0, get().page - 1);
    setJSON("walkthrough_page", prevPage);
    set({ page: prevPage });
  },

  finish: () => {
    setJSON("walkthrough_completed", true);
    set({ completed: true });
  },

  addEngineTask: (engine, task) => {
    set((s) => {
      const updated = {
        ...s.engineTasks,
        [engine]: [...s.engineTasks[engine], task],
      };
      setJSON("walkthrough_engine_tasks", updated);
      return { engineTasks: updated };
    });
  },

  removeEngineTask: (engine, index) => {
    set((s) => {
      const updated = {
        ...s.engineTasks,
        [engine]: s.engineTasks[engine].filter((_, i) => i !== index),
      };
      setJSON("walkthrough_engine_tasks", updated);
      return { engineTasks: updated };
    });
  },

  addGoal: (goal) => {
    set((s) => {
      const updated = [...s.goals, goal];
      setJSON("walkthrough_goals", updated);
      return { goals: updated };
    });
  },

  removeGoal: (index) => {
    set((s) => {
      const updated = s.goals.filter((_, i) => i !== index);
      setJSON("walkthrough_goals", updated);
      return { goals: updated };
    });
  },

  addHabit: (habit) => {
    set((s) => {
      const updated = [...s.habits, habit];
      setJSON("walkthrough_habits", updated);
      return { habits: updated };
    });
  },

  removeHabit: (index) => {
    set((s) => {
      const updated = s.habits.filter((_, i) => i !== index);
      setJSON("walkthrough_habits", updated);
      return { habits: updated };
    });
  },

  toggleTool: (tool) => {
    set((s) => {
      const has = s.pinnedTools.includes(tool);
      const updated = has
        ? s.pinnedTools.filter((t) => t !== tool)
        : [...s.pinnedTools, tool];
      setJSON("walkthrough_pinned_tools", updated);
      return { pinnedTools: updated };
    });
  },

  setPinnedTools: (tools) => {
    setJSON("walkthrough_pinned_tools", tools);
    set({ pinnedTools: tools });
  },
}));
