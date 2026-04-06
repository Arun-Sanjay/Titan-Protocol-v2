import { db, type Goal, type GoalTask } from "./db";
import { todayISO } from "./date";
import { getDayScoreForEngine, type EngineKey } from "./scoring";
import { addBodyTask, deleteBodyTask, toggleBodyTaskForDate } from "./body";
import { addMoneyTask, deleteMoneyTask, toggleMoneyTaskForDate } from "./money";
import { addGeneralTask, deleteGeneralTask, toggleGeneralTaskForDate } from "./general";
import { addMindTask, deleteMindTask, setMindTaskCompletion } from "./mind";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listGoals(): Promise<Goal[]> {
  return db.goals.orderBy("createdAt").reverse().toArray();
}

export async function addGoal(
  goal: Omit<Goal, "id" | "createdAt">,
): Promise<number> {
  return db.goals.add({ ...goal, createdAt: Date.now() } as Goal);
}

export async function deleteGoal(id: number): Promise<void> {
  await db.goals.delete(id);
  await db.goal_tasks.where("goalId").equals(id).delete();
}

// ---------------------------------------------------------------------------
// Goal Task CRUD
// ---------------------------------------------------------------------------

export async function listGoalTasksForGoal(goalId: number): Promise<GoalTask[]> {
  return db.goal_tasks.where("goalId").equals(goalId).sortBy("createdAt");
}

export async function addGoalTask(
  goalId: number,
  title: string,
  taskType: "daily" | "once",
  engine?: "body" | "mind" | "money" | "general" | null,
): Promise<number> {
  let engineTaskRefId: string | null = null;

  if (taskType === "daily" && engine) {
    try {
      switch (engine) {
        case "body": {
          const id = await addBodyTask(title.trim(), "main", 7);
          engineTaskRefId = String(id);
          break;
        }
        case "money": {
          const id = await addMoneyTask(title.trim(), "main", 7);
          engineTaskRefId = String(id);
          break;
        }
        case "general": {
          const id = await addGeneralTask(title.trim(), "main", 7);
          engineTaskRefId = String(id);
          break;
        }
        case "mind": {
          const task = await addMindTask({ title: title.trim(), kind: "main" });
          engineTaskRefId = String(task.id);
          break;
        }
      }
    } catch (err) {
      console.error("[goals.ts:addGoalTask] Failed to create engine task:", err);
    }
  }

  return db.goal_tasks.add({
    goalId,
    title: title.trim(),
    taskType,
    engine: engine ?? null,
    engineTaskRefId,
    completed: false,
    createdAt: Date.now(),
  });
}

/** Toggle a "once" task's permanent completion. */
export async function toggleGoalTask(id: number): Promise<void> {
  const task = await db.goal_tasks.get(id);
  if (!task) return;
  await db.goal_tasks.update(id, { completed: !task.completed });
}

/**
 * Toggle a "daily" task's engine completion for today.
 */
export async function toggleDailyGoalTask(task: GoalTask, isDoneToday: boolean): Promise<void> {
  if (!task.engineTaskRefId || !task.engine) return;
  const today = todayISO();
  try {
    switch (task.engine) {
      case "body":
        await toggleBodyTaskForDate(today, Number(task.engineTaskRefId));
        break;
      case "money":
        await toggleMoneyTaskForDate(today, Number(task.engineTaskRefId));
        break;
      case "general":
        await toggleGeneralTaskForDate(today, Number(task.engineTaskRefId));
        break;
      case "mind":
        await setMindTaskCompletion(today, Number(task.engineTaskRefId), !isDoneToday);
        break;
    }
  } catch (err) {
    console.error("[goals.ts:toggleDailyGoalTask]", err);
  }
}

export async function deleteGoalTask(id: number): Promise<void> {
  const task = await db.goal_tasks.get(id);
  if (task?.taskType === "daily" && task.engineTaskRefId && task.engine) {
    try {
      switch (task.engine) {
        case "body":
          await deleteBodyTask(Number(task.engineTaskRefId));
          break;
        case "money":
          await deleteMoneyTask(Number(task.engineTaskRefId));
          break;
        case "general":
          await deleteGeneralTask(Number(task.engineTaskRefId));
          break;
        case "mind":
          await deleteMindTask(Number(task.engineTaskRefId));
          break;
      }
    } catch (err) {
      console.error("[goals.ts:deleteGoalTask] Failed to delete engine task:", err);
    }
  }
  await db.goal_tasks.delete(id);
}

// ---------------------------------------------------------------------------
// Progress computation
// ---------------------------------------------------------------------------

export type GoalProgress = {
  current: number;
  target: number;
  percent: number;
};

function tsToDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateRange(start: string, end: string): string[] {
  const keys: string[] = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);
  while (cur <= last) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    keys.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

