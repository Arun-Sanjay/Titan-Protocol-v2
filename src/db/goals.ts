import { getJSON, setJSON, nextId } from "./storage";
import type { Goal, GoalTask } from "./schema";

const GOALS_KEY = "goals";

function goalTasksKey(goalId: number): string {
  return `goal_tasks:${goalId}`;
}

export function listGoals(): Goal[] {
  return getJSON<Goal[]>(GOALS_KEY, []);
}

export function addGoal(goal: Omit<Goal, "id" | "created_at">): number {
  const id = nextId();
  const newGoal: Goal = { ...goal, id, created_at: Date.now() };
  const goals = listGoals();
  goals.push(newGoal);
  setJSON(GOALS_KEY, goals);
  return id;
}

export function deleteGoal(id: number): void {
  const goals = listGoals().filter((g) => g.id !== id);
  setJSON(GOALS_KEY, goals);
}

export function listGoalTasks(goalId: number): GoalTask[] {
  return getJSON<GoalTask[]>(goalTasksKey(goalId), []);
}

export function addGoalTask(goalId: number, title: string): number {
  const id = nextId();
  const task: GoalTask = {
    id,
    goal_id: goalId,
    title,
    task_type: "once",
    engine: null,
    completed: 0,
    created_at: Date.now(),
  };
  const tasks = listGoalTasks(goalId);
  tasks.push(task);
  setJSON(goalTasksKey(goalId), tasks);
  return id;
}

export function toggleGoalTask(taskId: number, goalId: number): void {
  const tasks = listGoalTasks(goalId);
  const task = tasks.find((t) => t.id === taskId);
  if (task) {
    task.completed = task.completed === 1 ? 0 : 1;
    setJSON(goalTasksKey(goalId), tasks);
  }
}
