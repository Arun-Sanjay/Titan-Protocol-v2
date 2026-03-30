import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import { getTodayKey } from "../lib/date";

// ─── Types ──────────────────────────────────────────────────────────────────

export type Archetype =
  | "operator"
  | "monk"
  | "titan"
  | "architect"
  | "warrior"
  | "scholar";

export type IdentityMeta = {
  id: Archetype;
  name: string;
  tagline: string;
  description: string;
  engineFocus: string;
  primaryEngine: string;
  iconName: string;
  engineWeights: Record<string, number>;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const ENGINE_WEIGHTS: Record<Archetype, Record<string, number>> = {
  operator:  { body: 0.25, mind: 0.25, money: 0.25, general: 0.25 },
  monk:      { body: 0.30, mind: 0.35, money: 0.15, general: 0.20 },
  titan:     { body: 0.25, mind: 0.25, money: 0.25, general: 0.25 },
  architect: { body: 0.15, mind: 0.30, money: 0.35, general: 0.20 },
  warrior:   { body: 0.40, mind: 0.20, money: 0.15, general: 0.25 },
  scholar:   { body: 0.20, mind: 0.40, money: 0.15, general: 0.25 },
};

export const IDENTITIES: IdentityMeta[] = [
  {
    id: "operator",
    name: "The Operator",
    tagline: "No weak links. Every system firing.",
    description: "You believe in balanced excellence. You don't obsess over one area \u2014 you build a system where Body, Mind, Money, and General all work together. Your strength is consistency across all engines. You're not the best at any one thing, but you're dangerous at everything.",
    engineFocus: "All engines weighted equally \u2014 no weak links allowed.",
    primaryEngine: "all",
    iconName: "construct-outline",
    engineWeights: ENGINE_WEIGHTS.operator,
  },
  {
    id: "monk",
    name: "The Monk",
    tagline: "Strength from stillness. Power from simplicity.",
    description: "You prioritize inner clarity and physical discipline. Your approach is minimalist \u2014 fewer goals, deeper focus. You believe that mastering your mind and body creates a foundation for everything else. Money and external achievements are secondary to internal strength.",
    engineFocus: "Mind (35%) and Body (30%) are your primary engines. Money and General support.",
    primaryEngine: "mind",
    iconName: "leaf-outline",
    engineWeights: ENGINE_WEIGHTS.monk,
  },
  {
    id: "titan",
    name: "The Titan",
    tagline: "More. Always more. No ceiling.",
    description: "You want maximum output in every area. While The Operator aims for balance, you aim for domination. Every engine at full power. You set aggressive targets, maintain intense routines, and push past limits. Rest is strategic, not habitual.",
    engineFocus: "All engines at maximum intensity \u2014 equal weight, highest expectations.",
    primaryEngine: "all",
    iconName: "flash-outline",
    engineWeights: ENGINE_WEIGHTS.titan,
  },
  {
    id: "architect",
    name: "The Architect",
    tagline: "Build structures that compound.",
    description: "You think in systems and long-term leverage. Your primary focus is financial growth and strategic thinking. You build processes that compound \u2014 investment habits, business systems, knowledge that translates to earnings. Body and general support your primary mission.",
    engineFocus: "Money (35%) and Mind (30%) are your primary engines. Body and General support.",
    primaryEngine: "money",
    iconName: "build-outline",
    engineWeights: ENGINE_WEIGHTS.architect,
  },
  {
    id: "warrior",
    name: "The Warrior",
    tagline: "The body leads. Everything else follows.",
    description: "Physical discipline is your foundation. You believe that training your body trains your mind. You push through discomfort, maintain strict fitness routines, and use physical challenges as the basis for all other growth. When your body is strong, everything else follows.",
    engineFocus: "Body (40%) is your dominant engine. Mind and General support. Money is secondary.",
    primaryEngine: "body",
    iconName: "fitness-outline",
    engineWeights: ENGINE_WEIGHTS.warrior,
  },
  {
    id: "scholar",
    name: "The Scholar",
    tagline: "The mind is the ultimate weapon.",
    description: "Knowledge is your superpower. You invest heavily in learning, reading, thinking, and building intellectual capital. You believe that a sharp mind solves every other problem \u2014 fitness, finances, relationships. Your daily practice centers on cognitive growth.",
    engineFocus: "Mind (40%) is your dominant engine. Body and General support. Money is secondary.",
    primaryEngine: "mind",
    iconName: "book-outline",
    engineWeights: ENGINE_WEIGHTS.scholar,
  },
];

// ─── MMKV key ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "user_identity";

type PersistedIdentity = {
  archetype: Archetype | null;
  selectedDate: string | null;
  totalVotes: number;
};

// ─── Store ──────────────────────────────────────────────────────────────────

type IdentityState = {
  archetype: Archetype | null;
  selectedDate: string | null;
  totalVotes: number;
  engineWeights: Record<string, number>;

  /** First-time identity selection (during onboarding) */
  selectIdentity: (archetype: Archetype) => void;
  /** Cast a daily identity vote (called when protocol completes) */
  castVote: () => void;
  /** Change identity after onboarding (resets vote count, logs new date) */
  changeIdentity: (archetype: Archetype) => void;
  /** Get current engine weights (respects Titan Mode equal weighting) */
  getWeights: () => Record<string, number>;
  /** Load persisted state from MMKV */
  load: () => void;
};

const DEFAULT_WEIGHTS = { body: 0.25, mind: 0.25, money: 0.25, general: 0.25 };

function persist(state: PersistedIdentity) {
  setJSON(STORAGE_KEY, state);
}

export const useIdentityStore = create<IdentityState>()((set, get) => ({
  archetype: null,
  selectedDate: null,
  totalVotes: 0,
  engineWeights: DEFAULT_WEIGHTS,

  selectIdentity: (archetype) => {
    const now = getTodayKey();
    const weights = ENGINE_WEIGHTS[archetype];
    set({ archetype, selectedDate: now, totalVotes: 0, engineWeights: weights });
    persist({ archetype, selectedDate: now, totalVotes: 0 });
  },

  castVote: () => {
    const { archetype, selectedDate, totalVotes } = get();
    if (!archetype) return;
    const next = totalVotes + 1;
    set({ totalVotes: next });
    persist({ archetype, selectedDate, totalVotes: next });
  },

  changeIdentity: (archetype) => {
    const now = getTodayKey();
    const weights = ENGINE_WEIGHTS[archetype];
    set({ archetype, selectedDate: now, totalVotes: 0, engineWeights: weights });
    persist({ archetype, selectedDate: now, totalVotes: 0 });
  },

  getWeights: () => {
    const { archetype } = get();
    if (!archetype) return DEFAULT_WEIGHTS;
    return ENGINE_WEIGHTS[archetype];
  },

  load: () => {
    const data = getJSON<PersistedIdentity>(STORAGE_KEY, {
      archetype: null,
      selectedDate: null,
      totalVotes: 0,
    });
    const weights = data.archetype
      ? ENGINE_WEIGHTS[data.archetype]
      : DEFAULT_WEIGHTS;
    set({
      archetype: data.archetype,
      selectedDate: data.selectedDate,
      totalVotes: data.totalVotes,
      engineWeights: weights,
    });
  },
}));

// ─── Selectors ──────────────────────────────────────────────────────────────

export function selectIdentityMeta(archetype: Archetype | null): IdentityMeta | null {
  if (!archetype) return null;
  return IDENTITIES.find((i) => i.id === archetype) ?? null;
}

export function selectDaysSinceSelection(selectedDate: string | null): number {
  if (!selectedDate) return 0;
  const start = new Date(selectedDate + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000));
}
