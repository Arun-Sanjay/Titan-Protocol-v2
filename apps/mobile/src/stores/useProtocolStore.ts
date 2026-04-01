import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { IdentityArchetype } from "./useModeStore";
import { getTodayKey, addDays } from "../lib/date";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProtocolPhase = "intention" | "mind_check" | "engine_pulse" | "habit_confirm" | "score";

export const PROTOCOL_PHASES: ProtocolPhase[] = [
  "intention",
  "mind_check",
  "engine_pulse",
  "habit_confirm",
  "score",
];

const PHASE_LABELS: Record<ProtocolPhase, string> = {
  intention: "INTENTION",
  mind_check: "MIND CHECK",
  engine_pulse: "ENGINE PULSE",
  habit_confirm: "HABIT CONFIRM",
  score: "SCORE",
};

export function selectPhaseLabel(phase: ProtocolPhase): string {
  return PHASE_LABELS[phase] ?? phase.toUpperCase();
}

export type PhaseResult = {
  phase: ProtocolPhase;
  completed: boolean;
  data?: unknown;
};

export type ProtocolSession = {
  dateKey: string;
  completedAt: number;
  intention: string;
  habitChecks: Record<number, boolean>; // habitId → completed during protocol
  titanScore: number; // score at the time of completion
  identityVote: IdentityArchetype | null;
};

const SESSIONS_KEY = "protocol_sessions";
const STREAK_KEY = "protocol_streak";
const STREAK_DATE_KEY = "protocol_streak_date";

// ─── Morning / Evening MMKV keys ─────────────────────────────────────────────

function morningKey(dateKey: string) {
  return `morning_${dateKey}`;
}
function eveningKey(dateKey: string) {
  return `evening_${dateKey}`;
}

export type MorningData = {
  intention: string;
  completedAt: number;
};

export type EveningData = {
  reflection: string;
  identityVote: IdentityArchetype | null;
  titanScore: number;
  completedAt: number;
};

// ─── Store ────────────────────────────────────────────────────────────────────

type ProtocolState = {
  sessions: Record<string, ProtocolSession>; // dateKey → session
  // v2 protocol flow state
  isActive: boolean;
  startedAt: string | null;
  currentPhase: ProtocolPhase | null;
  phaseResults: PhaseResult[];
  // Streak
  streakCurrent: number;
  streakLastDate: string | null;
  todayCompleted: boolean;

  // Morning / Evening split
  morningCompleted: boolean;
  eveningCompleted: boolean;
  morningIntention: string;
  morningReflection: string;

  load: () => void;
  isCompletedToday: (dateKey: string) => boolean;
  completeSession: (session: ProtocolSession) => void;
  getSession: (dateKey: string) => ProtocolSession | null;

  // v2 protocol methods
  completePhase: (phase: ProtocolPhase, data?: unknown) => void;
  finishProtocol: (score: number) => void;
  checkTodayStatus: () => void;
  resetDaily: () => void;

  // Morning / Evening methods
  completeMorning: (intention: string) => void;
  completeEvening: (reflection: string, identityVote: IdentityArchetype | null, titanScore: number) => void;
  isMorningDone: (dateKey: string) => boolean;
  isEveningDone: (dateKey: string) => boolean;
};

