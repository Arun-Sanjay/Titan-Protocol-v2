import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types (re-exported via lib/gym-helpers.ts) ─────────────────────────────

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
  id: number;
  sessionId: number;
  exerciseId: number;
  setIndex: number;
  weight: number;
  reps: number;
  setType: SetType;
  completed: boolean;
  notes?: string;
};

export type Exercise = {
  id: number;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: string;
};

export type Template = {
  id: number;
  name: string;
};

export type TemplateExercise = {
  templateId: number;
  exerciseId: number;
  order: number;
};

export type GymSession = {
  id: number;
  templateId: number;
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

// ─── Constants (re-exported via lib/gym-helpers.ts) ─────────────────────────

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

// ─── Store ──────────────────────────────────────────────────────────────────

type GymState = {
  exercises: Exercise[];
  templates: Template[];
  templateExercises: TemplateExercise[];
  sessions: GymSession[];
  sets: GymSet[];
  activeSessionId: number | null;
  personalRecords: Record<number, PersonalRecord>;
  restTimer: RestTimerState;

  load: () => void;
  addExercise: (name: string, muscleGroup: MuscleGroup, equipment: string) => number;
  createTemplate: (name: string, exerciseIds: number[]) => void;
  deleteTemplate: (id: number) => void;
  startSession: (templateId: number, dateKey: string) => number;
  endSession: (sessionId: number) => void;
  cancelSession: () => void;
  addSet: (sessionId: number, exerciseId: number, weight: number, reps: number, setType: SetType) => void;
  updateSet: (setId: number, fields: Partial<Pick<GymSet, "weight" | "reps" | "setType" | "notes">>) => void;
  completeSet: (setId: number) => boolean;
  removeSet: (setId: number) => void;
  getSessionSets: (sessionId: number) => GymSet[];
  getTemplateExercises: (templateId: number) => Exercise[];
  getPreviousSets: (templateId: number, exerciseId: number) => GymSet[];
  startRestTimer: (seconds: number) => void;
  tickRestTimer: () => void;
  cancelRestTimer: () => void;
  getTotalWorkouts: () => number;
  getWeekWorkouts: () => number;
  getTotalVolume: () => number;
  getCurrentStreak: () => number;
};

let nextSetId = Date.now();

export const useGymStore = create<GymState>((set, get) => ({
  exercises: getJSON<Exercise[]>("gym_exercises", []),
  templates: getJSON<Template[]>("gym_templates", []),
  templateExercises: getJSON<TemplateExercise[]>("gym_template_exercises", []),
  sessions: getJSON<GymSession[]>("gym_sessions", []),
  sets: getJSON<GymSet[]>("gym_sets", []),
  activeSessionId: null,
  personalRecords: getJSON<Record<number, PersonalRecord>>("gym_prs", {}),
  restTimer: { active: false, remaining: 0, duration: 0 },

  load: () => {
    set({
      exercises: getJSON<Exercise[]>("gym_exercises", []),
      templates: getJSON<Template[]>("gym_templates", []),
      templateExercises: getJSON<TemplateExercise[]>("gym_template_exercises", []),
      sessions: getJSON<GymSession[]>("gym_sessions", []),
      sets: getJSON<GymSet[]>("gym_sets", []),
      personalRecords: getJSON<Record<number, PersonalRecord>>("gym_prs", {}),
    });
  },

  addExercise: (name, muscleGroup, equipment) => {
    const id = Date.now();
    const exercise: Exercise = { id, name, muscleGroup, equipment };
    set((s) => {
      const exercises = [...s.exercises, exercise];
      setJSON("gym_exercises", exercises);
      return { exercises };
    });
    return id;
  },

  createTemplate: (name, exerciseIds) => {
    const id = Date.now();
    set((s) => {
      const templates = [...s.templates, { id, name }];
      const newTEs = exerciseIds.map((exId, i) => ({
        templateId: id,
        exerciseId: exId,
        order: i,
      }));
      const templateExercises = [...s.templateExercises, ...newTEs];
      setJSON("gym_templates", templates);
      setJSON("gym_template_exercises", templateExercises);
      return { templates, templateExercises };
    });
  },

  deleteTemplate: (id) => {
    set((s) => {
      const templates = s.templates.filter((t) => t.id !== id);
      const templateExercises = s.templateExercises.filter((te) => te.templateId !== id);
      setJSON("gym_templates", templates);
      setJSON("gym_template_exercises", templateExercises);
      return { templates, templateExercises };
    });
  },

  startSession: (templateId, dateKey) => {
    const id = Date.now();
    const template = get().templates.find((t) => t.id === templateId);
    const session: GymSession = {
      id,
      templateId,
      templateName: template?.name ?? "Workout",
      dateKey,
      startedAt: Date.now(),
      endedAt: null,
    };
    set((s) => {
      const sessions = [...s.sessions, session];
      setJSON("gym_sessions", sessions);
      return { sessions, activeSessionId: id };
    });
    return id;
  },

  endSession: (sessionId) => {
    set((s) => {
      const sessions = s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, endedAt: Date.now() } : sess,
      );
      setJSON("gym_sessions", sessions);
      return { sessions, activeSessionId: null };
    });
  },

  cancelSession: () => {
    const activeId = get().activeSessionId;
    if (activeId === null) return;
    set((s) => {
      const sessions = s.sessions.filter((sess) => sess.id !== activeId);
      const sets = s.sets.filter((gs) => gs.sessionId !== activeId);
      setJSON("gym_sessions", sessions);
      setJSON("gym_sets", sets);
      return { sessions, sets, activeSessionId: null };
    });
  },

  addSet: (sessionId, exerciseId, weight, reps, setType) => {
    const id = ++nextSetId;
    const existing = get().sets.filter(
      (gs) => gs.sessionId === sessionId && gs.exerciseId === exerciseId,
    );
    const setIndex = existing.length + 1;
    const gymSet: GymSet = {
      id,
      sessionId,
      exerciseId,
      setIndex,
      weight,
      reps,
      setType,
      completed: false,
    };
    set((s) => {
      const sets = [...s.sets, gymSet];
      setJSON("gym_sets", sets);
      return { sets };
    });
  },

  updateSet: (setId, fields) => {
    set((s) => {
      const sets = s.sets.map((gs) =>
        gs.id === setId ? { ...gs, ...fields } : gs,
      );
      setJSON("gym_sets", sets);
      return { sets };
    });
  },

  completeSet: (setId) => {
    let isPR = false;
    set((s) => {
      const sets = s.sets.map((gs) =>
        gs.id === setId ? { ...gs, completed: !gs.completed } : gs,
      );
      setJSON("gym_sets", sets);
      return { sets };
    });
    return isPR;
  },

  removeSet: (setId) => {
    set((s) => {
      const sets = s.sets.filter((gs) => gs.id !== setId);
      setJSON("gym_sets", sets);
      return { sets };
    });
  },

  getSessionSets: (sessionId) => {
    return get().sets.filter((gs) => gs.sessionId === sessionId);
  },

  getTemplateExercises: (templateId) => {
    const state = get();
    const tes = state.templateExercises
      .filter((te) => te.templateId === templateId)
      .sort((a, b) => a.order - b.order);
    return tes
      .map((te) => state.exercises.find((e) => e.id === te.exerciseId))
      .filter((e): e is Exercise => e !== undefined);
  },

  getPreviousSets: (templateId, exerciseId) => {
    const state = get();
    const previousSessions = state.sessions
      .filter((s_) => s_.templateId === templateId && s_.endedAt !== null)
      .sort((a, b) => b.startedAt - a.startedAt);
    if (previousSessions.length === 0) return [];
    const lastSession = previousSessions[0];
    return state.sets
      .filter(
        (gs) =>
          gs.sessionId === lastSession.id &&
          gs.exerciseId === exerciseId &&
          gs.completed,
      )
      .sort((a, b) => a.setIndex - b.setIndex);
  },

  startRestTimer: (seconds) => {
    set({ restTimer: { active: true, remaining: seconds, duration: seconds } });
  },

  tickRestTimer: () => {
    set((s) => {
      if (!s.restTimer.active) return s;
      const remaining = Math.max(0, s.restTimer.remaining - 1);
      return {
        restTimer: {
          ...s.restTimer,
          remaining,
          active: remaining > 0,
        },
      };
    });
  },

  cancelRestTimer: () => {
    set({ restTimer: { active: false, remaining: 0, duration: 0 } });
  },

  getTotalWorkouts: () => {
    return get().sessions.filter((s_) => s_.endedAt !== null).length;
  },

  getWeekWorkouts: () => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    return get().sessions.filter(
      (s_) => s_.endedAt !== null && s_.startedAt >= weekAgo,
    ).length;
  },

  getTotalVolume: () => {
    return get()
      .sets.filter((gs) => gs.completed)
      .reduce((sum, gs) => sum + gs.weight * gs.reps, 0);
  },

  getCurrentStreak: () => {
    // Simplified streak: count consecutive days from today with completed sessions
    return 0;
  },
}));
