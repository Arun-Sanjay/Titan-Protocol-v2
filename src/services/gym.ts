import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type GymSession = Tables<"gym_sessions">;
export type GymSet = Tables<"gym_sets">;
export type GymExercise = Tables<"gym_exercises">;
export type GymTemplate = Tables<"gym_templates">;
export type GymPersonalRecord = Tables<"gym_personal_records">;

// ─── Sessions ──────────────────────────────────────────────────────────────

export async function listSessions(limit = 30): Promise<GymSession[]> {
  const { data, error } = await supabase
    .from("gym_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getActiveSession(): Promise<GymSession | null> {
  const { data, error } = await supabase
    .from("gym_sessions")
    .select("*")
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function startSession(params: {
  date_key: string;
  name?: string;
  template_id?: string;
}): Promise<GymSession> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("gym_sessions")
    .insert({
      user_id: userId,
      date_key: params.date_key,
      name: params.name ?? null,
      template_id: params.template_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function endSession(sessionId: string): Promise<GymSession> {
  const { data, error } = await supabase
    .from("gym_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  // Delete sets first (FK constraint)
  await supabase.from("gym_sets").delete().eq("session_id", sessionId);
  const { error } = await supabase
    .from("gym_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) throw error;
}

// ─── Sets ──────────────────────────────────────────────────────────────────

export async function listSetsForSession(
  sessionId: string,
): Promise<GymSet[]> {
  const { data, error } = await supabase
    .from("gym_sets")
    .select("*")
    .eq("session_id", sessionId)
    .order("set_index", { ascending: true });
  if (error) throw error;
  return data ?? [];
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
  const { data, error } = await supabase
    .from("gym_sets")
    .insert({
      user_id: userId,
      session_id: params.session_id,
      exercise_name: params.exercise_name,
      exercise_id: params.exercise_id ?? null,
      set_index: params.set_index,
      weight: params.weight ?? null,
      reps: params.reps ?? null,
      rpe: params.rpe ?? null,
      notes: params.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSet(
  setId: string,
  updates: { weight?: number; reps?: number; rpe?: number; notes?: string },
): Promise<GymSet> {
  const { data, error } = await supabase
    .from("gym_sets")
    .update(updates)
    .eq("id", setId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSet(setId: string): Promise<void> {
  const { error } = await supabase.from("gym_sets").delete().eq("id", setId);
  if (error) throw error;
}

// ─── Exercises ──────────────────────────────────────────────────────────────

export async function listExercises(): Promise<GymExercise[]> {
  const { data, error } = await supabase
    .from("gym_exercises")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createExercise(params: {
  name: string;
  muscle_group?: string;
  equipment?: string;
  notes?: string;
}): Promise<GymExercise> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("gym_exercises")
    .insert({
      user_id: userId,
      name: params.name,
      muscle_group: params.muscle_group ?? null,
      equipment: params.equipment ?? null,
      notes: params.notes ?? null,
      is_custom: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExercise(exerciseId: string): Promise<void> {
  const { error } = await supabase
    .from("gym_exercises")
    .delete()
    .eq("id", exerciseId);
  if (error) throw error;
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function listTemplates(): Promise<GymTemplate[]> {
  const { data, error } = await supabase
    .from("gym_templates")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTemplate(params: {
  name: string;
  description?: string;
  exercise_ids?: string[];
}): Promise<GymTemplate> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("gym_templates")
    .insert({
      user_id: userId,
      name: params.name,
      description: params.description ?? null,
      exercise_ids: params.exercise_ids ?? [],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const { error } = await supabase
    .from("gym_templates")
    .delete()
    .eq("id", templateId);
  if (error) throw error;
}

// ─── Personal Records ────────────────────────────────────────────────────

export async function listPersonalRecords(): Promise<GymPersonalRecord[]> {
  const { data, error } = await supabase
    .from("gym_personal_records")
    .select("*")
    .order("achieved_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertPersonalRecord(params: {
  exercise_name: string;
  weight: number;
  reps: number;
}): Promise<GymPersonalRecord> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("gym_personal_records")
    .insert({
      user_id: userId,
      exercise_name: params.exercise_name,
      weight: params.weight,
      reps: params.reps,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
