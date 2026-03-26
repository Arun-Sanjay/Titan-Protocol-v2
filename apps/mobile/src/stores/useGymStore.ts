import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";

// ─── Types ──────────────────────────────────────────────────────────────────

export type Exercise = {
  id: number;
  name: string;
  muscleGroup: string;
  equipment: string;
};

export type Template = {
  id: number;
  name: string;
  createdAt: number;
};

export type TemplateExercise = {
  id: number;
  templateId: number;
  exerciseId: number;
  order: number;
};

export type GymSession = {
  id: number;
  dateKey: string;
  templateId: number;
  startedAt: number;
  endedAt: number | null;
};

export type GymSet = {
  id: number;
  sessionId: number;
  exerciseId: number;
  setIndex: number;
  weight: number;
  reps: number;
};

// ─── MMKV keys ──────────────────────────────────────────────────────────────

const EXERCISES_KEY = "gym_exercises";
const TEMPLATES_KEY = "gym_templates";
const TEMPLATE_EXERCISES_KEY = "gym_template_exercises";
const SESSIONS_KEY = "gym_sessions";
const SETS_KEY = "gym_sets";

// ─── Default exercises ──────────────────────────────────────────────────────

const DEFAULT_EXERCISES: Omit<Exercise, "id">[] = [
  { name: "Bench Press", muscleGroup: "Chest", equipment: "Barbell" },
  { name: "Squat", muscleGroup: "Legs", equipment: "Barbell" },
  { name: "Deadlift", muscleGroup: "Back", equipment: "Barbell" },
  { name: "Overhead Press", muscleGroup: "Shoulders", equipment: "Barbell" },
  { name: "Barbell Row", muscleGroup: "Back", equipment: "Barbell" },
  { name: "Pull Up", muscleGroup: "Back", equipment: "Bodyweight" },
  { name: "Dips", muscleGroup: "Chest", equipment: "Bodyweight" },
  { name: "Bicep Curl", muscleGroup: "Arms", equipment: "Dumbbell" },
  { name: "Tricep Extension", muscleGroup: "Arms", equipment: "Cable" },
  { name: "Leg Press", muscleGroup: "Legs", equipment: "Machine" },
  { name: "Lat Pulldown", muscleGroup: "Back", equipment: "Cable" },
  { name: "Lunges", muscleGroup: "Legs", equipment: "Dumbbell" },
  { name: "Plank", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Cable Fly", muscleGroup: "Chest", equipment: "Cable" },
  { name: "Leg Curl", muscleGroup: "Legs", equipment: "Machine" },
];

// ─── Store ──────────────────────────────────────────────────────────────────

type GymState = {
  exercises: Exercise[];
  templates: Template[];
  templateExercises: TemplateExercise[];
  sessions: GymSession[];
  sets: GymSet[];
  activeSessionId: number | null;

  load: () => void;
  addExercise: (name: string, muscleGroup: string, equipment: string) => number;
  createTemplate: (name: string, exerciseIds: number[]) => number;
  startSession: (templateId: number, dateKey: string) => number;
  addSet: (sessionId: number, exerciseId: number, weight: number, reps: number) => void;
  endSession: (sessionId: number) => void;
  getSessionSets: (sessionId: number) => GymSet[];
  getTemplateExercises: (templateId: number) => Exercise[];
  deleteTemplate: (id: number) => void;
};

export const useGymStore = create<GymState>()((set, get) => ({
  exercises: [],
  templates: [],
  templateExercises: [],
  sessions: [],
  sets: [],
  activeSessionId: null,

  load: () => {
    let exercises = getJSON<Exercise[]>(EXERCISES_KEY, []);

    // Seed defaults on first load
    if (exercises.length === 0) {
      exercises = DEFAULT_EXERCISES.map((e) => ({ ...e, id: nextId() }));
      setJSON(EXERCISES_KEY, exercises);
    }

    const templates = getJSON<Template[]>(TEMPLATES_KEY, []);
    const templateExercises = getJSON<TemplateExercise[]>(TEMPLATE_EXERCISES_KEY, []);
    const sessions = getJSON<GymSession[]>(SESSIONS_KEY, []);
    const sets = getJSON<GymSet[]>(SETS_KEY, []);

    // Restore active session (one that hasn't ended)
    const active = sessions.find((s) => s.endedAt === null);

    set({
      exercises,
      templates,
      templateExercises,
      sessions,
      sets,
      activeSessionId: active?.id ?? null,
    });
  },

  addExercise: (name, muscleGroup, equipment) => {
    const id = nextId();
    const exercise: Exercise = { id, name, muscleGroup, equipment };
    const exercises = [...get().exercises, exercise];
    setJSON(EXERCISES_KEY, exercises);
    set({ exercises });
    return id;
  },

  createTemplate: (name, exerciseIds) => {
    const id = nextId();
    const template: Template = { id, name, createdAt: Date.now() };
    const templates = [...get().templates, template];
    setJSON(TEMPLATES_KEY, templates);

    const newLinks: TemplateExercise[] = exerciseIds.map((exerciseId, i) => ({
      id: nextId(),
      templateId: id,
      exerciseId,
      order: i,
    }));
    const templateExercises = [...get().templateExercises, ...newLinks];
    setJSON(TEMPLATE_EXERCISES_KEY, templateExercises);

    set({ templates, templateExercises });
    return id;
  },

  startSession: (templateId, dateKey) => {
    const id = nextId();
    const session: GymSession = {
      id,
      dateKey,
      templateId,
      startedAt: Date.now(),
      endedAt: null,
    };
    const sessions = [...get().sessions, session];
    setJSON(SESSIONS_KEY, sessions);
    set({ sessions, activeSessionId: id });
    return id;
  },

  addSet: (sessionId, exerciseId, weight, reps) => {
    const existingSets = get().sets.filter(
      (s) => s.sessionId === sessionId && s.exerciseId === exerciseId
    );
    const setIndex = existingSets.length + 1;

    const newSet: GymSet = {
      id: nextId(),
      sessionId,
      exerciseId,
      setIndex,
      weight,
      reps,
    };
    const sets = [...get().sets, newSet];
    setJSON(SETS_KEY, sets);
    set({ sets });
  },

  endSession: (sessionId) => {
    const sessions = get().sessions.map((s) =>
      s.id === sessionId ? { ...s, endedAt: Date.now() } : s
    );
    setJSON(SESSIONS_KEY, sessions);
    set({ sessions, activeSessionId: null });
  },

  getSessionSets: (sessionId) => {
    return get().sets.filter((s) => s.sessionId === sessionId);
  },

  getTemplateExercises: (templateId) => {
    const links = get()
      .templateExercises.filter((te) => te.templateId === templateId)
      .sort((a, b) => a.order - b.order);
    const exerciseMap = new Map(get().exercises.map((e) => [e.id, e]));
    return links.map((l) => exerciseMap.get(l.exerciseId)).filter(Boolean) as Exercise[];
  },

  deleteTemplate: (id) => {
    const templates = get().templates.filter((t) => t.id !== id);
    const templateExercises = get().templateExercises.filter((te) => te.templateId !== id);
    setJSON(TEMPLATES_KEY, templates);
    setJSON(TEMPLATE_EXERCISES_KEY, templateExercises);
    set({ templates, templateExercises });
  },
}));
