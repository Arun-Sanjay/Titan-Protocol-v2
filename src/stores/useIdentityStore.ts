import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import { getTodayKey } from "../lib/date";

// ─── Types ──────────────────────────────────────────────────────────────────

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
  titan:    { body: 0.25, mind: 0.25, money: 0.25, charisma: 0.25 },
  athlete:  { body: 0.40, mind: 0.20, money: 0.15, charisma: 0.25 },
  scholar:  { body: 0.15, mind: 0.45, money: 0.15, charisma: 0.25 },
  hustler:  { body: 0.15, mind: 0.25, money: 0.40, charisma: 0.20 },
  showman:  { body: 0.15, mind: 0.20, money: 0.20, charisma: 0.45 },
  warrior:  { body: 0.30, mind: 0.35, money: 0.15, charisma: 0.20 },
  founder:  { body: 0.10, mind: 0.30, money: 0.40, charisma: 0.20 },
  charmer:  { body: 0.30, mind: 0.10, money: 0.15, charisma: 0.45 },
};

export const IDENTITIES: IdentityMeta[] = [
  {
    id: "titan",
    name: "The Titan",
    tagline: "No ceiling. No excuses. Every engine at full power.",
    description: "You refuse to have a weak area. While others specialize, you dominate across the board \u2014 body, mind, money, and charisma. You set aggressive targets in every engine and hold yourself to the highest standard. You're not the best at one thing. You're dangerous at everything.",
    engineFocus: "All engines equally weighted at maximum intensity.",
    primaryEngine: "all",
    iconName: "flash-outline",
    engineWeights: ENGINE_WEIGHTS.titan,
  },
  {
    id: "athlete",
    name: "The Athlete",
    tagline: "The body is the foundation. Everything else is built on top.",
    description: "Physical performance is your identity. You train hard, eat right, sleep well, and push your limits. You believe that a strong body creates a strong mind and a strong life. When you're physically at your peak, everything else falls into place.",
    engineFocus: "Body (40%) is your dominant engine. Charisma (25%) supports. Mind and Money secondary.",
    primaryEngine: "body",
    iconName: "fitness-outline",
    engineWeights: ENGINE_WEIGHTS.athlete,
  },
  {
    id: "scholar",
    name: "The Scholar",
    tagline: "The mind is the ultimate weapon.",
    description: "Knowledge is your superpower. You invest heavily in learning, reading, thinking, and building intellectual capital. You believe a sharp mind solves every other problem \u2014 fitness, finances, relationships. Your daily practice centers on cognitive growth and deep focus.",
    engineFocus: "Mind (45%) is your dominant engine. Charisma (25%) supports. Body and Money secondary.",
    primaryEngine: "mind",
    iconName: "book-outline",
    engineWeights: ENGINE_WEIGHTS.scholar,
  },
  {
    id: "hustler",
    name: "The Hustler",
    tagline: "While they sleep, you build.",
    description: "Financial growth is your obsession. Side projects, investments, career moves \u2014 you're always working on your next income stream. You think in terms of ROI, leverage, and compound growth. You're not greedy \u2014 you're strategic about building the life you want.",
    engineFocus: "Money (40%) is your dominant engine. Mind (25%) supports. Body and Charisma secondary.",
    primaryEngine: "money",
    iconName: "trending-up-outline",
    engineWeights: ENGINE_WEIGHTS.hustler,
  },
  {
    id: "showman",
    name: "The Showman",
    tagline: "When you speak, rooms go quiet.",
    description: "You live for the stage \u2014 literal or figurative. Public speaking, commanding attention, making people feel something when you talk. You invest in your voice, your confidence, and your ability to influence. Being forgettable is your worst nightmare.",
    engineFocus: "Charisma (45%) is your dominant engine. Money (20%) and Mind (20%) support.",
    primaryEngine: "charisma",
    iconName: "mic-outline",
    engineWeights: ENGINE_WEIGHTS.showman,
  },
  {
    id: "warrior",
    name: "The Warrior",
    tagline: "Discipline is the bridge between who you are and who you want to be.",
    description: "You train your body AND sharpen your mind. Physical discipline fuels mental clarity. Mental toughness fuels physical performance. You believe they're one system, not two. Morning workouts and evening reading are both non-negotiable.",
    engineFocus: "Mind (35%) and Body (30%) are your dual engines. Charisma and Money support.",
    primaryEngine: "mind",
    iconName: "shield-outline",
    engineWeights: ENGINE_WEIGHTS.warrior,
  },
  {
    id: "founder",
    name: "The Founder",
    tagline: "Think strategically. Build relentlessly.",
    description: "You use intelligence to generate wealth. You think in systems, spot opportunities others miss, and turn knowledge into income. Books, courses, and deep thinking aren't hobbies \u2014 they're investments in your next move. You're building something.",
    engineFocus: "Money (40%) and Mind (30%) are your dual engines. Charisma and Body support.",
    primaryEngine: "money",
    iconName: "rocket-outline",
    engineWeights: ENGINE_WEIGHTS.founder,
  },
  {
    id: "charmer",
    name: "The Charmer",
    tagline: "First they see you. Then they hear you. Then they remember you.",
    description: "You invest in how you show up \u2014 physically and socially. You look good, speak well, and make people feel comfortable around you. Confidence isn't something you fake \u2014 it comes from knowing you've put in the work on both your body and your presence.",
    engineFocus: "Charisma (45%) and Body (30%) are your dual engines. Money and Mind support.",
    primaryEngine: "charisma",
    iconName: "sparkles-outline",
    engineWeights: ENGINE_WEIGHTS.charmer,
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

  selectIdentity: (archetype: Archetype) => void;
  castVote: () => void;
  changeIdentity: (archetype: Archetype) => void;
  getWeights: () => Record<string, number>;
  load: () => void;
};

const DEFAULT_WEIGHTS = { body: 0.25, mind: 0.25, money: 0.25, charisma: 0.25 };

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
    const weights = data.archetype && ENGINE_WEIGHTS[data.archetype]
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
