import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type NutritionProfile = Tables<"nutrition_profile">;
export type MealLog = Tables<"meal_logs">;

// ─── Nutrition Profile ─────────────────────────────────────────────────────

export async function getNutritionProfile(): Promise<NutritionProfile | null> {
  const { data, error } = await supabase
    .from("nutrition_profile")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertNutritionProfile(
  profile: Partial<Omit<NutritionProfile, "user_id" | "updated_at">>,
): Promise<NutritionProfile> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("nutrition_profile")
    .upsert({
      user_id: userId,
      ...profile,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Meal Logs ─────────────────────────────────────────────────────────────

export async function listMealLogs(): Promise<MealLog[]> {
  const { data, error } = await supabase
    .from("meal_logs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createMealLog(meal: {
  name: string;
  date_key: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}): Promise<MealLog> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("meal_logs")
    .insert({
      user_id: userId,
      name: meal.name,
      date_key: meal.date_key,
      calories: meal.calories ?? 0,
      protein_g: meal.protein_g ?? 0,
      carbs_g: meal.carbs_g ?? 0,
      fat_g: meal.fat_g ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMealLog(mealId: string): Promise<void> {
  const { error } = await supabase
    .from("meal_logs")
    .delete()
    .eq("id", mealId);
  if (error) throw error;
}
