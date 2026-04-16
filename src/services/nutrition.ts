import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type NutritionProfile = Tables<"nutrition_profile">;
export type MealLog = Tables<"meal_logs">;
export type QuickMeal = Tables<"quick_meals">;
export type WaterLog = Tables<"water_logs">;

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

// ─── Quick Meals ───────────────────────────────────────────────────────────

export async function listQuickMeals(): Promise<QuickMeal[]> {
  const { data, error } = await supabase
    .from("quick_meals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createQuickMeal(meal: {
  name: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}): Promise<QuickMeal> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("quick_meals")
    .insert({
      user_id: userId,
      name: meal.name,
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

export async function deleteQuickMeal(id: string): Promise<void> {
  const { error } = await supabase.from("quick_meals").delete().eq("id", id);
  if (error) throw error;
}

// ─── Water Logs ────────────────────────────────────────────────────────────

export async function getWaterLog(dateKey: string): Promise<WaterLog | null> {
  const { data, error } = await supabase
    .from("water_logs")
    .select("*")
    .eq("date_key", dateKey)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listWaterLogs(): Promise<WaterLog[]> {
  const { data, error } = await supabase
    .from("water_logs")
    .select("*")
    .order("date_key", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function adjustWaterGlasses(
  dateKey: string,
  delta: number,
): Promise<WaterLog> {
  const userId = await requireUserId();
  const { data: existing } = await supabase
    .from("water_logs")
    .select("id, glasses")
    .eq("date_key", dateKey)
    .maybeSingle();

  if (existing) {
    const next = Math.max(0, existing.glasses + delta);
    const { data, error } = await supabase
      .from("water_logs")
      .update({ glasses: next, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const next = Math.max(0, delta);
  const { data, error } = await supabase
    .from("water_logs")
    .insert({ user_id: userId, date_key: dateKey, glasses: next })
    .select()
    .single();
  if (error) throw error;
  return data;
}
