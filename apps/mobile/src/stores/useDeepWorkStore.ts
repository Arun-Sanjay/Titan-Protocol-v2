import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";
import { toLocalDateKey, addDays, getTodayKey } from "../lib/date";

// ─── Types ──────────────────────────────────────────────────────────────────

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

export type DeepWorkLog = {
  id: number;
  taskId: number;
  dateKey: string;
  completed: boolean;
  earningsToday: number;
};

// ─── MMKV keys ──────────────────────────────────────────────────────────────

const TASKS_KEY = "deep_work_tasks";
const LOGS_KEY = "deep_work_logs";

// ─── Store ──────────────────────────────────────────────────────────────────

type DeepWorkState = {
  tasks: DeepWorkTask[];
  logs: DeepWorkLog[];

  load: () => void;
  addTask: (taskName: string, category: DeepWorkCategory) => void;
  deleteTask: (id: number) => void;
  logWork: (taskId: number, dateKey: string, completed: boolean, earnings: number) => void;
  getLogsByDate: (dateKey: string) => DeepWorkLog[];
  getWeeklyEarnings: (endDate: string) => number;
};

export const useDeepWorkStore = create<DeepWorkState>()((set, get) => ({
  tasks: [],
  logs: [],

  load: () => {
    const tasks = getJSON<DeepWorkTask[]>(TASKS_KEY, []);
    const logs = getJSON<DeepWorkLog[]>(LOGS_KEY, []);
    set({ tasks, logs });
  },

  addTask: (taskName, category) => {
    const id = nextId();
    const task: DeepWorkTask = { id, taskName, category, createdAt: Date.now() };
    const tasks = [...get().tasks, task];
    setJSON(TASKS_KEY, tasks);
    set({ tasks });
  },

  deleteTask: (id) => {
    const tasks = get().tasks.filter((t) => t.id !== id);
    // Also remove associated logs
    const logs = get().logs.filter((l) => l.taskId !== id);
    setJSON(TASKS_KEY, tasks);
    setJSON(LOGS_KEY, logs);
    set({ tasks, logs });
  },

  logWork: (taskId, dateKey, completed, earnings) => {
    const safeEarnings = Number.isFinite(earnings) ? Math.max(0, earnings) : 0;
    const existing = get().logs.find((l) => l.taskId === taskId && l.dateKey === dateKey);

    let logs: DeepWorkLog[];
    if (existing) {
      logs = get().logs.map((l) =>
        l.id === existing.id ? { ...l, completed, earningsToday: safeEarnings } : l
      );
    } else {
      const log: DeepWorkLog = {
        id: nextId(),
        taskId,
        dateKey,
        completed,
        earningsToday: safeEarnings,
      };
      logs = [...get().logs, log];
    }

    setJSON(LOGS_KEY, logs);
    set({ logs });
  },

  getLogsByDate: (dateKey) => {
    return get().logs.filter((l) => l.dateKey === dateKey);
  },

  getWeeklyEarnings: (endDate) => {
    // Calculate the date 7 days before endDate using local-timezone-safe addDays
    const startKey = addDays(endDate, -6); // 7-day window including endDate

    return get()
      .logs.filter((l) => l.dateKey >= startKey && l.dateKey <= endDate)
      .reduce((sum, l) => sum + l.earningsToday, 0);
  },
}));
