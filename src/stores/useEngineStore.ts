import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";
import { K } from "../db/keys";
import { addDays } from "../lib/date";
import type { EngineKey, Task } from "../db/schema";

export const ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

// Phase 2.2D: key builders moved to src/db/keys.ts (K.tasks, K.completions).
// Local aliases for readability in this file only.
const tasksKey = (engine: EngineKey) => K.tasks(engine);
const completionsKey = (engine: EngineKey, dateKey: string) =>
  K.completions(engine, dateKey);

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
  tasks: { body: [], mind: [], money: [], charisma: [] },
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
    // Phase 2.1B: Single atomic store update instead of two.
    // Previously addTask did one set() and callers followed up with
    // loadEngine() to refresh the score, causing cascading re-renders
    // (part of the 15+ task crash pathology). Now we recompute scores for
    // all already-loaded dates in memory inside the same set() call.
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

    const newTasksForEngine = allTasks.filter((t) => t.is_active === 1);

    set((s) => {
      // Recompute scores for any loaded dates for this engine. Adding a task
      // changes the denominator, so stale scores would show incorrect %.
      const updatedScores = { ...s.scores };
      const enginePrefix = `${engine}:`;
      for (const cKey of Object.keys(s.completions)) {
        if (!cKey.startsWith(enginePrefix)) continue;
        const ids = new Set(s.completions[cKey] ?? []);
        updatedScores[cKey] = computeScore(newTasksForEngine, ids);
      }
      return {
        tasks: { ...s.tasks, [engine]: newTasksForEngine },
        scores: updatedScores,
      };
    });
  },

  deleteTask: (engine, taskId) => {
    // Phase 2.1B: Same single-set refactor as addTask.
    const allTasks = getJSON<Task[]>(tasksKey(engine), []).filter(
      (t) => t.id !== taskId
    );
    setJSON(tasksKey(engine), allTasks);

    const newTasksForEngine = allTasks.filter((t) => t.is_active === 1);

    set((s) => {
      // Recompute scores for any loaded dates for this engine. Also remove
      // the deleted task id from any cached completions so stale data isn't
      // held in memory (doesn't need MMKV writes — those keys will be
      // rewritten next time the user toggles a task).
      const updatedCompletions = { ...s.completions };
      const updatedScores = { ...s.scores };
      const enginePrefix = `${engine}:`;
      for (const cKey of Object.keys(s.completions)) {
        if (!cKey.startsWith(enginePrefix)) continue;
        const filteredIds = (s.completions[cKey] ?? []).filter((i) => i !== taskId);
        updatedCompletions[cKey] = filteredIds;
        updatedScores[cKey] = computeScore(newTasksForEngine, new Set(filteredIds));
      }
      return {
        tasks: { ...s.tasks, [engine]: newTasksForEngine },
        completions: updatedCompletions,
        scores: updatedScores,
      };
    });
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

    // Use addDays for DST-safe date iteration
    let dk = startDate;
    while (dk <= endDate) {
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
      dk = addDays(dk, 1);
    }

    if (Object.keys(newScores).length > 0) {
      // Phase 8.2: sliding window. Keep at most MAX_WINDOW_DAYS of
      // (engine, day) entries in the in-memory cache to prevent
      // unbounded growth on year-old power users. Cached entries
      // are evicted oldest-first by date suffix; the on-disk MMKV
      // values stay intact and can be re-loaded on demand.
      const MAX_WINDOW_DAYS = 90;
      const merged = {
        completions: { ...get().completions, ...newCompletions },
        scores: { ...get().scores, ...newScores },
      };
      const allKeys = Object.keys(merged.scores);
      if (allKeys.length > MAX_WINDOW_DAYS * ENGINES.length) {
        // Sort by date suffix descending; keep the newest window worth.
        const sorted = allKeys.sort((a, b) => {
          const da = a.split(":")[1] ?? "";
          const db = b.split(":")[1] ?? "";
          return db.localeCompare(da);
        });
        const keep = new Set(sorted.slice(0, MAX_WINDOW_DAYS * ENGINES.length));
        const trimmedCompletions: Record<string, number[]> = {};
        const trimmedScores: Record<string, number> = {};
        for (const k of keep) {
          if (merged.completions[k] !== undefined) {
            trimmedCompletions[k] = merged.completions[k];
          }
          if (merged.scores[k] !== undefined) {
            trimmedScores[k] = merged.scores[k];
          }
        }
        set({ completions: trimmedCompletions, scores: trimmedScores });
      } else {
        set(merged);
      }
    }
  },
}));

// ─── Pure selector helpers (use with useMemo in components) ─────────────

export function selectTotalScore(scores: Record<string, number>, dateKey: string): number {
  const vals = ENGINES.map((e) => scores[`${e}:${dateKey}`] ?? 0);
  const active = vals.filter((v) => v > 0);
  if (active.length === 0) return 0;
  return Math.round(active.reduce((a, b) => a + b, 0) / active.length);
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
