import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import { K } from "../db/keys";
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

// Phase 2.2D: all MMKV keys moved to src/db/keys.ts (K registry).
// Local aliases below keep this file readable.
const SESSIONS_KEY = K.protocolSessions;
const STREAK_KEY = K.protocolStreak;
const STREAK_DATE_KEY = K.protocolStreakDate;
const STREAK_PREV_KEY = K.protocolStreakPrevious;

// Phase 2.2A: write-ahead log key. Set before a multi-key protocol write
// begins, cleared after all writes complete. Any stuck pending marker
// detected on app launch indicates an incomplete/crashed write and is
// logged for diagnostics.
const PROTOCOL_WRITE_PENDING_KEY = K.protocolWritePending;

type ProtocolWritePending = {
  dateKey: string;
  phase: "finish" | "evening";
  startedAt: number;
};

// ─── Morning / Evening MMKV keys ─────────────────────────────────────────────

const morningKey = (dateKey: string) => K.morning(dateKey);
const eveningKey = (dateKey: string) => K.evening(dateKey);

// ─── Pure streak computation (shared by finish + evening paths) ─────────────

type StreakUpdate = {
  newStreak: number;
  streakPrevious: number;
};

function computeNewStreak(
  today: string,
  streakCurrent: number,
  streakLastDate: string | null,
  streakPrevious: number,
): StreakUpdate {
  if (!streakLastDate) {
    return { newStreak: 1, streakPrevious };
  }
  if (streakLastDate === today) {
    return { newStreak: streakCurrent, streakPrevious }; // already counted today
  }
  const yesterday = addDays(today, -1);
  if (streakLastDate === yesterday) {
    return { newStreak: streakCurrent + 1, streakPrevious };
  }
  // Streak broke — preserve what was lost.
  return { newStreak: 1, streakPrevious: streakCurrent };
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
  streakPrevious: number;
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
  streakPrevious: getJSON<number>(STREAK_PREV_KEY, 0),
  streakLastDate: getJSON<string | null>(STREAK_DATE_KEY, null),
  todayCompleted: false,

  // Morning / Evening defaults
  morningCompleted: false,
  eveningCompleted: false,
  morningIntention: "",
  morningReflection: "",

  load: () => {
    // Phase 2.2A: detect a crashed protocol write from a previous session
    // by checking the write-ahead flag. If present, log it (the caller will
    // see the stale flag and can decide whether to retry). We don't
    // automatically repair — the next completeEvening/finishProtocol call
    // will overwrite the state correctly.
    const stuck = getJSON<ProtocolWritePending | null>(PROTOCOL_WRITE_PENDING_KEY, null);
    if (stuck) {
      // eslint-disable-next-line no-console
      console.warn(
        `[protocol] detected stuck write-ahead flag from previous session: ${JSON.stringify(stuck)}. ` +
          `This indicates the app crashed mid-write. State may be inconsistent but will self-heal on next protocol completion.`,
      );
      // Clear the stuck flag so we don't keep logging on every launch.
      setJSON(PROTOCOL_WRITE_PENDING_KEY, null);
    }

    const sessions = getJSON<Record<string, ProtocolSession>>(SESSIONS_KEY, {});
    const streakCurrent = getJSON<number>(STREAK_KEY, 0);
    const streakPrevious = getJSON<number>(STREAK_PREV_KEY, 0);
    const streakLastDate = getJSON<string | null>(STREAK_DATE_KEY, null);
    const today = getTodayKey();

    // Hydrate morning / evening status from MMKV
    const mData = getJSON<MorningData | null>(morningKey(today), null);
    const eData = getJSON<EveningData | null>(eveningKey(today), null);

    set({
      sessions,
      streakCurrent,
      streakPrevious,
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

    // Phase 2.2A: write-ahead flag. If the app crashes between any of the
    // MMKV writes below, the flag stays set and is detected on next launch.
    setJSON(PROTOCOL_WRITE_PENDING_KEY, {
      dateKey: today,
      phase: "finish",
      startedAt: Date.now(),
    });

    const { newStreak, streakPrevious } = computeNewStreak(
      today,
      streakCurrent,
      streakLastDate,
      get().streakPrevious,
    );

    // Persist streak
    setJSON(STREAK_KEY, newStreak);
    setJSON(STREAK_DATE_KEY, today);
    setJSON(STREAK_PREV_KEY, streakPrevious);

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
    setJSON(K.protocolCompletions(today), { completed: true, score });

    // Phase 2.2A: clear the write-ahead flag — all writes succeeded.
    setJSON(PROTOCOL_WRITE_PENDING_KEY, null);

    set({
      sessions: updatedSessions,
      streakCurrent: newStreak,
      streakPrevious,
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

    // Phase 2.2A: write-ahead flag. Set before any of the 6 multi-key
    // writes below, cleared after all succeed. If the app crashes between
    // writes, load() on next launch detects the stuck flag and logs it.
    setJSON(PROTOCOL_WRITE_PENDING_KEY, {
      dateKey: today,
      phase: "evening",
      startedAt: Date.now(),
    });

    const data: EveningData = { reflection, identityVote, titanScore, completedAt: Date.now() };
    setJSON(eveningKey(today), data);

    // Backward compat: also record a full ProtocolSession
    const { sessions, streakCurrent, streakLastDate } = get();

    const { newStreak, streakPrevious } = computeNewStreak(
      today,
      streakCurrent,
      streakLastDate,
      get().streakPrevious,
    );

    setJSON(STREAK_KEY, newStreak);
    setJSON(STREAK_DATE_KEY, today);
    setJSON(STREAK_PREV_KEY, streakPrevious);

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
    setJSON(K.protocolCompletions(today), { completed: true, score: titanScore });

    // Phase 2.2A: clear write-ahead flag — all writes succeeded.
    setJSON(PROTOCOL_WRITE_PENDING_KEY, null);

    set({
      sessions: updatedSessions,
      streakCurrent: newStreak,
      streakPrevious,
      streakLastDate: today,
      todayCompleted: true,
      eveningCompleted: true,
      morningReflection: reflection,
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
