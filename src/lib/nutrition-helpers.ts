/**
 * Pure nutrition helpers. No store, no MMKV — screens that need
 * cloud state read from the useNutrition* hooks directly.
 */

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
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  date?: string;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
};

export type QuickMeal = {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export function computeBMI(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return heightM > 0
    ? Math.round((weightKg / (heightM * heightM)) * 10) / 10
    : 0;
}

export function getBMICategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Underweight", color: "warning" };
  if (bmi < 25) return { label: "Normal", color: "body" };
  if (bmi < 30) return { label: "Overweight", color: "warning" };
  return { label: "Obese", color: "danger" };
}

export function computeTDEE(profile: NutritionProfile): number {
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
