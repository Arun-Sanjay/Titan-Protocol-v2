import Dexie, { type Table, type UpdateSpec } from "dexie";
import { assertDateISO } from "./date";

// ─── Unified Engine Types ────────────────────────────────────────────────────

export type EngineKey = "body" | "mind" | "money" | "general";

export type EngineMeta = {
  id: EngineKey;
  startDate: string;
  createdAt: number;
};

/**
 * Unified task type for all four engines.
 * Replaces BodyTask, MindTask, MoneyTask, GeneralTask.
 */
export type Task = {
  id?: number;
  engine: EngineKey;
  title: string;
  kind: "main" | "secondary";
  createdAt: number;
  daysPerWeek?: number;
  isActive?: boolean; // default true
};

/**
 * One row per completed task per date.
 * Replaces BodyLog.completedTaskIds, MindTaskCompletion, MoneyLog, GeneralLog.
 * Presence = completed. Delete row = uncomplete.
 */
export type Completion = {
  id?: number;
  engine: EngineKey;
  taskId: number;
  dateKey: string;
};

// ─── Backward-compat aliases (used by components that still import old names) ─

export type BodyTask = Task;
export type BodyLog = { id?: number; dateKey: string; completedTaskIds: number[]; createdAt: number };
export type BodyMeta = EngineMeta;
export type MindTask = Task;
export type MindTaskCompletion = Completion;
export type MindMeta = EngineMeta;
export type MoneyTask = Task;
export type MoneyLog = BodyLog;
export type MoneyMeta = EngineMeta;
export type GeneralTask = Task;
export type GeneralLog = BodyLog;
export type GeneralMeta = EngineMeta;

// ─── Money ───────────────────────────────────────────────────────────────────

export type MoneyTx = {
  id: string;
  dateISO: string;
  type: "expense" | "income" | "borrowed" | "repayment";
  amount: number;
  category: string | null;
  bucket: "need" | "want" | null;
  note: string | null;
  loanId: string | null;
};

export type MoneyLoan = {
  id: string;
  lender: string | null;
  amount: number;
  dateISO: string;
  dueISO: string | null;
  status: "unpaid" | "paid";
};

// ─── Nutrition ───────────────────────────────────────────────────────────────

export type NutritionProfile = {
  id: string;
  created_at: string;
  updated_at: string;
  height_cm: number;
  weight_kg: number;
  age: number;
  sex: "male" | "female";
  bodyfat_pct: number | null;
  steps_per_day: number;
  workouts_per_week: number;
  activity_multiplier: number;
  goal: "cut" | "bulk" | "maintain";
  rate_kg_per_week: 0 | 0.25 | 0.5 | 0.75 | 1;
  calorie_target: number;
  protein_g: number;
  carbs_g: number | null;
  fat_g: number | null;
};

export type NutritionMeal = {
  id: string;
  dateISO: string;
  created_at: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number | null;
  fat_g: number | null;
};

// ─── Focus Timer ─────────────────────────────────────────────────────────────

export type FocusSettings = {
  id: "default";
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  longBreakAfter: number;
  dailyTarget: number;
};

export type FocusDaily = {
  dateKey: string;
  completedSessions: number;
};

// ─── Deep Work ───────────────────────────────────────────────────────────────

export type DeepWorkTask = {
  id?: number;
  taskName: string;
  category: "Main Job / College" | "Side Hustle" | "Freelance" | "Investments" | "Other";
  createdAt: number;
};

export type DeepWorkLog = {
  id?: number;
  taskId: number;
  dateKey: string;
  completed: boolean;
  earningsToday: number;
};

// ─── Gym / Workout ───────────────────────────────────────────────────────────

export type GymExercise = {
  id?: number;
  name: string;
  muscleGroup: string;
  equipment: string;
  createdAt: number;
};

export type GymTemplate = {
  id?: number;
  name: string;
  createdAt: number;
};

export type GymTemplateExercise = {
  id?: number;
  templateId: number;
  exerciseId: number;
  order: number;
};

export type GymSession = {
  id?: number;
  dateKey: string;
  templateId: number;
  startedAt: number;
  endedAt: number | null;
};

export type GymSet = {
  id?: number;
  sessionId: number;
  exerciseId: number;
  setIndex: number;
  weight: number;
  reps: number;
};

// ─── Body Weight ─────────────────────────────────────────────────────────────

export type BodyWeightEntry = {
  dateKey: string;
  weightKg: number;
  createdAt: number;
};

// ─── Habits ──────────────────────────────────────────────────────────────────

export type Habit = {
  id?: number;
  title: string;
  engine: "body" | "mind" | "money" | "general" | "all";
  icon: string;
  createdAt: number;
};

export type HabitLog = {
  id?: number;
  habitId: number;
  dateKey: string;
  completed: boolean;
};

