import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { IdentityArchetype } from "./useModeStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProtocolSession = {
  dateKey: string;
  completedAt: number;
  intention: string;
  habitChecks: Record<number, boolean>; // habitId → completed during protocol
  titanScore: number; // score at the time of completion
  identityVote: IdentityArchetype | null;
};

const SESSIONS_KEY = "protocol_sessions";

// ─── Store ────────────────────────────────────────────────────────────────────

type ProtocolState = {
  sessions: Record<string, ProtocolSession>; // dateKey → session
  load: () => void;
  isCompletedToday: (dateKey: string) => boolean;
  completeSession: (session: ProtocolSession) => void;
  getSession: (dateKey: string) => ProtocolSession | null;
};

export const useProtocolStore = create<ProtocolState>()((set, get) => ({
  sessions: getJSON<Record<string, ProtocolSession>>(SESSIONS_KEY, {}),

  load: () => {
    set({ sessions: getJSON<Record<string, ProtocolSession>>(SESSIONS_KEY, {}) });
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
}));
