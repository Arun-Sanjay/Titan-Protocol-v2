import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types (re-exported via lib/nutrition-helpers.ts) ────────────────────────

export type NutritionProfile = {
  age: number;
  height_cm: number;
  weight_kg: number;
  sex: "male" | "female";
  activity_multiplier: number;
  goal: "cut" | "maintain" | "bulk";
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
  date?: string;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
};

export type QuickMeal = {
  id: number;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

// ─── Pure helpers (re-exported via lib/nutrition-helpers.ts) ─────────────────

export function computeBMI(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return heightM > 0 ? Math.round((weightKg / (heightM * heightM)) * 10) / 10 : 0;
}

export function getBMICategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Underweight", color: "warning" };
  if (bmi < 25) return { label: "Normal", color: "body" };
  if (bmi < 30) return { label: "Overweight", color: "warning" };
  return { label: "Obese", color: "danger" };
}

export function computeTDEE(profile: NutritionProfile): number {
  // Mifflin-St Jeor equation
  const base =
    profile.sex === "male"
      ? 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * profile.age + 5
      : 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * profile.age - 161;

  return Math.round(base * (profile.activity_multiplier ?? 1.2));
}

export function computeDayMacros(
  meals: Meal[],
): { calories: number; protein: number; carbs: number; fat: number } {
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
  meals: Meal[];
  quickMeals: QuickMeal[];
  waterLog: Record<string, number>;
  waterTarget: number;

  setProfile: (profile: NutritionProfile) => void;
  addMeal: (meal: Omit<Meal, "id">) => void;
  removeMeal: (id: number) => void;
  addQuickMeal: (meal: Omit<QuickMeal, "id">) => void;
  deleteQuickMeal: (id: number) => void;
  loadQuickMeals: () => void;
  loadWater: (dateKey: string) => void;
  addWater: (dateKey: string) => void;
  removeWater: (dateKey: string) => void;
  load: () => void;
};

export const useNutritionStore = create<NutritionState>((set, get) => ({
  profile: getJSON<NutritionProfile | null>("nutrition_profile", null),
  meals: getJSON<Meal[]>("nutrition_meals", []),
  quickMeals: getJSON<QuickMeal[]>("nutrition_quick_meals", []),
  waterLog: {},
  waterTarget: getJSON<number>("nutrition_water_target", 8),

  setProfile: (profile) => {
    setJSON("nutrition_profile", profile);
    set({ profile });
  },

  addMeal: (mealData) => {
    set((s) => {
      const id = Date.now();
      const meal: Meal = { ...mealData, id };
      const meals = [...s.meals, meal];
      setJSON("nutrition_meals", meals);
      return { meals };
    });
  },

  removeMeal: (id) => {
    set((s) => {
      const meals = s.meals.filter((m) => m.id !== id);
      setJSON("nutrition_meals", meals);
      return { meals };
    });
  },

  addQuickMeal: (mealData) => {
    set((s) => {
      const id = Date.now();
      const meal: QuickMeal = { ...mealData, id };
      const quickMeals = [...s.quickMeals, meal];
      setJSON("nutrition_quick_meals", quickMeals);
      return { quickMeals };
    });
  },

  deleteQuickMeal: (id) => {
    set((s) => {
      const quickMeals = s.quickMeals.filter((m) => m.id !== id);
      setJSON("nutrition_quick_meals", quickMeals);
      return { quickMeals };
    });
  },

  loadQuickMeals: () => {
    set({ quickMeals: getJSON<QuickMeal[]>("nutrition_quick_meals", []) });
  },

  loadWater: (dateKey) => {
    const key = `nutrition_water:${dateKey}`;
    const glasses = getJSON<number>(key, 0);
    set((s) => ({ waterLog: { ...s.waterLog, [dateKey]: glasses } }));
  },

  addWater: (dateKey) => {
    set((s) => {
      const current = s.waterLog[dateKey] ?? 0;
      const updated = current + 1;
      const key = `nutrition_water:${dateKey}`;
      setJSON(key, updated);
      return { waterLog: { ...s.waterLog, [dateKey]: updated } };
    });
  },

  removeWater: (dateKey) => {
    set((s) => {
      const current = s.waterLog[dateKey] ?? 0;
      const updated = Math.max(0, current - 1);
      const key = `nutrition_water:${dateKey}`;
      setJSON(key, updated);
      return { waterLog: { ...s.waterLog, [dateKey]: updated } };
    });
  },

  load: () => {
    set({
      profile: getJSON<NutritionProfile | null>("nutrition_profile", null),
      meals: getJSON<Meal[]>("nutrition_meals", []),
      quickMeals: getJSON<QuickMeal[]>("nutrition_quick_meals", []),
    });
  },
}));