// ─── Journal ─────────────────────────────────────────────────────────────────

export type JournalEntry = {
  dateKey: string;
  content: string;
  updatedAt: number;
};

// ─── Goals ───────────────────────────────────────────────────────────────────

export type Goal = {
  id?: number;
  title: string;
  engine: "body" | "mind" | "money" | "general" | "all" | "habits";
  type: "consistency" | "count" | "value";
  target: number;
  unit: string;
  deadline: string;
  createdAt: number;
  threshold?: number;
};

export type GoalTask = {
  id?: number;
  goalId: number;
  title: string;
  taskType?: "daily" | "once";
  engine?: "body" | "mind" | "money" | "general" | null;
  engineTaskRefId?: string | null;
  completed: boolean;
  createdAt: number;
};

// ─── Sleep ───────────────────────────────────────────────────────────────────

export type SleepEntry = {
  dateKey: string;
  bedtime: string;
  wakeTime: string;
  durationMinutes: number;
  quality: 1 | 2 | 3 | 4 | 5;
  notes: string;
  createdAt: number;
};

// ─── Budgets ─────────────────────────────────────────────────────────────────

export type Budget = {
  id?: number;
  category: string;
  monthlyLimit: number;
  createdAt: number;
};

// ─── Achievements ────────────────────────────────────────────────────────────

