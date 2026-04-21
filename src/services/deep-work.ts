import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteDelete,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type DeepWorkSession = Tables<"deep_work_sessions">;
export type DeepWorkTask = Tables<"deep_work_tasks">;
export type DeepWorkLog = Tables<"deep_work_logs">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listDeepWorkSessions(): Promise<DeepWorkSession[]> {
  return sqliteList<DeepWorkSession>("deep_work_sessions", {
    order: "started_at DESC",
  });
}

export async function createDeepWorkSession(session: {
  task_name: string;
  date_key: string;
  minutes: number;
  category?: string;
  notes?: string;
}): Promise<DeepWorkSession> {
  const userId = await requireUserId();
  const row: DeepWorkSession = {
    id: newId(),
    user_id: userId,
    task_name: session.task_name,
    date_key: session.date_key,
    minutes: session.minutes,
    category: session.category ?? null,
    notes: session.notes ?? null,
    started_at: new Date().toISOString(),
    ended_at: null,
  };
  return sqliteUpsert("deep_work_sessions", row);
}

export async function deleteDeepWorkSession(sessionId: string): Promise<void> {
  await sqliteDelete("deep_work_sessions", { id: sessionId });
}

// ─── Deep Work Tasks (daily recurring categories) ──────────────────────────

export async function listDeepWorkTasks(): Promise<DeepWorkTask[]> {
  return sqliteList<DeepWorkTask>("deep_work_tasks", {
    order: "created_at ASC",
  });
}

export async function createDeepWorkTask(task: {
  task_name: string;
  category: string;
}): Promise<DeepWorkTask> {
  const userId = await requireUserId();
  const row: DeepWorkTask = {
    id: newId(),
    user_id: userId,
    task_name: task.task_name,
    category: task.category,
    created_at: new Date().toISOString(),
  };
  return sqliteUpsert("deep_work_tasks", row);
}

export async function deleteDeepWorkTask(taskId: string): Promise<void> {
  // Server has ON DELETE CASCADE on deep_work_logs.task_id. We mirror that
  // client-side so the logs disappear from SQLite immediately rather than
  // waiting for the next pull.
  const logs = await sqliteList<DeepWorkLog>("deep_work_logs", {
    where: "task_id = ?",
    params: [taskId],
  });
  for (const l of logs) {
    await sqliteDelete("deep_work_logs", { id: l.id });
  }
  await sqliteDelete("deep_work_tasks", { id: taskId });
}

// ─── Deep Work Logs ────────────────────────────────────────────────────────

export async function listDeepWorkLogs(): Promise<DeepWorkLog[]> {
  return sqliteList<DeepWorkLog>("deep_work_logs", {
    order: "date_key DESC",
  });
}

export async function upsertDeepWorkLog(log: {
  task_id: string;
  date_key: string;
  completed: boolean;
  earnings_today: number;
}): Promise<DeepWorkLog> {
  const userId = await requireUserId();
  const [existing] = await sqliteList<DeepWorkLog>("deep_work_logs", {
    where: "task_id = ? AND date_key = ?",
    params: [log.task_id, log.date_key],
    limit: 1,
  });

  if (existing) {
    const merged: DeepWorkLog = {
      ...existing,
      completed: log.completed,
      earnings_today: log.earnings_today,
    };
    return sqliteUpsert("deep_work_logs", merged);
  }

  const row: DeepWorkLog = {
    id: newId(),
    user_id: userId,
    task_id: log.task_id,
    date_key: log.date_key,
    completed: log.completed,
    earnings_today: log.earnings_today,
    created_at: new Date().toISOString(),
  };
  return sqliteUpsert("deep_work_logs", row);
}
