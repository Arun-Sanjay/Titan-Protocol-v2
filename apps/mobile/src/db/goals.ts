import { db } from "./database";
import type { Goal, GoalTask } from "./schema";

export function listGoals(): Goal[] {
  return db.getAllSync<Goal>("SELECT * FROM goals ORDER BY created_at DESC");
}

export function addGoal(goal: Omit<Goal, "id" | "created_at">): number {
  const result = db.runSync(
    "INSERT INTO goals (title, engine, type, target, unit, deadline, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [goal.title, goal.engine, goal.type, goal.target, goal.unit, goal.deadline, Date.now()]
  );
  return result.lastInsertRowId;
}

export function deleteGoal(id: number): void {
  db.runSync("DELETE FROM goals WHERE id = ?", [id]);
  db.runSync("DELETE FROM goal_tasks WHERE goal_id = ?", [id]);
}

export function listGoalTasks(goalId: number): GoalTask[] {
  return db.getAllSync<GoalTask>(
    "SELECT * FROM goal_tasks WHERE goal_id = ? ORDER BY created_at ASC",
    [goalId]
  );
}

export function addGoalTask(goalId: number, title: string): number {
  const result = db.runSync(
    "INSERT INTO goal_tasks (goal_id, title, task_type, completed, created_at) VALUES (?, ?, 'once', 0, ?)",
    [goalId, title, Date.now()]
  );
  return result.lastInsertRowId;
}

export function toggleGoalTask(taskId: number): void {
  db.runSync(
    "UPDATE goal_tasks SET completed = CASE WHEN completed = 1 THEN 0 ELSE 1 END WHERE id = ?",
    [taskId]
  );
}
