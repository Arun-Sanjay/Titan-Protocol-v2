import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";
import type { EngineKey, Task } from "../db/schema";

export const ENGINES: EngineKey[] = ["body", "mind", "money", "general"];

function tasksKey(engine: EngineKey) {
  return `tasks:${engine}`;
}
function completionsKey(engine: EngineKey, dateKey: string) {
  return `completions:${engine}:${dateKey}`;
}

export type TaskWithStatus = Task & { completed: boolean };

type EngineState = {
  tasks: Record<EngineKey, Task[]>;
  completions: Record<string, number[]>;
  scores: Record<string, number>;

  loadEngine: (engine: EngineKey, dateKey: string) => void;
  loadAllEngines: (dateKey: string) => void;
  addTask: (engine: EngineKey, title: string, kind: "main" | "secondary") => void;
  deleteTask: (engine: EngineKey, taskId: number) => void;
  toggleTask: (engine: EngineKey, taskId: number, dateKey: string) => boolean;
  loadDateRange: (startDate: string, endDate: string) => void;
};

function computeScore(tasks: Task[], completedIds: Set<number>): number {
  if (tasks.length === 0) return 0;
  let earned = 0;
  let total = 0;
  for (const t of tasks) {
    const pts = t.kind === "main" ? 2 : 1;
    total += pts;
    if (completedIds.has(t.id!)) earned += pts;
  }
  return total === 0 ? 0 : Math.round((earned / total) * 100);
}

export const useEngineStore = create<EngineState>()((set, get) => ({
  tasks: { body: [], mind: [], money: [], general: [] },
  completions: {},
  scores: {},

  loadEngine: (engine, dateKey) => {
    const tasks = getJSON<Task[]>(tasksKey(engine), []).filter(
      (t) => t.is_active === 1
    );
    const cKey = `${engine}:${dateKey}`;
    const ids = getJSON<number[]>(completionsKey(engine, dateKey), []);
    const score = computeScore(tasks, new Set(ids));

    set((s) => ({
      tasks: { ...s.tasks, [engine]: tasks },
      completions: { ...s.completions, [cKey]: ids },
      scores: { ...s.scores, [cKey]: score },
    }));
  },

  loadAllEngines: (dateKey) => {
    const newTasks: Record<string, Task[]> = {};
    const newCompletions: Record<string, number[]> = {};
    const newScores: Record<string, number> = {};

    for (const engine of ENGINES) {
      const tasks = getJSON<Task[]>(tasksKey(engine), []).filter(
        (t) => t.is_active === 1
      );
      const cKey = `${engine}:${dateKey}`;
      const ids = getJSON<number[]>(completionsKey(engine, dateKey), []);
      newTasks[engine] = tasks;
      newCompletions[cKey] = ids;
      newScores[cKey] = computeScore(tasks, new Set(ids));
    }

    set({
      tasks: newTasks as Record<EngineKey, Task[]>,
      completions: { ...get().completions, ...newCompletions },
      scores: { ...get().scores, ...newScores },
    });
  },

  addTask: (engine, title, kind) => {
    const id = nextId();
    const task: Task = {
      id,
      engine,
      title,
      kind,
      created_at: Date.now(),
      days_per_week: 7,
      is_active: 1,
    };
    const allTasks = getJSON<Task[]>(tasksKey(engine), []);
    allTasks.push(task);
    setJSON(tasksKey(engine), allTasks);

    set((s) => ({
      tasks: {
        ...s.tasks,
        [engine]: allTasks.filter((t) => t.is_active === 1),
      },
    }));
  },

  deleteTask: (engine, taskId) => {
    const allTasks = getJSON<Task[]>(tasksKey(engine), []).filter(
      (t) => t.id !== taskId
    );
    setJSON(tasksKey(engine), allTasks);

    set((s) => ({
      tasks: {
        ...s.tasks,
        [engine]: allTasks.filter((t) => t.is_active === 1),
      },
    }));
  },

  toggleTask: (engine, taskId, dateKey) => {
    const cKey = `${engine}:${dateKey}`;
    const key = completionsKey(engine, dateKey);
    const ids = getJSON<number[]>(key, []);
    const idx = ids.indexOf(taskId);
    let completed: boolean;

    if (idx !== -1) {
      ids.splice(idx, 1);
      completed = false;
    } else {
      ids.push(taskId);
      completed = true;
    }
    setJSON(key, ids);

    const tasks = get().tasks[engine];
    const score = computeScore(tasks, new Set(ids));

    set((s) => ({
      completions: { ...s.completions, [cKey]: ids },
      scores: { ...s.scores, [cKey]: score },
    }));

    return completed;
  },

  loadDateRange: (startDate, endDate) => {
    const newCompletions: Record<string, number[]> = {};
    const newScores: Record<string, number> = {};
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dk = d.toISOString().slice(0, 10);
      for (const engine of ENGINES) {
        const cKey = `${engine}:${dk}`;
        if (get().scores[cKey] !== undefined) continue; // already loaded
        const tasks = get().tasks[engine].length > 0
          ? get().tasks[engine]
          : getJSON<Task[]>(tasksKey(engine), []).filter((t) => t.is_active === 1);
        const ids = getJSON<number[]>(completionsKey(engine, dk), []);
        newCompletions[cKey] = ids;
        newScores[cKey] = computeScore(tasks, new Set(ids));
      }
    }

    if (Object.keys(newScores).length > 0) {
      set((s) => ({
        completions: { ...s.completions, ...newCompletions },
        scores: { ...s.scores, ...newScores },
      }));
    }
  },
}));

// ─── Pure selector helpers (use with useMemo in components) ─────────────

export function selectTotalScore(scores: Record<string, number>, dateKey: string): number {
  const vals = ENGINES.map((e) => scores[`${e}:${dateKey}`] ?? 0);
  if (vals.every((v) => v === 0)) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / 4);
}

export function selectAllTasksForDate(
  tasks: Record<EngineKey, Task[]>,
  completions: Record<string, number[]>,
  dateKey: string
): TaskWithStatus[] {
  const allTasks: TaskWithStatus[] = [];
  for (const engine of ENGINES) {
    const engineTasks = tasks[engine] ?? [];
    const ids = new Set(completions[`${engine}:${dateKey}`] ?? []);
    for (const t of engineTasks) {
      allTasks.push({ ...t, completed: ids.has(t.id!) });
    }
  }
  return allTasks.sort((a, b) => {
    if (a.engine !== b.engine) return a.engine.localeCompare(b.engine);
    if (a.kind !== b.kind) return a.kind === "main" ? -1 : 1;
    return a.created_at - b.created_at;
  });
}
