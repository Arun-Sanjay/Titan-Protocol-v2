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

export type QuickMeal = {
  id: number;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type WaterLog = {
  glasses: number; // each glass = 250ml
  targetGlasses: number; // default 8
};

// ─── Keys ───────────────────────────────────────────────────────────────────

const PROFILE_KEY = "nutrition_profile";
const QUICK_MEALS_KEY = "nutrition_quick_meals";
const WATER_TARGET_KEY = "nutrition_water_target";

function mealsKey(dateKey: string) {
  return `nutrition_meals:${dateKey}`;
}

function waterKey(dateKey: string) {
  return `nutrition_water:${dateKey}`;
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

/**
 * Compute BMI from height and weight.
 */
export function computeBMI(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  if (heightM <= 0) return 0;
  return +(weightKg / (heightM * heightM)).toFixed(1);
}

/**
 * Get BMI category label.
 */
export function getBMICategory(bmi: number): { label: string; color: "success" | "warning" | "danger" | "body" } {
  if (bmi < 18.5) return { label: "Underweight", color: "warning" };
  if (bmi < 25) return { label: "Normal", color: "success" };
  if (bmi < 30) return { label: "Overweight", color: "warning" };
  return { label: "Obese", color: "danger" };
}

// ─── Store ──────────────────────────────────────────────────────────────────

type NutritionState = {
  profile: NutritionProfile | null;
  meals: Record<string, Meal[]>;
  quickMeals: QuickMeal[];
  waterLog: Record<string, number>; // dateKey -> glasses
  waterTarget: number;

  loadProfile: () => void;
  updateProfile: (p: NutritionProfile) => void;
  loadMeals: (dateKey: string) => void;
  addMeal: (dateKey: string, meal: Omit<Meal, "id">) => void;
  deleteMeal: (dateKey: string, mealId: number) => void;
  loadQuickMeals: () => void;
  addQuickMeal: (meal: Omit<QuickMeal, "id">) => void;
  deleteQuickMeal: (id: number) => void;
  loadWater: (dateKey: string) => void;
  addWater: (dateKey: string) => void;
  removeWater: (dateKey: string) => void;
  setWaterTarget: (target: number) => void;
};

export const useNutritionStore = create<NutritionState>()((set, get) => ({
  profile: null,
  meals: {},
  quickMeals: [],
  waterLog: {},
  waterTarget: 8,

  loadProfile: () => {
    const raw = getJSON<NutritionProfile | null>(PROFILE_KEY, null);
    // Validate loaded profile has required fields
    if (raw && typeof raw.height_cm === "number" && typeof raw.weight_kg === "number"
        && typeof raw.age === "number" && typeof raw.calorie_target === "number"
        && raw.calorie_target > 0 && typeof raw.protein_g === "number") {
      set({ profile: raw });
    } else {
      set({ profile: null });
    }
  },

  updateProfile: (p) => {
    // Validate ranges at store level
    if (p.height_cm < 50 || p.height_cm > 300) return;
    if (p.weight_kg < 20 || p.weight_kg > 500) return;
    if (p.age < 10 || p.age > 120) return;
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

  loadQuickMeals: () => {
    const qm = getJSON<QuickMeal[]>(QUICK_MEALS_KEY, []);
    set({ quickMeals: qm });
  },

  addQuickMeal: (meal) => {
    const id = nextId();
    const full: QuickMeal = { ...meal, id };
    const updated = [...get().quickMeals, full];
    setJSON(QUICK_MEALS_KEY, updated);
    set({ quickMeals: updated });
  },

  deleteQuickMeal: (id) => {
    const updated = get().quickMeals.filter((m) => m.id !== id);
    setJSON(QUICK_MEALS_KEY, updated);
    set({ quickMeals: updated });
  },

  loadWater: (dateKey) => {
    const glasses = getJSON<number>(waterKey(dateKey), 0);
    const target = getJSON<number>(WATER_TARGET_KEY, 8);
    set((s) => ({
      waterLog: { ...s.waterLog, [dateKey]: glasses },
      waterTarget: target,
    }));
  },

  addWater: (dateKey) => {
    const current = get().waterLog[dateKey] ?? 0;
    if (current >= 30) return; // cap at 30 glasses (7.5L)
    const updated = current + 1;
    setJSON(waterKey(dateKey), updated);
    set((s) => ({ waterLog: { ...s.waterLog, [dateKey]: updated } }));
  },

  removeWater: (dateKey) => {
    const current = get().waterLog[dateKey] ?? 0;
    const updated = Math.max(0, current - 1);
    setJSON(waterKey(dateKey), updated);
    set((s) => ({ waterLog: { ...s.waterLog, [dateKey]: updated } }));
  },

  setWaterTarget: (target) => {
    setJSON(WATER_TARGET_KEY, target);
    set({ waterTarget: target });
  },
}));
