/**
 * Phase 4: Nutrition service.
 *
 * Two tables:
 *   - nutrition_profile: singleton per user (TDEE inputs + computed
 *     macro targets). The TDEE math itself stays client-side; this
 *     service just stores the inputs and the resulting targets so the
 *     UI doesn't have to recompute on every render.
 *   - meal_logs: per-day meal entries with calories + macros.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "../types/supabase";

// ─── Profile ────────────────────────────────────────────────────────────────

export type NutritionProfile = Tables<"nutrition_profile">;

export async function getNutritionProfile(): Promise<NutritionProfile | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("nutrition_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertNutritionProfile(
  patch: Omit<TablesInsert<"nutrition_profile">, "user_id">,
): Promise<NutritionProfile> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("nutrition_profile")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Meal logs ──────────────────────────────────────────────────────────────

export type MealLog = Tables<"meal_logs">;

export async function listMealLogs(dateKey: string): Promise<MealLog[]> {
  const { data, error } = await supabase
    .from("meal_logs")
    .select("*")
    .eq("date_key", dateKey)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listMealLogsForRange(
  startDateKey: string,
  endDateKey: string,
): Promise<MealLog[]> {
  const { data, error } = await supabase
    .from("meal_logs")
    .select("*")
    .gte("date_key", startDateKey)
    .lte("date_key", endDateKey)
    .order("date_key", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type CreateMealLogInput = {
  dateKey: string;
  name: string;
  calories: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
};

export async function createMealLog(input: CreateMealLogInput): Promise<MealLog> {
  const userId = await requireUserId();
  const row: TablesInsert<"meal_logs"> = {
    user_id: userId,
    date_key: input.dateKey,
    name: input.name,
    calories: input.calories,
    protein_g: input.proteinG ?? 0,
    carbs_g: input.carbsG ?? 0,
    fat_g: input.fatG ?? 0,
  };
  const { data, error } = await supabase
    .from("meal_logs")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type UpdateMealLogInput = {
  id: string;
  patch: Pick<TablesUpdate<"meal_logs">, "name" | "calories" | "protein_g" | "carbs_g" | "fat_g">;
};

export async function updateMealLog(input: UpdateMealLogInput): Promise<MealLog> {
  const { data, error } = await supabase
    .from("meal_logs")
    .update(input.patch)
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMealLog(id: string): Promise<void> {
  const { error } = await supabase.from("meal_logs").delete().eq("id", id);
  if (error) throw error;
}
