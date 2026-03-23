/**
 * Unified engine adapter that provides a single interface for all engines.
 * Now all engines use the same db.tasks + db.completions tables.
 */

import { db, type EngineKey } from "./db";
import { assertDateISO, todayISO } from "./date";
import type { DayScore } from "./scoring";
import { getDayScoreForEngine } from "./scoring";

export type UnifiedTaskId = string;

export type UnifiedEngineTask = {
  id: UnifiedTaskId;
  title: string;
  priority: "main" | "secondary";
  createdAt: number;
  daysPerWeek: number;
  engine: EngineKey;
};

export type UnifiedTaskCompletion = {
  taskId: UnifiedTaskId;
  completed: boolean;
};

export interface EngineAdapter {
  engine: EngineKey;
  listTasks(): Promise<UnifiedEngineTask[]>;
  getCompletions(dateKey: string): Promise<Map<UnifiedTaskId, boolean>>;
  getScore(dateKey: string): Promise<DayScore>;
  getStartDate(): Promise<string | null>;
}

function createAdapter(engine: EngineKey): EngineAdapter {
  return {
    engine,

    async listTasks() {
      const tasks = await db.tasks.where({ engine }).filter((t) => t.isActive !== false).toArray();
      return tasks.map((t) => ({
        id: String(t.id ?? -1),
        title: t.title,
        priority: t.kind,
        createdAt: t.createdAt,
        daysPerWeek: t.daysPerWeek ?? 7,
        engine,
      }));
    },

    async getCompletions(dateKey: string) {
      const safeDate = assertDateISO(dateKey);
      const completions = await db.completions
        .where("[engine+dateKey]")
        .equals([engine, safeDate])
        .toArray();
      const map = new Map<UnifiedTaskId, boolean>();
      for (const c of completions) {
        map.set(String(c.taskId), true);
      }
      return map;
    },

    async getScore(dateKey: string) {
      return getDayScoreForEngine(engine, dateKey);
    },

    async getStartDate() {
      const meta = await db.engine_meta.get(engine);
      return meta?.startDate ?? null;
    },
  };
}

const adapters: Record<EngineKey, EngineAdapter> = {
  body: createAdapter("body"),
  mind: createAdapter("mind"),
  money: createAdapter("money"),
  general: createAdapter("general"),
};

export function getEngineAdapter(engine: EngineKey): EngineAdapter {
  return adapters[engine];
}

/**
 * Get tasks and completions for all engines on a given date, unified.
 */
export async function getAllEngineTasksForDate(
  dateKey?: string,
): Promise<{ tasks: UnifiedEngineTask[]; completions: Map<UnifiedTaskId, boolean> }> {
  const safeDate = assertDateISO(dateKey ?? todayISO());
  const engines: EngineKey[] = ["body", "mind", "money", "general"];

  const results = await Promise.all(
    engines.map(async (engine) => {
      const adapter = getEngineAdapter(engine);
      const [tasks, completions] = await Promise.all([
        adapter.listTasks(),
        adapter.getCompletions(safeDate),
      ]);
      return { tasks, completions };
    }),
  );

  const allTasks: UnifiedEngineTask[] = [];
  const allCompletions = new Map<UnifiedTaskId, boolean>();

  for (const { tasks, completions } of results) {
    allTasks.push(...tasks);
    for (const [id, completed] of completions) {
      allCompletions.set(id, completed);
    }
  }

  return { tasks: allTasks, completions: allCompletions };
}
