export type GymExercise = {
  id?: number;
  name: string;
  muscleGroup: string;
  equipment: string;
  createdAt: number;
};

export type GymTemplate = {
  id?: number;
  name: string;
  createdAt: number;
};

export type GymTemplateExercise = {
  id?: number;
  templateId: number;
  exerciseId: number;
  order: number;
};

export type GymSession = {
  id?: number;
  dateKey: string;
  templateId: number;
  startedAt: number;
  endedAt: number | null;
};

export type GymSet = {
  id?: number;
  sessionId: number;
  exerciseId: number;
  setIndex: number;
  weight: number;
  reps: number;
};

export type BodyWeightEntry = {
  dateKey: string;
  weightKg: number;
  createdAt: number;
};

export type SleepEntry = {
  dateKey: string;
  bedtime: string;
  wakeTime: string;
  durationMinutes: number;
  quality: 1 | 2 | 3 | 4 | 5;
  notes: string;
  createdAt: number;
};

export type NutritionProfile = {
  id: string;
  created_at: string;
  updated_at: string;
  height_cm: number;
  weight_kg: number;
  age: number;
  sex: "male" | "female";
  bodyfat_pct: number | null;
  steps_per_day: number;
  workouts_per_week: number;
  activity_multiplier: number;
  goal: "cut" | "bulk" | "maintain";
  rate_kg_per_week: 0 | 0.25 | 0.5 | 0.75 | 1;
  calorie_target: number;
  protein_g: number;
  carbs_g: number | null;
  fat_g: number | null;
};

export type NutritionMeal = {
  id: string;
  dateISO: string;
  created_at: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number | null;
  fat_g: number | null;
};
