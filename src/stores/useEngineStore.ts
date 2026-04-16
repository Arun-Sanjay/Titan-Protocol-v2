import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";
import type { EngineKey, Task, Completion } from "../db/schema";

// ─── Constants ──────────────────────────────────────────────────────────────

export const ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

// ─── Derived types ──────────────────────────────────────────────────────────

export type TaskWithStatus = Task & { completed: boolean };

// ─── Selectors (pure functions, importable without hook) ────────────────────

/** Get all tasks across all engines for a given date, with completion status. */
export function selectAllTasksForDate(
  tasks: Record<string, Task[]>,
  completions: Record<string, number[]>,
  dateKey: string,
): TaskWithStatus[] {
  const result: TaskWithStatus[] = [];
  for (const engine of ENGINES) {
    const engineTasks = tasks[engine] ?? [];
    const doneIds = completions[`${engine}:${dateKey}`] ?? [];
    for (const t of engineTasks) {
      result.push({ ...t, completed: doneIds.includes(t.id!) });
    }
  }
  return result;
}

/** Compute average score across all engines for a date. */
export function selectTotalScore(
  scores: Record<string, number>,
  dateKey: string,
): number {
  let total = 0;
  let count = 0;
  for (const e of ENGINES) {
    const s = scores[`${e}:${dateKey}`];
    if (s !== undefined) {
      total += s;
      count++;
    }
  }
  return count > 0 ? Math.round(total / count) : 0;
}

// ─── Store ──────────────────────────────────────────────────────────────────

type EngineState = {
  tasks: Record<string, Task[]>;
  completions: Record<string, number[]>;
  scores: Record<string, number>;

  loadEngine: (engine: EngineKey, dateKey: string) => void;
  loadAllEngines: (dateKey: string) => void;
  loadDateRange: (startKey: string, endKey: string) => void;
  addTask: (engine: EngineKey, title: string, kind: "main" | "secondary") => void;
  toggleTask: (engine: EngineKey, taskId: number, dateKey: string) => void;
};

export const useEngineStore = create<EngineState>((set, get) => ({
  tasks: (() => {
    const init: Record<string, Task[]> = {};
    for (const e of ENGINES) {
      init[e] = getJSON<Task[]>(`engine_tasks_${e}`, []);
    }
    return init;
  })(),
  completions: getJSON<Record<string, number[]>>("engine_completions", {}),
  scores: getJSON<Record<string, number>>("engine_scores", {}),

  loadEngine: (engine, dateKey) => {
    const tasks = getJSON<Task[]>(`engine_tasks_${engine}`, []);
    const completions = getJSON<Record<string, number[]>>("engine_completions", {});
    const scoreVal = getJSON<number>(`engine_score_${engine}:${dateKey}`, 0);
    set((s) => ({
      tasks: { ...s.tasks, [engine]: tasks },
      completions: { ...s.completions, ...completions },
      scores: { ...s.scores, [`${engine}:${dateKey}`]: scoreVal },
    }));
  },

  loadAllEngines: (dateKey) => {
    const { loadEngine } = get();
    for (const e of ENGINES) loadEngine(e, dateKey);
  },

  loadDateRange: (startKey, endKey) => {
    // Load scores for a date range into memory
    const start = new Date(startKey);
    const end = new Date(endKey);
    const newScores: Record<string, number> = {};
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      for (const e of ENGINES) {
        const key = `${e}:${dk}`;
        newScores[key] = getJSON<number>(`engine_score_${key}`, 0);
      }
    }
    set((s) => ({ scores: { ...s.scores, ...newScores } }));
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
    set((s) => {
      const list = [...(s.tasks[engine] ?? []), task];
      setJSON(`engine_tasks_${engine}`, list);
      return { tasks: { ...s.tasks, [engine]: list } };
    });
  },

  toggleTask: (engine, taskId, dateKey) => {
    const key = `${engine}:${dateKey}`;
    set((s) => {
      const prev = s.completions[key] ?? [];
      const exists = prev.includes(taskId);
      const next = exists ? prev.filter((id) => id !== taskId) : [...prev, taskId];
      const completions = { ...s.completions, [key]: next };
      setJSON("engine_completions", completions);

      // Recompute score for this engine+date
      const engineTasks = s.tasks[engine] ?? [];
      const activeCount = engineTasks.filter((t) => t.is_active).length;
      const doneCount = next.length;
      const score = activeCount > 0 ? Math.round((doneCount / activeCount) * 100) : 0;
      const scores = { ...s.scores, [`${engine}:${dateKey}`]: score };
      setJSON(`engine_score_${engine}:${dateKey}`, score);

      return { completions, scores };
    });
  },
}));
