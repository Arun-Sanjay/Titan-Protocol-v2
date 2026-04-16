import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import { getTodayKey } from "../lib/date";

// ─── Types ─────────────────────────────────────────────────────────────────

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

// ─── Constants ──────────────────────────────────────────────────────────────

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

// ─── Store ──────────────────────────────────────────────────────────────────

type IdentityState = {
  archetype: Archetype;
  totalVotes: number;
  selectedDate: string | null;

  castVote: (archetype: Archetype) => void;
  changeIdentity: (archetype: Archetype) => void;
};

export const useIdentityStore = create<IdentityState>((set, get) => ({
  archetype: getJSON<Archetype>("identity_archetype_v2", "titan"),
  totalVotes: getJSON<number>("identity_total_votes", 0),
  selectedDate: getJSON<string | null>("identity_selected_date", null),

  castVote: (archetype) => {
    const votes = get().totalVotes + 1;
    setJSON("identity_archetype_v2", archetype);
    setJSON("identity_total_votes", votes);
    set({ archetype, totalVotes: votes });
  },

  changeIdentity: (archetype) => {
    const today = getTodayKey();
    setJSON("identity_archetype_v2", archetype);
    setJSON("identity_selected_date", today);
    setJSON("identity_total_votes", 0);
    set({ archetype, selectedDate: today, totalVotes: 0 });
  },
}));
