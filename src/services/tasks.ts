import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteDelete,
  sqliteList,
  sqliteUpsert,
  transaction,
} from "../db/sqlite/service-helpers";
import { sqliteGet } from "../db/sqlite/service-helpers";
import type { Tables, Enums } from "../types/supabase";
import { toLocalDateKey } from "../lib/date";

// ─── Types ──────────────────────────────────────────────────────────────────

export type Task = Tables<"tasks">;
export type Completion = Tables<"completions">;
export type EngineKey = Enums<"engine_key">;
export type TaskKind = Enums<"task_kind">;

export const ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

// ─── Tasks ──────────────────────────────────────────────────────────────────

export async function listTasks(): Promise<Task[]> {
  return sqliteList<Task>("tasks", { order: "created_at ASC" });
}

export async function listTasksByEngine(engine: EngineKey): Promise<Task[]> {
  return sqliteList<Task>("tasks", {
    where: "engine = ?",
    params: [engine],
    order: "created_at ASC",
  });
}

export async function createTask(input: {
  title: string;
  engine: EngineKey;
  kind?: TaskKind;
  days_per_week?: number;
}): Promise<Task> {
  const userId = await requireUserId();
  const row: Task = {
    id: newId(),
    user_id: userId,
    title: input.title,
    engine: input.engine,
    kind: input.kind ?? "main",
    days_per_week: input.days_per_week ?? 7,
    is_active: true,
    legacy_local_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return sqliteUpsert("tasks", row);
}

export async function deleteTask(taskId: string): Promise<void> {
  await sqliteDelete("tasks", { id: taskId });
}

// ─── Completions ────────────────────────────────────────────────────────────

export async function listCompletionsForDate(
  dateKey: string,
): Promise<Completion[]> {
  return sqliteList<Completion>("completions", {
    where: "date_key = ?",
    params: [dateKey],
  });
}

export async function listCompletionsByEngine(
  engine: EngineKey,
  dateKey: string,
): Promise<Completion[]> {
  return sqliteList<Completion>("completions", {
    where: "engine = ? AND date_key = ?",
    params: [engine, dateKey],
  });
}

export async function listRecentCompletions(days: number): Promise<Completion[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceKey = toLocalDateKey(since);
  return sqliteList<Completion>("completions", {
    where: "date_key >= ?",
    params: [sinceKey],
    order: "created_at DESC",
  });
}

/**
 * Toggle completion for a (task, dateKey) pair. Checks existing row,
 * soft-deletes if present, inserts if absent. Returns which direction
 * the toggle went.
 *
 * Wrapped in a SQLite transaction so two near-simultaneous taps
 * serialize: the second sees the row inserted by the first and toggles
 * it off, instead of both inserting and tripping the
 * `uq_completions_task_date` partial unique index. The previous
 * check-then-insert version raced on rapid taps from HQ + Engine.
 *
 * Local-first: both branches complete at SQLite-write latency (~1ms),
 * no await on network.
 */
export async function toggleCompletion(params: {
  taskId: string;
  dateKey: string;
  engine: EngineKey;
}): Promise<{ added: boolean }> {
  const userId = await requireUserId();
  return transaction(async () => {
    const [existing] = await sqliteList<Completion>("completions", {
      where: "task_id = ? AND date_key = ?",
      params: [params.taskId, params.dateKey],
      limit: 1,
    });
    if (existing) {
      await sqliteDelete("completions", { id: existing.id });
      return { added: false };
    }
    await sqliteUpsert("completions", {
      id: newId(),
      user_id: userId,
      task_id: params.taskId,
      date_key: params.dateKey,
      engine: params.engine,
      created_at: new Date().toISOString(),
    });
    return { added: true };
  });
}

/**
 * Atomic toggle-and-award. Wraps the completion toggle and the matching
 * XP delta in a SINGLE SQLite transaction so:
 *
 *   - A failure on the XP write rolls back the toggle, so we never
 *     complete a task without crediting it (or, on un-complete, never
 *     subtract XP that was never awarded).
 *   - Concurrent taps serialize (transaction acts as a per-row mutex);
 *     the second tap sees the first's completion row and reverses it.
 *
 * Returns the toggle direction plus the level-up info so callers can
 * enqueue rank-up events outside the tx.
 */
export async function toggleCompletionAndAward(params: {
  taskId: string;
  dateKey: string;
  engine: EngineKey;
  xpAmount: number;
}): Promise<{
  added: boolean;
  leveledUp: boolean;
  fromLevel: number;
  toLevel: number;
  xp: number;
}> {
  const userId = await requireUserId();
  return transaction(async () => {
    // ── Toggle the completion row. ───────────────────────────────────
    const [existing] = await sqliteList<Completion>("completions", {
      where: "task_id = ? AND date_key = ?",
      params: [params.taskId, params.dateKey],
      limit: 1,
    });
    let added: boolean;
    if (existing) {
      await sqliteDelete("completions", { id: existing.id });
      added = false;
    } else {
      await sqliteUpsert("completions", {
        id: newId(),
        user_id: userId,
        task_id: params.taskId,
        date_key: params.dateKey,
        engine: params.engine,
        created_at: new Date().toISOString(),
      });
      added = true;
    }

    // ── Apply the matching XP delta inside the same tx. ──────────────
    // Direct SQL via service-helpers (not the awardXP service) so we
    // stay inside the outer transaction — calling awardXP here would
    // open a SAVEPOINT which works, but pulling the read+write inline
    // keeps the code obvious and avoids a second module import cycle.
    type ProfileRow = Tables<"profiles">;
    const profile = await sqliteGet<ProfileRow>("profiles", { id: userId });
    const oldXP = profile?.xp ?? 0;
    const oldLevel = profile?.level ?? 1;
    const xpDelta = added ? params.xpAmount : -params.xpAmount;
    const newXP = Math.max(0, oldXP + xpDelta);
    const newLevel = Math.floor(newXP / 500) + 1;

    if (profile) {
      await sqliteUpsert("profiles", {
        ...profile,
        xp: newXP,
        level: newLevel,
      });
    } else {
      // No profile row yet (extremely rare — should have been created
      // at sign-in). Insert a minimal row so the XP isn't silently lost.
      await sqliteUpsert("profiles", {
        id: userId,
        email: null,
        archetype: null,
        mode: "full_protocol",
        focus_engines: [],
        xp: newXP,
        level: newLevel,
        streak_current: 0,
        streak_best: 0,
        streak_last_date: null,
        first_use_date: null,
        onboarding_completed: false,
        tutorial_completed: false,
        first_task_completed_at: null,
        display_name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return {
      added,
      leveledUp: newLevel > oldLevel,
      fromLevel: oldLevel,
      toLevel: newLevel,
      xp: newXP,
    };
  });
}

// ─── Score Computation (pure) ──────────────────────────────────────────────

/**
 * Compute an engine's daily score (0-100) based on task completion.
 */
export function computeEngineScore(
  tasks: Task[],
  completions: Completion[] | Set<string>,
  engine?: EngineKey,
): number {
  const engineTasks = engine
    ? tasks.filter((t) => t.engine === engine && t.is_active)
    : tasks.filter((t) => t.is_active);
  if (engineTasks.length === 0) return 0;

  const completedIds =
    completions instanceof Set
      ? completions
      : new Set(completions.map((c) => c.task_id));
  const mainTasks = engineTasks.filter((t) => t.kind === "main");
  const sideTasks = engineTasks.filter((t) => t.kind === "secondary");

  const mainDone = mainTasks.filter((t) => completedIds.has(t.id)).length;
  const sideDone = sideTasks.filter((t) => completedIds.has(t.id)).length;

  const mainWeight = 0.7;
  const sideWeight = 0.3;

  const mainScore =
    mainTasks.length > 0 ? (mainDone / mainTasks.length) * 100 : 0;
  const sideScore =
    sideTasks.length > 0 ? (sideDone / sideTasks.length) * 100 : 0;

  if (mainTasks.length > 0 && sideTasks.length > 0) {
    return Math.round(mainScore * mainWeight + sideScore * sideWeight);
  }
  if (mainTasks.length > 0) return Math.round(mainScore);
  return Math.round(sideScore);
}