export const useProtocolStore = create<ProtocolState>()((set, get) => ({
  sessions: getJSON<Record<string, ProtocolSession>>(SESSIONS_KEY, {}),
  isActive: false,
  startedAt: null,
  currentPhase: null,
  phaseResults: [],
  streakCurrent: getJSON<number>(STREAK_KEY, 0),
  streakLastDate: getJSON<string | null>(STREAK_DATE_KEY, null),
  todayCompleted: false,

  // Morning / Evening defaults
  morningCompleted: false,
  eveningCompleted: false,
  morningIntention: "",
  morningReflection: "",

  load: () => {
    const sessions = getJSON<Record<string, ProtocolSession>>(SESSIONS_KEY, {});
    const streakCurrent = getJSON<number>(STREAK_KEY, 0);
    const streakLastDate = getJSON<string | null>(STREAK_DATE_KEY, null);
    const today = getTodayKey();

    // Hydrate morning / evening status from MMKV
    const mData = getJSON<MorningData | null>(morningKey(today), null);
    const eData = getJSON<EveningData | null>(eveningKey(today), null);

    set({
      sessions,
      streakCurrent,
      streakLastDate,
      todayCompleted: !!sessions[today],
      morningCompleted: !!mData,
      eveningCompleted: !!eData,
      morningIntention: mData?.intention ?? "",
      morningReflection: eData?.reflection ?? "",
    });
  },

  isCompletedToday: (dateKey) => {
    return !!get().sessions[dateKey];
  },

  completeSession: (session) => {
    const sessions = { ...get().sessions, [session.dateKey]: session };
    setJSON(SESSIONS_KEY, sessions);
    set({ sessions });
  },

  getSession: (dateKey) => {
    return get().sessions[dateKey] ?? null;
  },

  completePhase: (phase, data) => {
    const result: PhaseResult = { phase, completed: true, data };
    const phaseResults = [...get().phaseResults, result];

    // Advance to next phase
    const currentIdx = PROTOCOL_PHASES.indexOf(phase);
    const nextPhase = currentIdx < PROTOCOL_PHASES.length - 1
      ? PROTOCOL_PHASES[currentIdx + 1]
      : null;

    set({
      phaseResults,
      currentPhase: nextPhase,
      isActive: true,
      startedAt: get().startedAt ?? getTodayKey(),
    });
  },

  finishProtocol: (score) => {
    const today = getTodayKey();
    const { streakCurrent, streakLastDate, sessions } = get();

    // Calculate new streak
    let newStreak = 1;
    if (streakLastDate) {
      if (streakLastDate === today) {
        newStreak = streakCurrent; // Already counted today
      } else {
        const yesterday = addDays(today, -1);
        newStreak = streakLastDate === yesterday ? streakCurrent + 1 : 1;
      }
    }

    // Persist streak
    setJSON(STREAK_KEY, newStreak);
    setJSON(STREAK_DATE_KEY, today);

    // Record completion
    const session: ProtocolSession = {
      dateKey: today,
      completedAt: Date.now(),
      intention: "",
      habitChecks: {},
      titanScore: score,
      identityVote: null,
    };
    const updatedSessions = { ...sessions, [today]: session };
    setJSON(SESSIONS_KEY, updatedSessions);

    // Also persist to per-day key for legacy checks
    setJSON(`protocol_completions:${today}`, { completed: true, score });

    set({
      sessions: updatedSessions,
      streakCurrent: newStreak,
      streakLastDate: today,
      todayCompleted: true,
      isActive: false,
      startedAt: null,
      currentPhase: null,
      phaseResults: [],
    });
  },

  checkTodayStatus: () => {
    const today = getTodayKey();
    const sessions = get().sessions;
    set({ todayCompleted: !!sessions[today] });
  },

  resetDaily: () => {
    set({
      isActive: false,
      startedAt: null,
      currentPhase: null,
      phaseResults: [],
    });
  },

  // ─── Morning / Evening ────────────────────────────────────────────────────

  completeMorning: (intention: string) => {
    const today = getTodayKey();
    const data: MorningData = { intention, completedAt: Date.now() };
    setJSON(morningKey(today), data);
    set({ morningCompleted: true, morningIntention: intention });
  },

  completeEvening: (reflection: string, identityVote: IdentityArchetype | null, titanScore: number) => {
    const today = getTodayKey();
    const data: EveningData = { reflection, identityVote, titanScore, completedAt: Date.now() };
    setJSON(eveningKey(today), data);
    set({ eveningCompleted: true, morningReflection: reflection });

    // Backward compat: also record a full ProtocolSession via completeSession logic
    const { sessions, streakCurrent, streakLastDate } = get();

    // Calculate new streak
    let newStreak = 1;
    if (streakLastDate) {
      if (streakLastDate === today) {
        newStreak = streakCurrent;
      } else {
        const yesterday = addDays(today, -1);
        newStreak = streakLastDate === yesterday ? streakCurrent + 1 : 1;
      }
    }

    setJSON(STREAK_KEY, newStreak);
    setJSON(STREAK_DATE_KEY, today);

    const session: ProtocolSession = {
      dateKey: today,
      completedAt: Date.now(),
      intention: get().morningIntention,
      habitChecks: {},
      titanScore,
      identityVote,
    };
    const updatedSessions = { ...sessions, [today]: session };
    setJSON(SESSIONS_KEY, updatedSessions);
    setJSON(`protocol_completions:${today}`, { completed: true, score: titanScore });

    set({
      sessions: updatedSessions,
      streakCurrent: newStreak,
      streakLastDate: today,
      todayCompleted: true,
      isActive: false,
      startedAt: null,
      currentPhase: null,
      phaseResults: [],
    });
  },

  isMorningDone: (dateKey: string) => {
    return !!getJSON<MorningData | null>(morningKey(dateKey), null);
  },

  isEveningDone: (dateKey: string) => {
    return !!getJSON<EveningData | null>(eveningKey(dateKey), null);
  },
}));
