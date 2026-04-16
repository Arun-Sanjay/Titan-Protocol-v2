import { create } from "zustand";
import { upsertProfile } from "../services/profile";
import { queryClient } from "../lib/query-client";
import { profileQueryKey } from "../hooks/queries/useProfile";
import { logError } from "../lib/error-log";

export type Archetype =
  | "titan"
  | "athlete"
  | "scholar"
  | "hustler"
  | "showman"
  | "warrior"
  | "founder"
  | "charmer";

export type IdentityMeta = {
  name: string;
  description: string;
  tagline: string;
  color: string;
  icon: string;
  primaryEngine: string;
  iconName: string;
};

export const IDENTITIES: { key: Archetype; id: Archetype; meta: IdentityMeta; name: string; primaryEngine: string }[] = [
  { key: "titan", id: "titan", name: "The Titan", primaryEngine: "all", meta: { name: "The Titan", description: "Master of all domains", tagline: "All engines online. No exceptions.", color: "#FFD700", icon: "⚡", primaryEngine: "all", iconName: "flash-outline" } },
  { key: "athlete", id: "athlete", name: "The Athlete", primaryEngine: "body", meta: { name: "The Athlete", description: "Body is the temple", tagline: "The body leads. Everything follows.", color: "#00FF88", icon: "💪", primaryEngine: "body", iconName: "fitness-outline" } },
  { key: "scholar", id: "scholar", name: "The Scholar", primaryEngine: "mind", meta: { name: "The Scholar", description: "Knowledge is power", tagline: "Sharpen the mind. Sharpen everything.", color: "#A78BFA", icon: "📚", primaryEngine: "mind", iconName: "book-outline" } },
  { key: "hustler", id: "hustler", name: "The Hustler", primaryEngine: "money", meta: { name: "The Hustler", description: "Money never sleeps", tagline: "Stack the paper. Build the empire.", color: "#FBBF24", icon: "💰", primaryEngine: "money", iconName: "cash-outline" } },
  { key: "showman", id: "showman", name: "The Showman", primaryEngine: "charisma", meta: { name: "The Showman", description: "Presence commands attention", tagline: "Command the room. Own the stage.", color: "#60A5FA", icon: "🎭", primaryEngine: "charisma", iconName: "mic-outline" } },
  { key: "warrior", id: "warrior", name: "The Warrior", primaryEngine: "body", meta: { name: "The Warrior", description: "Discipline defeats talent", tagline: "Discipline is the weapon. Use it.", color: "#F87171", icon: "⚔️", primaryEngine: "body", iconName: "shield-outline" } },
  { key: "founder", id: "founder", name: "The Founder", primaryEngine: "money", meta: { name: "The Founder", description: "Build empires", tagline: "Build something that outlasts you.", color: "#FB923C", icon: "🏗️", primaryEngine: "money", iconName: "construct-outline" } },
  { key: "charmer", id: "charmer", name: "The Charmer", primaryEngine: "charisma", meta: { name: "The Charmer", description: "Influence is everything", tagline: "Influence is the ultimate currency.", color: "#38BDF8", icon: "✨", primaryEngine: "charisma", iconName: "sparkles-outline" } },
];

const IDENTITY_MAP = new Map(IDENTITIES.map((i) => [i.key, i.meta]));

// ─── Selectors (pure functions, importable without the hook) ────────────────

export function selectIdentityMeta(archetype: Archetype | null): IdentityMeta | null {
  if (!archetype) return null;
  return IDENTITY_MAP.get(archetype) ?? null;
}

export function selectDaysSinceSelection(selectedDate: string | null): number {
  if (!selectedDate) return 0;
  const now = new Date();
  const selected = new Date(selectedDate);
  return Math.max(0, Math.floor((now.getTime() - selected.getTime()) / 86_400_000));
}

/**
 * In-memory mirror of profile.archetype. ProfileHydrator keeps this
 * in sync whenever the cloud profile changes. Writes go to Supabase
 * first; the local state updates after the network settles.
 *
 * Vote counts and selection date are local-only and reset on app
 * restart — they drive the "days since identity change" micro-UI
 * element and don't need to sync across devices.
 */
type IdentityState = {
  archetype: Archetype;
  totalVotes: number;
  selectedDate: string | null;

  castVote: (archetype: Archetype) => void;
  changeIdentity: (archetype: Archetype) => void;
};

function persistArchetype(archetype: Archetype): void {
  upsertProfile({ archetype })
    .then(() => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    })
    .catch((e) => logError("useIdentityStore.persistArchetype", e, { archetype }));
}

export const useIdentityStore = create<IdentityState>((set, get) => ({
  archetype: "titan",
  totalVotes: 0,
  selectedDate: null,

  castVote: (archetype) => {
    const votes = get().totalVotes + 1;
    set({ archetype, totalVotes: votes });
    persistArchetype(archetype);
  },

  changeIdentity: (archetype) => {
    const today = new Date().toISOString().slice(0, 10);
    set({ archetype, selectedDate: today, totalVotes: 0 });
    persistArchetype(archetype);
  },
}));
