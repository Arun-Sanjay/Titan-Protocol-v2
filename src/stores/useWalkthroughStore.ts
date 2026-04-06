import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { EngineKey } from "../db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WalkthroughTask = {
  title: string;
  kind: "main" | "secondary";
};

export type WalkthroughHabit = {
  title: string;
  trigger: string;
  icon: string;
  engine: string;
};

export type WalkthroughGoal = {
  title: string;
  engine: EngineKey;
};

const WALKTHROUGH_COMPLETED_KEY = "walkthrough_completed";
const WALKTHROUGH_PINNED_TOOLS_KEY = "pinned_tools";

// ─── Store ────────────────────────────────────────────────────────────────────

type WalkthroughState = {
  page: number;
  completed: boolean;

  // Per-engine tasks configured during walkthrough
  engineTasks: Record<EngineKey, WalkthroughTask[]>;
  habits: WalkthroughHabit[];
  goals: WalkthroughGoal[];
  pinnedTools: string[];

  load: () => void;
  setPage: (page: number) => void;
  next: () => void;
  back: () => void;

  // Engine task management
  addEngineTask: (engine: EngineKey, task: WalkthroughTask) => void;
  removeEngineTask: (engine: EngineKey, index: number) => void;

  // Habit management
  addHabit: (habit: WalkthroughHabit) => void;
  removeHabit: (index: number) => void;

  // Goal management
  addGoal: (goal: WalkthroughGoal) => void;
  removeGoal: (index: number) => void;

  // Tools
  toggleTool: (tool: string) => void;
  setPinnedTools: (tools: string[]) => void;

  // Completion
  finish: () => void;
};

export const useWalkthroughStore = create<WalkthroughState>()((set, get) => ({
  page: 0,
  completed: getJSON<boolean>(WALKTHROUGH_COMPLETED_KEY, false),
  engineTasks: { body: [], mind: [], money: [], charisma: [] },
  habits: [],
  goals: [],
  pinnedTools: getJSON<string[]>(WALKTHROUGH_PINNED_TOOLS_KEY, []),

  load: () => {
    set({
      completed: getJSON<boolean>(WALKTHROUGH_COMPLETED_KEY, false),
      pinnedTools: getJSON<string[]>(WALKTHROUGH_PINNED_TOOLS_KEY, []),
    });
  },

  setPage: (page) => set({ page }),
  next: () => set((s) => ({ page: s.page + 1 })),
  back: () => set((s) => ({ page: Math.max(0, s.page - 1) })),

  addEngineTask: (engine, task) => set((s) => ({
    engineTasks: { ...s.engineTasks, [engine]: [...s.engineTasks[engine], task] },
  })),
  removeEngineTask: (engine, index) => set((s) => ({
    engineTasks: {
      ...s.engineTasks,
      [engine]: s.engineTasks[engine].filter((_, i) => i !== index),
    },
  })),

  addHabit: (habit) => set((s) => ({ habits: [...s.habits, habit] })),
  removeHabit: (index) => set((s) => ({ habits: s.habits.filter((_, i) => i !== index) })),

  addGoal: (goal) => set((s) => ({ goals: [...s.goals, goal] })),
  removeGoal: (index) => set((s) => ({ goals: s.goals.filter((_, i) => i !== index) })),

  toggleTool: (tool) => set((s) => {
    const has = s.pinnedTools.includes(tool);
    const next = has ? s.pinnedTools.filter((t) => t !== tool) : [...s.pinnedTools, tool];
    return { pinnedTools: next };
  }),

  setPinnedTools: (tools) => set({ pinnedTools: tools }),

  finish: () => {
    const { pinnedTools } = get();
    setJSON(WALKTHROUGH_COMPLETED_KEY, true);
    setJSON(WALKTHROUGH_PINNED_TOOLS_KEY, pinnedTools);
    set({ completed: true });
  },
}));
