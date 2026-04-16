/**
 * Pure gym types and constants. Cloud state comes from the
 * useGymSessions / useGymSets / useGymExercises / useGymTemplates /
 * useGymPersonalRecords hooks — no Zustand store involved.
 */

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "legs"
  | "core"
  | "glutes"
  | "calves"
  | "forearms"
  | "full_body"
  | "cardio";

export type SetType = "normal" | "warmup" | "dropset" | "failure";

export type GymSet = {
  id: string;
  sessionId: string;
  exerciseId: string;
  setIndex: number;
  weight: number;
  reps: number;
  setType: SetType;
  completed: boolean;
  notes?: string;
};

export type Exercise = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: string;
};

export type Template = {
  id: string;
  name: string;
};

export type TemplateExercise = {
  templateId: string;
  exerciseId: string;
  order: number;
};

export type GymSession = {
  id: string;
  templateId: string | null;
  templateName: string;
  dateKey: string;
  startedAt: number;
  endedAt: number | null;
  prCount?: number;
};

export type PersonalRecord = {
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
};

export type RestTimerState = {
  active: boolean;
  remaining: number;
  duration: number;
};

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "legs",
  "core",
  "glutes",
  "calves",
  "forearms",
  "full_body",
  "cardio",
];

export const EQUIPMENT_LIST = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "band",
  "kettlebell",
  "smith_machine",
] as const;
