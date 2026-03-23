import { getDB } from "./database";
import type { Goal, GoalTask } from "./schema";

export async function listGoals(): Promise<Goal[]> {
  const db = await getDB();
  return db.getAllAsync<Goal>("SELECT * FROM goals ORDER BY created_at DESC");
}

export async function addGoal(goal: Omit<Goal, "id" | "created_at">): Promise<number> {
  const db = await getDB();
  const result = await db.runAsync(
    "INSERT INTO goals (title, engine, type, target, unit, deadline, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [goal.title, goal.engine, goal.type, goal.target, goal.unit, goal.deadline, Date.now()]
  );
  return result.lastInsertRowId;
}

export async function deleteGoal(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM goals WHERE id = ?", [id]);
  await db.runAsync("DELETE FROM goal_tasks WHERE goal_id = ?", [id]);
}

export async function listGoalTasks(goalId: number): Promise<GoalTask[]> {
  const db = await getDB();
  return db.getAllAsync<GoalTask>(
    "SELECT * FROM goal_tasks WHERE goal_id = ? ORDER BY created_at ASC",
    [goalId]
  );
}

export async function addGoalTask(goalId: number, title: string): Promise<number> {
  const db = await getDB();
  const result = await db.runAsync(
    "INSERT INTO goal_tasks (goal_id, title, task_type, completed, created_at) VALUES (?, ?, 'once', 0, ?)",
    [goalId, title, Date.now()]
  );
  return result.lastInsertRowId;
}

export async function toggleGoalTask(taskId: number): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    "UPDATE goal_tasks SET completed = CASE WHEN completed = 1 THEN 0 ELSE 1 END WHERE id = ?",
    [taskId]
  );
}
