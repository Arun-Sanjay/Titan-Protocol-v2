import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteDelete,
  sqliteGet,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";
import type { Json } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type GymSession = Tables<"gym_sessions">;
export type GymSet = Tables<"gym_sets">;
export type GymExercise = Tables<"gym_exercises">;
export type GymTemplate = Tables<"gym_templates">;
export type GymPersonalRecord = Tables<"gym_personal_records">;

// ─── Sessions ──────────────────────────────────────────────────────────────

export async function listSessions(limit = 30): Promise<GymSession[]> {
  return sqliteList<GymSession>("gym_sessions", {
    order: "started_at DESC",
    limit,
  });
}

export async function getActiveSession(): Promise<GymSession | null> {
  const [row] = await sqliteList<GymSession>("gym_sessions", {
    where: "ended_at IS NULL",
    order: "started_at DESC",
    limit: 1,
  });
  return row ?? null;
}

export async function startSession(params: {
  date_key: string;
  name?: string;
  template_id?: string;
}): Promise<GymSession> {
  const userId = await requireUserId();
  const row: GymSession = {
    id: newId(),
    user_id: userId,
    date_key: params.date_key,
    name: params.name ?? null,
    template_id: params.template_id ?? null,
    notes: null,
    started_at: new Date().toISOString(),
    ended_at: null,
  };
  return sqliteUpsert("gym_sessions", row);
}

export async function endSession(sessionId: string): Promise<GymSession> {
  const existing = await sqliteGet<GymSession>("gym_sessions", {
    id: sessionId,
  });
  if (!existing) throw new Error("Session not found");
  const merged: GymSession = {
    ...existing,
    ended_at: new Date().toISOString(),
  };
  return sqliteUpsert("gym_sessions", merged);
}

export async function deleteSession(sessionId: string): Promise<void> {
  // Delete sets first (preserves the old behaviour where sets are removed
  // before the parent session).
  const sets = await sqliteList<GymSet>("gym_sets", {
    where: "session_id = ?",
    params: [sessionId],
  });
  for (const s of sets) {
    await sqliteDelete("gym_sets", { id: s.id });
  }
  await sqliteDelete("gym_sessions", { id: sessionId });
}

// ─── Sets ──────────────────────────────────────────────────────────────────

export async function listSetsForSession(
  sessionId: string,
): Promise<GymSet[]> {
  return sqliteList<GymSet>("gym_sets", {
    where: "session_id = ?",
    params: [sessionId],
    order: "set_index ASC",
  });
}

export async function addSet(params: {
  session_id: string;
  exercise_name: string;
  exercise_id?: string;
  set_index: number;
  weight?: number;
  reps?: number;
  rpe?: number;
  notes?: string;
}): Promise<GymSet> {
  const userId = await requireUserId();
  const row: GymSet = {
    id: newId(),
    user_id: userId,
    session_id: params.session_id,
    exercise_name: params.exercise_name,
    exercise_id: params.exercise_id ?? null,
    set_index: params.set_index,
    weight: params.weight ?? null,
    reps: params.reps ?? null,
    rpe: params.rpe ?? null,
    notes: params.notes ?? null,
    created_at: new Date().toISOString(),
  };
  return sqliteUpsert("gym_sets", row);
}

export async function updateSet(
  setId: string,
  updates: { weight?: number; reps?: number; rpe?: number; notes?: string },
): Promise<GymSet> {
  const existing = await sqliteGet<GymSet>("gym_sets", { id: setId });
  if (!existing) throw new Error("Set not found");
  const merged: GymSet = { ...existing, ...updates };
  return sqliteUpsert("gym_sets", merged);
}

export async function deleteSet(setId: string): Promise<void> {
  await sqliteDelete("gym_sets", { id: setId });
}

// ─── Exercises ──────────────────────────────────────────────────────────────

export async function listExercises(): Promise<GymExercise[]> {
  return sqliteList<GymExercise>("gym_exercises", { order: "name ASC" });
}

export async function createExercise(params: {
  name: string;
  muscle_group?: string;
  equipment?: string;
  notes?: string;
}): Promise<GymExercise> {
  const userId = await requireUserId();
  const row: GymExercise = {
    id: newId(),
    user_id: userId,
    name: params.name,
    muscle_group: params.muscle_group ?? null,
    equipment: params.equipment ?? null,
    notes: params.notes ?? null,
    is_custom: true,
    created_at: new Date().toISOString(),
  };
  return sqliteUpsert("gym_exercises", row);
}

export async function deleteExercise(exerciseId: string): Promise<void> {
  await sqliteDelete("gym_exercises", { id: exerciseId });
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function listTemplates(): Promise<GymTemplate[]> {
  return sqliteList<GymTemplate>("gym_templates", { order: "name ASC" });
}

export async function createTemplate(params: {
  name: string;
  description?: string;
  exercise_ids?: string[];
}): Promise<GymTemplate> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const row: GymTemplate = {
    id: newId(),
    user_id: userId,
    name: params.name,
    description: params.description ?? null,
    exercise_ids: (params.exercise_ids ?? []) as unknown as Json,
    created_at: now,
    updated_at: now,
  };
  return sqliteUpsert("gym_templates", row);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await sqliteDelete("gym_templates", { id: templateId });
}

// ─── Personal Records ────────────────────────────────────────────────────

export async function listPersonalRecords(): Promise<GymPersonalRecord[]> {
  return sqliteList<GymPersonalRecord>("gym_personal_records", {
    order: "achieved_at DESC",
  });
}

export async function upsertPersonalRecord(params: {
  exercise_name: string;
  weight: number;
  reps: number;
}): Promise<GymPersonalRecord> {
  const userId = await requireUserId();
  const row: GymPersonalRecord = {
    id: newId(),
    user_id: userId,
    exercise_name: params.exercise_name,
    weight: params.weight,
    reps: params.reps,
    achieved_at: new Date().toISOString(),
  };
  return sqliteUpsert("gym_personal_records", row);
}