async function computeConsistency(goal: Goal): Promise<GoalProgress> {
  const startKey = tsToDateKey(goal.createdAt);
  const today = todayISO();
  const endKey = goal.deadline < today ? goal.deadline : today;

  if (startKey > endKey) {
    return { current: 0, target: goal.target, percent: 0 };
  }

  const days = dateRange(startKey, endKey);
  const threshold = goal.threshold ?? 50;

  if (goal.engine === "habits") {
    const logs = await db.habit_logs
      .where("dateKey")
      .between(startKey, endKey, true, true)
      .toArray();

    const habits = await db.habits.toArray();
    if (habits.length === 0) {
      return { current: 0, target: goal.target, percent: 0 };
    }

    let qualifyingDays = 0;
    for (const dk of days) {
      const dayLogs = logs.filter((l) => l.dateKey === dk && l.completed);
      const pct = (dayLogs.length / habits.length) * 100;
      if (pct >= threshold) qualifyingDays++;
    }
    const current = Math.round((qualifyingDays / days.length) * 100);
    const percent = Math.min(100, Math.round((current / goal.target) * 100));
    return { current, target: goal.target, percent };
  }

  if (goal.engine === "all") {
    const engines: EngineKey[] = ["body", "mind", "money", "general"];
    let qualifyingDays = 0;
    for (const dk of days) {
      const scores = await Promise.all(engines.map((e) => getDayScoreForEngine(e, dk)));
      const activeScores = scores.filter((s) => s.pointsTotal > 0);
      const dayAvg =
        activeScores.length > 0
          ? activeScores.reduce((sum, s) => sum + s.percent, 0) / activeScores.length
          : 0;
      if (dayAvg >= threshold) qualifyingDays++;
    }
    const current = Math.round((qualifyingDays / days.length) * 100);
    const percent = Math.min(100, Math.round((current / goal.target) * 100));
    return { current, target: goal.target, percent };
  }

  const engine = goal.engine as EngineKey;
  let qualifyingDays = 0;
  for (const dk of days) {
    const score = await getDayScoreForEngine(engine, dk);
    if (score.percent >= threshold) qualifyingDays++;
  }
  const current = Math.round((qualifyingDays / days.length) * 100);
  const percent = Math.min(100, Math.round((current / goal.target) * 100));
  return { current, target: goal.target, percent };
}

async function computeCount(goal: Goal): Promise<GoalProgress> {
  const startKey = tsToDateKey(goal.createdAt);
  const today = todayISO();
  const endKey = goal.deadline < today ? goal.deadline : today;

  let current = 0;

  switch (goal.engine) {
    case "habits": {
      const logs = await db.habit_logs
        .where("dateKey")
        .between(startKey, endKey, true, true)
        .toArray();
      current = logs.filter((l) => l.completed).length;
      break;
    }
    case "mind": {
      const dailyRows = await db.focus_daily.toArray();
      current = dailyRows
        .filter((r) => r.dateKey >= startKey && r.dateKey <= endKey)
        .reduce((sum, r) => sum + r.completedSessions, 0);
      break;
    }
    case "body": {
      const sessions = await db.gym_sessions.toArray();
      current = sessions.filter((s) => s.dateKey >= startKey && s.dateKey <= endKey).length;
      break;
    }
    case "money": {
      const txs = await db.money_tx.toArray();
      current = txs.filter(
        (t) =>
          (t.type === "income" || t.type === "expense") &&
          t.dateISO >= startKey &&
          t.dateISO <= endKey,
      ).length;
      break;
    }
    case "general": {
      // Count days with at least one completion for general engine
      const completions = await db.completions
        .where("[engine+dateKey]")
        .between(["general", startKey], ["general", endKey], true, true)
        .toArray();
      const uniqueDates = new Set(completions.map((c) => c.dateKey));
      current = uniqueDates.size;
      break;
    }
    case "all": {
      const dailyRows = await db.focus_daily.toArray();
      current = dailyRows
        .filter((r) => r.dateKey >= startKey && r.dateKey <= endKey)
        .reduce((sum, r) => sum + r.completedSessions, 0);
      break;
    }
  }

  const percent = goal.target > 0 ? Math.min(100, Math.round((current / goal.target) * 100)) : 0;
  return { current, target: goal.target, percent };
}

export const VALUE_UNSUPPORTED_ENGINES = new Set(["mind", "general", "all", "habits"]);

async function computeValue(goal: Goal): Promise<GoalProgress> {
  let current = 0;

  switch (goal.engine) {
    case "body": {
      const entry = await db.body_weight_entries.orderBy("dateKey").reverse().first();
      current = entry?.weightKg ?? 0;
      break;
    }
    case "money": {
      const txs = await db.money_tx.toArray();
      const startKey = tsToDateKey(goal.createdAt);
      current = txs
        .filter((t) => t.type === "income" && t.dateISO >= startKey)
        .reduce((sum, t) => sum + t.amount, 0);
      break;
    }
    default: {
      return { current: 0, target: goal.target, percent: 0 };
    }
  }

  const percent = goal.target > 0 ? Math.min(100, Math.round((current / goal.target) * 100)) : 0;
  return { current, target: goal.target, percent };
}

export async function computeGoalProgress(goal: Goal): Promise<GoalProgress> {
  if (goal.id !== undefined) {
    const tasks = await db.goal_tasks.where("goalId").equals(goal.id).toArray();
    if (tasks.length > 0) {
      const onceTasks = tasks.filter((t) => (t.taskType ?? "once") === "once");
      if (onceTasks.length > 0) {
        const completed = onceTasks.filter((t) => t.completed).length;
        const percent = Math.round((completed / onceTasks.length) * 100);
        return { current: completed, target: onceTasks.length, percent };
      }
      return { current: 0, target: tasks.length, percent: 0 };
    }
  }

  switch (goal.type) {
    case "consistency":
      return computeConsistency(goal);
    case "count":
      return computeCount(goal);
    case "value":
      return computeValue(goal);
    default:
      return { current: 0, target: goal.target, percent: 0 };
  }
}
