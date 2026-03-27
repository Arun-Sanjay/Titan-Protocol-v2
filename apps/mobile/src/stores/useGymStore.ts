import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";

// ─── Types ──────────────────────────────────────────────────────────────────

export type MuscleGroup =
  | "Chest"
  | "Back"
  | "Shoulders"
  | "Arms"
  | "Legs"
  | "Core"
  | "Cardio";

export type Exercise = {
  id: number;
  name: string;
  muscleGroup: MuscleGroup;
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
  templateName: string;
  startedAt: number;
  endedAt: number | null;
  prCount: number;
};

export type SetType = "normal" | "warmup" | "dropset" | "failure";

export type GymSet = {
  id: number;
  sessionId: number;
  exerciseId: number;
  setIndex: number;
  weight: number;
  reps: number;
  completed: boolean;
  setType: SetType;
  notes: string;
};

export type PersonalRecord = {
  weight: number;
  reps: number;
  volume: number;
  date: string;
};

export type RestTimerState = {
  active: boolean;
  remaining: number;
  duration: number;
};

export type ExerciseHistoryEntry = {
  sessionId: number;
  dateKey: string;
  templateName: string;
  sets: GymSet[];
};

// ─── Clamping helpers ────────────────────────────────────────────────────────

function clampWeight(w: number): number {
  if (isNaN(w) || w < 0) return 0;
  return Math.min(w, 2000);
}

function clampReps(r: number): number {
  if (isNaN(r) || r < 0) return 0;
  return Math.min(Math.floor(r), 1000);
}

// ─── MMKV keys ──────────────────────────────────────────────────────────────

const EXERCISES_KEY = "gym_exercises";
const TEMPLATES_KEY = "gym_templates";
const TEMPLATE_EXERCISES_KEY = "gym_template_exercises";
const SESSIONS_KEY = "gym_sessions";
const SETS_KEY = "gym_sets";
const PRS_KEY = "gym_prs";

// ─── Default exercises ──────────────────────────────────────────────────────

