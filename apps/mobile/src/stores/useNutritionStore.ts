import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";

// ─── Types ──────────────────────────────────────────────────────────────────

export type NutritionProfile = {
  height_cm: number;
  weight_kg: number;
  age: number;
  sex: "male" | "female";
  activity_multiplier: number; // 1.2 (sedentary) to 1.9 (very active)
  goal: "cut" | "bulk" | "maintain";
  calorie_target: number;
  protein_g: number;
};

export type Meal = {
  id: number;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

// ─── Keys ───────────────────────────────────────────────────────────────────

const PROFILE_KEY = "nutrition_profile";
function mealsKey(dateKey: string) {
  return `nutrition_meals:${dateKey}`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Mifflin-St Jeor equation for TDEE.
 * BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age - constant
 * TDEE = BMR * activity_multiplier
 */
export function computeTDEE(profile: NutritionProfile): number {
  const { weight_kg, height_cm, age, sex, activity_multiplier } = profile;
  const sexConstant = sex === "male" ? 5 : -161;
  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + sexConstant;
  return Math.round(bmr * activity_multiplier);
}

/**
 * Sum macro totals from a list of meals.
 */
export function computeDayMacros(meals: Meal[]): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein_g,
      carbs: acc.carbs + m.carbs_g,
      fat: acc.fat + m.fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

// ─── Store ──────────────────────────────────────────────────────────────────

type NutritionState = {
  profile: NutritionProfile | null;
  meals: Record<string, Meal[]>;

  loadProfile: () => void;
  updateProfile: (p: NutritionProfile) => void;
  loadMeals: (dateKey: string) => void;
  addMeal: (dateKey: string, meal: Omit<Meal, "id">) => void;
  deleteMeal: (dateKey: string, mealId: number) => void;
};

export const useNutritionStore = create<NutritionState>()((set, get) => ({
  profile: null,
  meals: {},

  loadProfile: () => {
    const profile = getJSON<NutritionProfile | null>(PROFILE_KEY, null);
    set({ profile });
  },

  updateProfile: (p) => {
    // Bug 15: enforce calorie floor
    let calorie_target = p.calorie_target;
    calorie_target = Math.max(calorie_target, p.sex === "female" ? 1200 : 1500);
    const updated = { ...p, calorie_target };
    setJSON(PROFILE_KEY, updated);
    set({ profile: updated });
  },

  loadMeals: (dateKey) => {
    const loaded = getJSON<Meal[]>(mealsKey(dateKey), []);
    set((s) => ({ meals: { ...s.meals, [dateKey]: loaded } }));
  },

  addMeal: (dateKey, meal) => {
    const id = nextId();
    const full: Meal = { ...meal, id };
    const current = get().meals[dateKey] ?? getJSON<Meal[]>(mealsKey(dateKey), []);
    const updated = [...current, full];
    setJSON(mealsKey(dateKey), updated);
    set((s) => ({ meals: { ...s.meals, [dateKey]: updated } }));
  },

  deleteMeal: (dateKey, mealId) => {
    const current = get().meals[dateKey] ?? getJSON<Meal[]>(mealsKey(dateKey), []);
    const updated = current.filter((m) => m.id !== mealId);
    setJSON(mealsKey(dateKey), updated);
    set((s) => ({ meals: { ...s.meals, [dateKey]: updated } }));
  },
}));