export type Achievement = {
  id?: number;
  type: string;
  unlockedAt: number;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATABASE CLASS — 25 tables, 1 version, clean slate
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TitanDB extends Dexie {
  // Unified engine system (was 12 tables, now 3)
  engine_meta!: Table<EngineMeta, EngineKey>;
  tasks!: Table<Task, number>;
  completions!: Table<Completion, number>;

  // Money
  money_tx!: Table<MoneyTx, string>;
  money_loans!: Table<MoneyLoan, string>;
  budgets!: Table<Budget, number>;

  // Nutrition
  nutrition_profiles!: Table<NutritionProfile, string>;
  nutrition_meals!: Table<NutritionMeal, string>;

  // Focus (was 4 duplicate tables, now 2)
  focus_settings!: Table<FocusSettings, "default">;
  focus_daily!: Table<FocusDaily, string>;

  // Deep Work
  deep_work_tasks!: Table<DeepWorkTask, number>;
  deep_work_logs!: Table<DeepWorkLog, number>;

  // Gym
  gym_exercises!: Table<GymExercise, number>;
  gym_templates!: Table<GymTemplate, number>;
  gym_template_exercises!: Table<GymTemplateExercise, number>;
  gym_sessions!: Table<GymSession, number>;
  gym_sets!: Table<GymSet, number>;

  // Body metrics
  body_weight_entries!: Table<BodyWeightEntry, string>;
  sleep_entries!: Table<SleepEntry, string>;

  // Habits
  habits!: Table<Habit, number>;
  habit_logs!: Table<HabitLog, number>;

  // Other
  journal_entries!: Table<JournalEntry, string>;
  goals!: Table<Goal, number>;
  goal_tasks!: Table<GoalTask, number>;
  achievements!: Table<Achievement, number>;

  constructor() {
    super("TitanProtocolV2");
    this.version(1).stores({
      // Unified engine
      engine_meta: "id",
      tasks: "++id, engine, kind, createdAt, [engine+kind]",
      completions: "++id, engine, taskId, dateKey, [engine+dateKey], [taskId+dateKey]",

      // Money
      money_tx: "id, dateISO, type, category, bucket, loanId",
      money_loans: "id, dateISO, status",
      budgets: "++id, category",

      // Nutrition
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",

      // Focus
      focus_settings: "id",
      focus_daily: "dateKey",

      // Deep Work
      deep_work_tasks: "++id, category, createdAt",
      deep_work_logs: "++id, taskId, dateKey, completed",

      // Gym
      gym_exercises: "++id, name, muscleGroup, equipment",
      gym_templates: "++id, name",
      gym_template_exercises: "++id, templateId, exerciseId, order",
      gym_sessions: "++id, dateKey, templateId",
      gym_sets: "++id, sessionId, exerciseId",

      // Body metrics
      body_weight_entries: "dateKey",
      sleep_entries: "dateKey",

      // Habits
      habits: "++id, title, engine, createdAt",
      habit_logs: "++id, habitId, dateKey, [habitId+dateKey]",

      // Other
      journal_entries: "dateKey",
      goals: "++id, engine, type, createdAt",
      goal_tasks: "++id, goalId, taskType, completed",
      achievements: "++id, type, unlockedAt",
    });
  }
}

export const db = new TitanDB();

// Eagerly open the database so IndexedDB is ready before the first query.
db.open().catch((err) => {
  console.error("[TitanDB] Failed to open database:", err);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENGINE HELPERS FACTORY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type EngineHelpers = {
  listTasks: () => Promise<Task[]>;
  addTask: (title: string, kind: "main" | "secondary", daysPerWeek?: number) => Promise<number>;
  updateTaskKind: (taskId: number, kind: "main" | "secondary") => Promise<void>;
  renameTask: (taskId: number, title: string) => Promise<void>;
  deleteTask: (taskId: number) => Promise<void>;
  deactivateTask: (taskId: number) => Promise<void>;
  getCompletedIds: (dateKey: string) => Promise<Set<number>>;
  toggleTaskForDate: (dateKey: string, taskId: number) => Promise<Set<number>>;
  getScoreMapForRange: (startKey: string, endKey: string) => Promise<Record<string, number>>;
};

export function createEngineHelpers(
  engine: EngineKey,
  computePercent: (tasks: Task[], completedIds: Set<number>) => number,
  onDateTouched?: (dateKey: string) => Promise<void>,
): EngineHelpers {
  async function listTasks(): Promise<Task[]> {
    return db.tasks.where({ engine }).filter((t) => t.isActive !== false).toArray();
  }

  async function addTask(title: string, kind: "main" | "secondary", daysPerWeek = 7): Promise<number> {
    return db.tasks.add({ engine, title, kind, createdAt: Date.now(), daysPerWeek, isActive: true });
  }

  async function updateTaskKind(taskId: number, kind: "main" | "secondary"): Promise<void> {
    await db.tasks.update(taskId, { kind } as unknown as UpdateSpec<Task>);
  }

  async function renameTask(taskId: number, title: string): Promise<void> {
    await db.tasks.update(taskId, { title } as unknown as UpdateSpec<Task>);
  }

  async function deleteTask(taskId: number): Promise<void> {
    await db.transaction("rw", db.tasks, db.completions, async () => {
      await db.tasks.delete(taskId);
      await db.completions.where({ taskId }).delete();
    });
  }

  async function deactivateTask(taskId: number): Promise<void> {
    await db.tasks.update(taskId, { isActive: false } as unknown as UpdateSpec<Task>);
  }

  async function getCompletedIds(dateKey: string): Promise<Set<number>> {
    const safeDate = assertDateISO(dateKey);
    const rows = await db.completions.where("[engine+dateKey]").equals([engine, safeDate]).toArray();
    return new Set(rows.map((r) => r.taskId));
  }

  async function toggleTaskForDate(dateKey: string, taskId: number): Promise<Set<number>> {
    const safeDate = assertDateISO(dateKey);
    const existing = await db.completions
      .where("[taskId+dateKey]")
      .equals([taskId, safeDate])
      .first();

    if (existing) {
      await db.completions.delete(existing.id!);
    } else {
      await db.completions.add({ engine, taskId, dateKey: safeDate });
    }

    if (onDateTouched) {
      await onDateTouched(safeDate);
    }

    return getCompletedIds(safeDate);
  }

  async function getScoreMapForRange(startKey: string, endKey: string): Promise<Record<string, number>> {
    const safeStart = assertDateISO(startKey);
    const safeEnd = assertDateISO(endKey);
    const [tasks, completions] = await Promise.all([
      listTasks(),
      db.completions.where("[engine+dateKey]").between([engine, safeStart], [engine, safeEnd], true, true).toArray(),
    ]);

    // Group completions by date
    const byDate = new Map<string, Set<number>>();
    for (const c of completions) {
      const set = byDate.get(c.dateKey) ?? new Set<number>();
      set.add(c.taskId);
      byDate.set(c.dateKey, set);
    }

    const scoreMap: Record<string, number> = {};
    for (const [dateKey, ids] of byDate) {
      scoreMap[dateKey] = computePercent(tasks, ids);
    }
    return scoreMap;
  }

  return {
    listTasks,
    addTask,
    updateTaskKind,
    renameTask,
    deleteTask,
    deactivateTask,
    getCompletedIds,
    toggleTaskForDate,
    getScoreMapForRange,
  };
}

// ─── Shared engine meta helpers ──────────────────────────────────────────────

export async function ensureEngineMeta(engine: EngineKey, todayKey: string): Promise<EngineMeta> {
  const safeDate = assertDateISO(todayKey);
  const existing = await db.engine_meta.get(engine);
  if (existing) return existing;
  const meta: EngineMeta = { id: engine, startDate: safeDate, createdAt: Date.now() };
  await db.engine_meta.put(meta);
  return meta;
}

export async function getEngineStartDate(engine: EngineKey): Promise<string | null> {
  const meta = await db.engine_meta.get(engine);
  return meta?.startDate ?? null;
}

export async function touchEngineDate(engine: EngineKey, dateKey: string): Promise<void> {
  const safeDate = assertDateISO(dateKey);
  const meta = await ensureEngineMeta(engine, safeDate);
  if (safeDate < meta.startDate) {
    await db.engine_meta.update(engine, { startDate: safeDate });
  }
}

// ─── Legacy compat: createEngineTaskLogHelpers adapter ───────────────────────
// Some code still uses the old factory signature. This bridges the gap.

type LegacyLogLike = { id?: number; dateKey: string; completedTaskIds: number[]; createdAt: number };

export type EngineTaskLogHelpers<TTask, TLog> = {
  listTasks: () => Promise<TTask[]>;
  addTask: (title: string, priority: "main" | "secondary", daysPerWeek?: number) => Promise<number>;
  updateTaskPriority: (taskId: number, priority: "main" | "secondary") => Promise<void>;
  renameTask: (taskId: number, title: string) => Promise<void>;
  deleteTask: (taskId: number) => Promise<void>;
  getLog: (dateKey: string) => Promise<TLog | undefined>;
  getOrCreateLog: (dateKey: string) => Promise<TLog>;
  toggleTaskForDate: (dateKey: string, taskId: number) => Promise<TLog>;
  getScoreMapForRange: (startKey: string, endKey: string) => Promise<Record<string, number>>;
};

export function createEngineTaskLogHelpers<TTask extends { id?: number; title: string; priority?: string; kind?: string }, TLog extends LegacyLogLike>(config: {
  engine: EngineKey;
  computePercentFromLog: (tasks: TTask[], completedTaskIds: number[]) => number;
  onDateTouched?: (dateKey: string) => Promise<void>;
}): EngineTaskLogHelpers<TTask, TLog> {
  const { engine, computePercentFromLog, onDateTouched } = config;

  async function listTasks(): Promise<TTask[]> {
    const rows = await db.tasks.where({ engine }).filter((t) => t.isActive !== false).toArray();
    return rows.map((t) => ({ ...t, priority: t.kind }) as unknown as TTask);
  }

  async function addTask(title: string, priority: "main" | "secondary", daysPerWeek = 7): Promise<number> {
    return db.tasks.add({ engine, title, kind: priority, createdAt: Date.now(), daysPerWeek, isActive: true });
  }

  async function updateTaskPriority(taskId: number, priority: "main" | "secondary"): Promise<void> {
    await db.tasks.update(taskId, { kind: priority } as unknown as UpdateSpec<Task>);
  }

  async function renameTask(taskId: number, title: string): Promise<void> {
    await db.tasks.update(taskId, { title } as unknown as UpdateSpec<Task>);
  }

  async function deleteTask(taskId: number): Promise<void> {
    await db.transaction("rw", db.tasks, db.completions, async () => {
      await db.tasks.delete(taskId);
      await db.completions.where({ taskId }).delete();
    });
  }

  async function buildLog(dateKey: string): Promise<TLog> {
    const safeDate = assertDateISO(dateKey);
    const rows = await db.completions.where("[engine+dateKey]").equals([engine, safeDate]).toArray();
    const completedTaskIds = rows.map((r) => r.taskId);
    return { dateKey: safeDate, completedTaskIds, createdAt: Date.now() } as unknown as TLog;
  }

  async function getLog(dateKey: string): Promise<TLog | undefined> {
    return buildLog(dateKey);
  }

  async function getOrCreateLog(dateKey: string): Promise<TLog> {
    return buildLog(dateKey);
  }

  async function toggleTaskForDate(dateKey: string, taskId: number): Promise<TLog> {
    const safeDate = assertDateISO(dateKey);
    const existing = await db.completions
      .where("[taskId+dateKey]")
      .equals([taskId, safeDate])
      .first();

    if (existing) {
      await db.completions.delete(existing.id!);
    } else {
      await db.completions.add({ engine, taskId, dateKey: safeDate });
    }

    if (onDateTouched) {
      await onDateTouched(safeDate);
    }

    return buildLog(safeDate);
  }

  async function getScoreMapForRange(startKey: string, endKey: string): Promise<Record<string, number>> {
    const safeStart = assertDateISO(startKey);
    const safeEnd = assertDateISO(endKey);
    const [tasks, completions] = await Promise.all([
      listTasks(),
      db.completions.where("[engine+dateKey]").between([engine, safeStart], [engine, safeEnd], true, true).toArray(),
    ]);

    const byDate = new Map<string, number[]>();
    for (const c of completions) {
      const arr = byDate.get(c.dateKey) ?? [];
      arr.push(c.taskId);
      byDate.set(c.dateKey, arr);
    }

    const scoreMap: Record<string, number> = {};
    for (const [dateKey, ids] of byDate) {
      scoreMap[dateKey] = computePercentFromLog(tasks, ids);
    }
    return scoreMap;
  }

  return {
    listTasks,
    addTask,
    updateTaskPriority,
    renameTask,
    deleteTask,
    getLog,
    getOrCreateLog,
    toggleTaskForDate,
    getScoreMapForRange,
  };
}