const DEFAULT_EXERCISES: Omit<Exercise, "id">[] = [
  // Chest
  { name: "Bench Press", muscleGroup: "Chest", equipment: "Barbell" },
  { name: "Incline Bench Press", muscleGroup: "Chest", equipment: "Barbell" },
  { name: "Dumbbell Bench Press", muscleGroup: "Chest", equipment: "Dumbbell" },
  { name: "Cable Fly", muscleGroup: "Chest", equipment: "Cable" },
  { name: "Dips", muscleGroup: "Chest", equipment: "Bodyweight" },
  { name: "Push Ups", muscleGroup: "Chest", equipment: "Bodyweight" },
  // Back
  { name: "Deadlift", muscleGroup: "Back", equipment: "Barbell" },
  { name: "Barbell Row", muscleGroup: "Back", equipment: "Barbell" },
  { name: "Pull Up", muscleGroup: "Back", equipment: "Bodyweight" },
  { name: "Lat Pulldown", muscleGroup: "Back", equipment: "Cable" },
  { name: "Seated Row", muscleGroup: "Back", equipment: "Cable" },
  { name: "T-Bar Row", muscleGroup: "Back", equipment: "Barbell" },
  // Shoulders
  { name: "Overhead Press", muscleGroup: "Shoulders", equipment: "Barbell" },
  { name: "Dumbbell Shoulder Press", muscleGroup: "Shoulders", equipment: "Dumbbell" },
  { name: "Lateral Raise", muscleGroup: "Shoulders", equipment: "Dumbbell" },
  { name: "Face Pull", muscleGroup: "Shoulders", equipment: "Cable" },
  { name: "Front Raise", muscleGroup: "Shoulders", equipment: "Dumbbell" },
  // Arms
  { name: "Bicep Curl", muscleGroup: "Arms", equipment: "Dumbbell" },
  { name: "Hammer Curl", muscleGroup: "Arms", equipment: "Dumbbell" },
  { name: "Barbell Curl", muscleGroup: "Arms", equipment: "Barbell" },
  { name: "Tricep Extension", muscleGroup: "Arms", equipment: "Cable" },
  { name: "Skull Crusher", muscleGroup: "Arms", equipment: "Barbell" },
  { name: "Tricep Dips", muscleGroup: "Arms", equipment: "Bodyweight" },
  // Legs
  { name: "Squat", muscleGroup: "Legs", equipment: "Barbell" },
  { name: "Leg Press", muscleGroup: "Legs", equipment: "Machine" },
  { name: "Romanian Deadlift", muscleGroup: "Legs", equipment: "Barbell" },
  { name: "Lunges", muscleGroup: "Legs", equipment: "Dumbbell" },
  { name: "Leg Curl", muscleGroup: "Legs", equipment: "Machine" },
  { name: "Leg Extension", muscleGroup: "Legs", equipment: "Machine" },
  { name: "Calf Raise", muscleGroup: "Legs", equipment: "Machine" },
  // Core
  { name: "Plank", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Cable Crunch", muscleGroup: "Core", equipment: "Cable" },
  { name: "Hanging Leg Raise", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Ab Wheel Rollout", muscleGroup: "Core", equipment: "Bodyweight" },
  // Cardio
  { name: "Treadmill Run", muscleGroup: "Cardio", equipment: "Machine" },
  { name: "Cycling", muscleGroup: "Cardio", equipment: "Machine" },
  { name: "Rowing Machine", muscleGroup: "Cardio", equipment: "Machine" },
  { name: "Jump Rope", muscleGroup: "Cardio", equipment: "Bodyweight" },
];

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Legs",
  "Core",
  "Cardio",
];

export const EQUIPMENT_LIST = [
  "Barbell",
  "Dumbbell",
  "Cable",
  "Machine",
  "Bodyweight",
];

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
  sessionPRCount: number;

  // Lifecycle
  load: () => void;

  // Exercises
  addExercise: (name: string, muscleGroup: MuscleGroup, equipment: string) => number;

  // Templates
  createTemplate: (name: string, exerciseIds: number[]) => number;
  deleteTemplate: (id: number) => void;

  // Sessions
  startSession: (templateId: number, dateKey: string) => number;
  endSession: (sessionId: number) => void;
  cancelSession: () => void;

  // Sets
  addSet: (
    sessionId: number,
    exerciseId: number,
    weight: number,
    reps: number,
    setType?: SetType,
  ) => number;
  updateSet: (
    setId: number,
    fields: Partial<Pick<GymSet, "weight" | "reps" | "completed" | "setType" | "notes">>,
  ) => void;
  completeSet: (setId: number) => boolean; // returns true if new PR
  removeSet: (setId: number) => void;

  // Queries
  getSessionSets: (sessionId: number) => GymSet[];
  getTemplateExercises: (templateId: number) => Exercise[];
  getExerciseHistory: (exerciseId: number) => ExerciseHistoryEntry[];
  getPreviousSets: (templateId: number | null, exerciseId: number) => GymSet[];

  // Personal Records
  checkAndUpdatePR: (
    exerciseId: number,
    weight: number,
    reps: number,
    date: string,
  ) => boolean;

  // Rest Timer
  startRestTimer: (duration: number) => void;
  tickRestTimer: () => void;
  cancelRestTimer: () => void;

  // Stats
  getTotalWorkouts: () => number;
  getWeekWorkouts: () => number;
  getTotalVolume: () => number;
  getCurrentStreak: () => number;
};

