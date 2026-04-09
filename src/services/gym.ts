/**
 * Phase 4: Gym service.
 *
 * Five tables for the workouts hub:
 *   - gym_exercises          : user-customized exercise library
 *   - gym_templates          : workout templates referencing exercises
 *   - gym_sessions           : actual workout instances (start/end times)
 *   - gym_sets               : individual sets within a session
 *   - gym_personal_records   : PR snapshots per exercise
 *
 * gym_templates.exercise_ids is a jsonb array of UUIDs (no junction
 * table needed at this scale; templates rarely have more than 10
 * exercises).
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate, Json } from "../types/supabase";

// ─── Types ──────────────────────────────────────────────────────────────────

export type GymExercise = Tables<"gym_exercises">;
export type GymTemplate = Tables<"gym_templates">;
export type GymSession = Tables<"gym_sessions">;
export type GymSet = Tables<"gym_sets">;
export type GymPR = Tables<"gym_personal_records">;

// ─── Exercises ──────────────────────────────────────────────────────────────

export async function listGymExercises(): Promise<GymExercise[]> {
  const { data, error } = await supabase
    .from("gym_exercises")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type CreateExerciseInput = {
  name: string;
  muscleGroup?: string;
  equipment?: string;
  notes?: string;
  isCustom?: boolean;
};

export async function createGymExercise(
  input: CreateExerciseInput,
): Promise<GymExercise> {
  const userId = await requireUserId();
  const row: TablesInsert<"gym_exercises"> = {
    user_id: userId,
    name: input.name,
    muscle_group: input.muscleGroup ?? null,
    equipment: input.equipment ?? null,
    notes: input.notes ?? null,
    is_custom: input.isCustom ?? true,
  };
  const { data, error } = await supabase
    .from("gym_exercises")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGymExercise(
  id: string,
  patch: Pick<TablesUpdate<"gym_exercises">, "name" | "muscle_group" | "equipment" | "notes">,
): Promise<GymExercise> {
  const { data, error } = await supabase
    .from("gym_exercises")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGymExercise(id: string): Promise<void> {
  const { error } = await supabase.from("gym_exercises").delete().eq("id", id);
  if (error) throw error;
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function listGymTemplates(): Promise<GymTemplate[]> {
  const { data, error } = await supabase
    .from("gym_templates")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type CreateTemplateInput = {
  name: string;
  description?: string;
  exerciseIds?: string[];
};

export async function createGymTemplate(
  input: CreateTemplateInput,
): Promise<GymTemplate> {
  const userId = await requireUserId();
  const row: TablesInsert<"gym_templates"> = {
    user_id: userId,
    name: input.name,
    description: input.description ?? null,
    exercise_ids: (input.exerciseIds ?? []) as unknown as Json,
  };
  const { data, error } = await supabase
    .from("gym_templates")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGymTemplate(
  id: string,
  patch: { name?: string; description?: string | null; exerciseIds?: string[] },
): Promise<GymTemplate> {
  const update: TablesUpdate<"gym_templates"> = {
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.description !== undefined && { description: patch.description }),
    ...(patch.exerciseIds !== undefined && {
      exercise_ids: patch.exerciseIds as unknown as Json,
    }),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("gym_templates")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGymTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("gym_templates").delete().eq("id", id);
  if (error) throw error;
}

// ─── Sessions ───────────────────────────────────────────────────────────────

export async function listGymSessions(rangeDays?: number): Promise<GymSession[]> {
  let query = supabase
    .from("gym_sessions")
    .select("*")
    .order("started_at", { ascending: false });
  if (rangeDays && rangeDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    query = query.gte("date_key", cutoff.toISOString().slice(0, 10));
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getGymSession(id: string): Promise<GymSession | null> {
  const { data, error } = await supabase
    .from("gym_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type StartSessionInput = {
  templateId?: string;
  name?: string;
};

export async function startGymSession(
  input: StartSessionInput = {},
): Promise<GymSession> {
  const userId = await requireUserId();
  const now = new Date();
  const row: TablesInsert<"gym_sessions"> = {
    user_id: userId,
    template_id: input.templateId ?? null,
    name: input.name ?? null,
    started_at: now.toISOString(),
    date_key: now.toISOString().slice(0, 10),
  };
  const { data, error } = await supabase
    .from("gym_sessions")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function endGymSession(id: string, notes?: string): Promise<GymSession> {
  const patch: TablesUpdate<"gym_sessions"> = {
    ended_at: new Date().toISOString(),
    notes: notes ?? null,
  };
  const { data, error } = await supabase
    .from("gym_sessions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGymSession(id: string): Promise<void> {
  const { error } = await supabase.from("gym_sessions").delete().eq("id", id);
  if (error) throw error;
}

// ─── Sets ───────────────────────────────────────────────────────────────────

export async function listGymSetsForSession(sessionId: string): Promise<GymSet[]> {
  const { data, error } = await supabase
    .from("gym_sets")
    .select("*")
    .eq("session_id", sessionId)
    .order("set_index", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type CreateSetInput = {
  sessionId: string;
  exerciseId?: string;
  exerciseName: string;
  setIndex: number;
  weight?: number;
  reps?: number;
  rpe?: number;
  notes?: string;
};

export async function createGymSet(input: CreateSetInput): Promise<GymSet> {
  const userId = await requireUserId();
  const row: TablesInsert<"gym_sets"> = {
    user_id: userId,
    session_id: input.sessionId,
    exercise_id: input.exerciseId ?? null,
    exercise_name: input.exerciseName,
    set_index: input.setIndex,
    weight: input.weight ?? null,
    reps: input.reps ?? null,
    rpe: input.rpe ?? null,
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase
    .from("gym_sets")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGymSet(
  id: string,
  patch: Pick<TablesUpdate<"gym_sets">, "weight" | "reps" | "rpe" | "notes">,
): Promise<GymSet> {
  const { data, error } = await supabase
    .from("gym_sets")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGymSet(id: string): Promise<void> {
  const { error } = await supabase.from("gym_sets").delete().eq("id", id);
  if (error) throw error;
}

// ─── Personal records ───────────────────────────────────────────────────────

export async function listGymPRs(): Promise<GymPR[]> {
  const { data, error } = await supabase
    .from("gym_personal_records")
    .select("*")
    .order("achieved_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPRForExercise(exerciseName: string): Promise<GymPR | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("gym_personal_records")
    .select("*")
    .eq("user_id", userId)
    .eq("exercise_name", exerciseName)
    .order("weight", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type RecordPRInput = {
  exerciseName: string;
  weight: number;
  reps: number;
};

export async function recordPR(input: RecordPRInput): Promise<GymPR> {
  const userId = await requireUserId();
  const row: TablesInsert<"gym_personal_records"> = {
    user_id: userId,
    exercise_name: input.exerciseName,
    weight: input.weight,
    reps: input.reps,
  };
  const { data, error } = await supabase
    .from("gym_personal_records")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePR(id: string): Promise<void> {
  const { error } = await supabase
    .from("gym_personal_records")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
