import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteDelete,
  sqliteGet,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type NutritionProfile = Tables<"nutrition_profile">;
export type MealLog = Tables<"meal_logs">;
export type QuickMeal = Tables<"quick_meals">;
export type WaterLog = Tables<"water_logs">;

// ─── Nutrition Profile ─────────────────────────────────────────────────────

export async function getNutritionProfile(): Promise<NutritionProfile | null> {
  const userId = await requireUserId();
  return sqliteGet<NutritionProfile>("nutrition_profile", { user_id: userId });
}

export async function upsertNutritionProfile(
  profile: Partial<Omit<NutritionProfile, "user_id" | "updated_at">>,
): Promise<NutritionProfile> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const existing = await sqliteGet<NutritionProfile>("nutrition_profile", {
    user_id: userId,
  });

  const base: NutritionProfile = existing ?? {
    user_id: userId,
    sex: null,
    age: null,
    height_cm: null,
    weight_kg: null,
    body_fat_pct: null,
    steps_per_day: null,
    workouts_per_week: null,
    goal: null,
    goal_rate: null,
    protein_preference: null,
    daily_calorie_target: null,
    protein_target_g: null,
    carbs_target_g: null,
    fat_target_g: null,
    bmr: null,
    tdee: null,
    updated_at: now,
  };

  const merged: NutritionProfile = {
    ...base,
    ...profile,
    user_id: userId,
    updated_at: now,
  };
  return sqliteUpsert("nutrition_profile", merged);
}

// ─── Meal Logs ─────────────────────────────────────────────────────────────

export async function listMealLogs(): Promise<MealLog[]> {
  return sqliteList<MealLog>("meal_logs", { order: "created_at DESC" });
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
  const row: MealLog = {
    id: newId(),
    user_id: userId,
    name: meal.name,
    date_key: meal.date_key,
    calories: meal.calories ?? 0,
    protein_g: meal.protein_g ?? 0,
    carbs_g: meal.carbs_g ?? 0,
    fat_g: meal.fat_g ?? 0,
    created_at: new Date().toISOString(),
  };
  return sqliteUpsert("meal_logs", row);
}

export async function deleteMealLog(mealId: string): Promise<void> {
  await sqliteDelete("meal_logs", { id: mealId });
}

// ─── Quick Meals ───────────────────────────────────────────────────────────

export async function listQuickMeals(): Promise<QuickMeal[]> {
  return sqliteList<QuickMeal>("quick_meals", { order: "created_at DESC" });
}

export async function createQuickMeal(meal: {
  name: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}): Promise<QuickMeal> {
  const userId = await requireUserId();
  const row: QuickMeal = {
    id: newId(),
    user_id: userId,
    name: meal.name,
    calories: meal.calories ?? 0,
    protein_g: meal.protein_g ?? 0,
    carbs_g: meal.carbs_g ?? 0,
    fat_g: meal.fat_g ?? 0,
    created_at: new Date().toISOString(),
  };
  return sqliteUpsert("quick_meals", row);
}

export async function deleteQuickMeal(id: string): Promise<void> {
  await sqliteDelete("quick_meals", { id });
}

// ─── Water Logs ────────────────────────────────────────────────────────────

export async function getWaterLog(dateKey: string): Promise<WaterLog | null> {
  const [row] = await sqliteList<WaterLog>("water_logs", {
    where: "date_key = ?",
    params: [dateKey],
    limit: 1,
  });
  return row ?? null;
}

export async function listWaterLogs(): Promise<WaterLog[]> {
  return sqliteList<WaterLog>("water_logs", { order: "date_key DESC" });
}

export async function adjustWaterGlasses(
  dateKey: string,
  delta: number,
): Promise<WaterLog> {
  const userId = await requireUserId();
  const now = new Date().toISOString();

  const existing = await getWaterLog(dateKey);
  if (existing) {
    const next = Math.max(0, existing.glasses + delta);
    const merged: WaterLog = {
      ...existing,
      glasses: next,
      updated_at: now,
    };
    return sqliteUpsert("water_logs", merged);
  }

  const next = Math.max(0, delta);
  const row: WaterLog = {
    id: newId(),
    user_id: userId,
    date_key: dateKey,
    glasses: next,
    updated_at: now,
  };
  return sqliteUpsert("water_logs", row);
}