export const useGymStore = create<GymState>()((set, get) => ({
  exercises: [],
  templates: [],
  templateExercises: [],
  sessions: [],
  sets: [],
  activeSessionId: null,
  personalRecords: {},
  restTimer: { active: false, remaining: 0, duration: 0 },
  sessionPRCount: 0,

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  load: () => {
    let exercises = getJSON<Exercise[]>(EXERCISES_KEY, []);

    // Seed defaults on first load
    if (exercises.length === 0) {
      exercises = DEFAULT_EXERCISES.map((e) => ({ ...e, id: nextId() })) as Exercise[];
      setJSON(EXERCISES_KEY, exercises);
    }

    const templates = getJSON<Template[]>(TEMPLATES_KEY, []);
    const templateExercises = getJSON<TemplateExercise[]>(TEMPLATE_EXERCISES_KEY, []);
    const sessions = getJSON<GymSession[]>(SESSIONS_KEY, []);
    const sets = getJSON<GymSet[]>(SETS_KEY, []);
    const personalRecords = getJSON<Record<number, PersonalRecord>>(PRS_KEY, {});

    // Migrate old sessions that don't have prCount
    let sessionsMigrated = false;
    const migratedSessions = sessions.map((s) => {
      if (s.prCount === undefined) {
        sessionsMigrated = true;
        return { ...s, prCount: 0 };
      }
      return s;
    });
    if (sessionsMigrated) {
      setJSON(SESSIONS_KEY, migratedSessions);
    }

    // Migrate old sets that don't have the new fields
    let migrated = false;
    const migratedSets = sets.map((s) => {
      if (s.completed === undefined || s.setType === undefined || s.notes === undefined) {
        migrated = true;
        return {
          ...s,
          completed: s.completed ?? true,
          setType: s.setType ?? ("normal" as SetType),
          notes: s.notes ?? "",
        };
      }
      return s;
    });
    if (migrated) {
      setJSON(SETS_KEY, migratedSets);
    }

    // Restore active session
    const active = [...migratedSessions].reverse().find((s) => s.endedAt === null);

    set({
      exercises,
      templates,
      templateExercises,
      sessions: migratedSessions,
      sets: migratedSets,
      activeSessionId: active?.id ?? null,
      personalRecords,
    });
  },

  // ─── Exercises ──────────────────────────────────────────────────────────

  addExercise: (name, muscleGroup, equipment) => {
    const id = nextId();
    const exercise: Exercise = { id, name, muscleGroup, equipment };
    const exercises = [...get().exercises, exercise];
    setJSON(EXERCISES_KEY, exercises);
    set({ exercises });
    return id;
  },

  // ─── Templates ──────────────────────────────────────────────────────────

  createTemplate: (name, exerciseIds) => {
    if (!name.trim()) return -1;
    if (exerciseIds.length === 0) return -1;

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

  deleteTemplate: (id) => {
    const templates = get().templates.filter((t) => t.id !== id);
    const templateExercises = get().templateExercises.filter(
      (te) => te.templateId !== id,
    );
    setJSON(TEMPLATES_KEY, templates);
    setJSON(TEMPLATE_EXERCISES_KEY, templateExercises);
    set({ templates, templateExercises });
  },

  // ─── Sessions ───────────────────────────────────────────────────────────

  startSession: (templateId, dateKey) => {
    const state = get();

    // Guard against orphaned sessions
    if (state.activeSessionId !== null) {
      const sessions = state.sessions.map((s) =>
        s.id === state.activeSessionId ? { ...s, endedAt: Date.now() } : s,
      );
      setJSON(SESSIONS_KEY, sessions);
      set({ sessions });
    }

    const template = get().templates.find((t) => t.id === templateId);
    const templateName = template?.name ?? "Workout";

    const id = nextId();
    const session: GymSession = {
      id,
      dateKey,
      templateId,
      templateName,
      startedAt: Date.now(),
      endedAt: null,
      prCount: 0,
    };
    const sessions = [...get().sessions, session];
    setJSON(SESSIONS_KEY, sessions);
    set({
      sessions,
      activeSessionId: id,
      restTimer: { active: false, remaining: 0, duration: 0 },
      sessionPRCount: 0,
    });
    return id;
  },

  endSession: (sessionId) => {
    const prCount = get().sessionPRCount;
    const sessions = get().sessions.map((s) =>
      s.id === sessionId ? { ...s, endedAt: Date.now(), prCount } : s,
    );
    setJSON(SESSIONS_KEY, sessions);
    set({
      sessions,
      activeSessionId: null,
      restTimer: { active: false, remaining: 0, duration: 0 },
      sessionPRCount: 0,
    });
  },

  cancelSession: () => {
    const state = get();
    const sessionId = state.activeSessionId;
    if (sessionId === null) return;

    // Identify exercises that had sets in this session
    const canceledSets = state.sets.filter((s) => s.sessionId === sessionId);
    const affectedExerciseIds = [...new Set(canceledSets.map((s) => s.exerciseId))];

    const sessions = state.sessions.filter((s) => s.id !== sessionId);
    const remainingSets = state.sets.filter((s) => s.sessionId !== sessionId);

    // Recompute PRs for affected exercises from remaining completed sets
    const completedSessionIds = new Set(
      sessions.filter((s) => s.endedAt !== null).map((s) => s.id),
    );
    const updatedPRs = { ...state.personalRecords };

    for (const exerciseId of affectedExerciseIds) {
      const exerciseSets = remainingSets.filter(
        (s) =>
          s.exerciseId === exerciseId &&
          s.completed &&
          completedSessionIds.has(s.sessionId),
      );

      if (exerciseSets.length === 0) {
        delete updatedPRs[exerciseId];
        continue;
      }

      // Recalculate PR from remaining sets
      let bestWeight = 0;
      let bestWeightReps = 0;
      let bestVolume = 0;
      let bestVolumeReps = 0;
      let bestDate = "";
      let bestRepsOnly = 0;

      for (const s of exerciseSets) {
        const vol = s.weight * s.reps;
        const session = sessions.find((sess) => sess.id === s.sessionId);
        const date = session?.dateKey ?? "";

        if (s.weight === 0) {
          // Bodyweight: reps-only
          if (s.reps > bestRepsOnly) {
            bestRepsOnly = s.reps;
            bestDate = date;
          }
        } else {
          if (s.weight > bestWeight || (s.weight === bestWeight && s.reps > bestWeightReps)) {
            bestWeight = s.weight;
            bestWeightReps = s.reps;
            bestDate = date;
          }
          if (vol > bestVolume) {
            bestVolume = vol;
            bestVolumeReps = s.reps;
            if (!bestDate) bestDate = date;
          }
        }
      }

      if (bestWeight === 0 && bestRepsOnly > 0) {
        updatedPRs[exerciseId] = {
          weight: 0,
          reps: bestRepsOnly,
          volume: 0,
          date: bestDate,
        };
      } else if (bestWeight > 0) {
        updatedPRs[exerciseId] = {
          weight: bestWeight,
          reps: bestWeightReps,
          volume: bestVolume,
          date: bestDate,
        };
      } else {
        delete updatedPRs[exerciseId];
      }
    }

    setJSON(SESSIONS_KEY, sessions);
    setJSON(SETS_KEY, remainingSets);
    setJSON(PRS_KEY, updatedPRs);
    set({
      sessions,
      sets: remainingSets,
      personalRecords: updatedPRs,
      activeSessionId: null,
      restTimer: { active: false, remaining: 0, duration: 0 },
      sessionPRCount: 0,
    });
  },

  // ─── Sets ───────────────────────────────────────────────────────────────

  addSet: (sessionId, exerciseId, weight, reps, setType = "normal") => {
    const existingSets = get().sets.filter(
      (s) => s.sessionId === sessionId && s.exerciseId === exerciseId,
    );
    const setIndex = existingSets.length + 1;

    const newSet: GymSet = {
      id: nextId(),
      sessionId,
      exerciseId,
      setIndex,
      weight: clampWeight(weight),
      reps: clampReps(reps),
      completed: false,
      setType,
      notes: "",
    };
    const sets = [...get().sets, newSet];
    setJSON(SETS_KEY, sets);
    set({ sets });
    return newSet.id;
  },

  updateSet: (setId, fields) => {
    const sets = get().sets.map((s) => {
      if (s.id !== setId) return s;
      return {
        ...s,
        ...(fields.weight !== undefined ? { weight: clampWeight(fields.weight) } : {}),
        ...(fields.reps !== undefined ? { reps: clampReps(fields.reps) } : {}),
        ...(fields.completed !== undefined ? { completed: fields.completed } : {}),
        ...(fields.setType !== undefined ? { setType: fields.setType } : {}),
        ...(fields.notes !== undefined ? { notes: fields.notes } : {}),
      };
    });
    setJSON(SETS_KEY, sets);
    set({ sets });
  },

  completeSet: (setId) => {
    const state = get();
    const gymSet = state.sets.find((s) => s.id === setId);
    if (!gymSet) return false;

    const wasCompleted = gymSet.completed;

    // Toggle completed
    const sets = state.sets.map((s) =>
      s.id === setId ? { ...s, completed: !s.completed } : s,
    );
    setJSON(SETS_KEY, sets);
    set({ sets });

    // Only check for PR when transitioning from false to true
    if (wasCompleted) return false;

    // Skip PR check for warmup sets
    if (gymSet.setType === "warmup") return false;

    // Check for PR
    const session = state.sessions.find((s) => s.id === gymSet.sessionId);
    const dateKey = session?.dateKey ?? new Date().toISOString().split("T")[0];
    const isPR = get().checkAndUpdatePR(
      gymSet.exerciseId,
      gymSet.weight,
      gymSet.reps,
      dateKey,
    );

    if (isPR) {
      set({ sessionPRCount: get().sessionPRCount + 1 });
    }

    return isPR;
  },

  removeSet: (setId) => {
    const state = get();
    const target = state.sets.find((s) => s.id === setId);
    if (!target) return;

    // Remove the set
    let sets = state.sets.filter((s) => s.id !== setId);

    // Reindex remaining sets for this exercise in this session
    let idx = 1;
    sets = sets.map((s) => {
      if (s.sessionId === target.sessionId && s.exerciseId === target.exerciseId) {
        const updated = { ...s, setIndex: idx };
        idx++;
        return updated;
      }
      return s;
    });

    setJSON(SETS_KEY, sets);
    set({ sets });
  },

  // ─── Queries ────────────────────────────────────────────────────────────

  getSessionSets: (sessionId) => {
    return get().sets.filter((s) => s.sessionId === sessionId);
  },

  getTemplateExercises: (templateId) => {
    const links = get()
      .templateExercises.filter((te) => te.templateId === templateId)
      .sort((a, b) => a.order - b.order);
    const exerciseMap = new Map(get().exercises.map((e) => [e.id, e]));
    return links
      .map((l) => exerciseMap.get(l.exerciseId))
      .filter(Boolean) as Exercise[];
  },

  getExerciseHistory: (exerciseId) => {
    const state = get();
    // Find all completed sessions that have sets for this exercise
    const sessionIds = new Set(
      state.sets
        .filter((s) => s.exerciseId === exerciseId)
        .map((s) => s.sessionId),
    );

    const completedSessions = state.sessions
      .filter((s) => s.endedAt !== null && sessionIds.has(s.id))
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 5);

    return completedSessions.map((session) => ({
      sessionId: session.id,
      dateKey: session.dateKey,
      templateName: session.templateName,
      sets: state.sets
        .filter((s) => s.sessionId === session.id && s.exerciseId === exerciseId)
        .sort((a, b) => a.setIndex - b.setIndex),
    }));
  },

  getPreviousSets: (templateId, exerciseId) => {
    const state = get();
    const activeId = state.activeSessionId;

    // Find the most recent completed session that contains this exercise
    // and matches the given templateId (if provided)
    const sessionIds = new Set(
      state.sets
        .filter((s) => s.exerciseId === exerciseId && s.sessionId !== activeId)
        .map((s) => s.sessionId),
    );

    const lastSession = state.sessions
      .filter(
        (s) =>
          s.endedAt !== null &&
          sessionIds.has(s.id) &&
          (templateId === null || s.templateId === templateId),
      )
      .sort((a, b) => b.startedAt - a.startedAt)[0];

    if (!lastSession) return [];

    return state.sets
      .filter(
        (s) => s.sessionId === lastSession.id && s.exerciseId === exerciseId,
      )
      .sort((a, b) => a.setIndex - b.setIndex);
  },

  // ─── Personal Records ──────────────────────────────────────────────────

  checkAndUpdatePR: (exerciseId, weight, reps, date) => {
    if (reps <= 0) return false;
    // Allow weight === 0 for bodyweight exercises; only reject negative weight
    if (weight < 0) return false;

    const state = get();
    const current = state.personalRecords[exerciseId];

    // Bodyweight exercises (weight === 0): use reps-only comparison
    if (weight === 0) {
      const isNewRepsPR = !current || reps > current.reps;
      if (isNewRepsPR) {
        const updated: Record<number, PersonalRecord> = {
          ...state.personalRecords,
          [exerciseId]: {
            weight: 0,
            reps,
            volume: 0,
            date,
          },
        };
        setJSON(PRS_KEY, updated);
        set({ personalRecords: updated });
        return true;
      }
      return false;
    }

    const volume = weight * reps;

    const isNewWeightPR = !current || weight > current.weight;
    const isNewVolumePR = !current || volume > current.volume;

    if (isNewWeightPR || isNewVolumePR) {
      const updated: Record<number, PersonalRecord> = {
        ...state.personalRecords,
        [exerciseId]: {
          weight: isNewWeightPR ? weight : current!.weight,
          reps: isNewWeightPR ? reps : (isNewVolumePR ? reps : current!.reps),
          volume: isNewVolumePR ? volume : current!.volume,
          date,
        },
      };
      setJSON(PRS_KEY, updated);
      set({ personalRecords: updated });
      return true;
    }

    return false;
  },

  // ─── Rest Timer ─────────────────────────────────────────────────────────

  startRestTimer: (duration) => {
    set({
      restTimer: {
        active: true,
        remaining: duration,
        duration,
      },
    });
  },

  tickRestTimer: () => {
    const timer = get().restTimer;
    if (!timer.active) return;

    const next = timer.remaining - 1;
    if (next <= 0) {
      set({ restTimer: { active: false, remaining: 0, duration: timer.duration } });
    } else {
      set({ restTimer: { ...timer, remaining: next } });
    }
  },

  cancelRestTimer: () => {
    const timer = get().restTimer;
    set({ restTimer: { active: false, remaining: 0, duration: timer.duration } });
  },

  // ─── Stats ──────────────────────────────────────────────────────────────

  getTotalWorkouts: () => {
    return get().sessions.filter((s) => s.endedAt !== null).length;
  },

  getWeekWorkouts: () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    const mondayKey =
      monday.getFullYear() +
      "-" +
      String(monday.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(monday.getDate()).padStart(2, "0");

    return get().sessions.filter(
      (s) => s.endedAt !== null && s.dateKey >= mondayKey,
    ).length;
  },

  getTotalVolume: () => {
    const state = get();
    const completedSessionIds = new Set(
      state.sessions.filter((s) => s.endedAt !== null).map((s) => s.id),
    );
    return state.sets
      .filter((s) => completedSessionIds.has(s.sessionId) && s.completed)
      .reduce((sum, s) => sum + s.weight * s.reps, 0);
  },

  getCurrentStreak: () => {
    const sessions = get()
      .sessions.filter((s) => s.endedAt !== null)
      .sort((a, b) => b.startedAt - a.startedAt);

    if (sessions.length === 0) return 0;

    // Get unique dateKeys in order
    const uniqueDates = [...new Set(sessions.map((s) => s.dateKey))].sort(
      (a, b) => b.localeCompare(a),
    );

    // Check if the streak includes today or yesterday
    const today = new Date();
    const todayKey =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey =
      yesterday.getFullYear() +
      "-" +
      String(yesterday.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(yesterday.getDate()).padStart(2, "0");

    if (uniqueDates[0] !== todayKey && uniqueDates[0] !== yesterdayKey) {
      return 0;
    }

    let streak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i - 1] + "T12:00:00");
      const curr = new Date(uniqueDates[i] + "T12:00:00");
      const diffDays = Math.round(
        (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  },
}));
