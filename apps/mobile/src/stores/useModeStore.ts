import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppMode = "full_protocol" | "tracker" | "zen";

export type IdentityArchetype =
  | "athlete"
  | "scholar"
  | "builder"
  | "warrior"
  | "creator"
  | "strategist";

export const IDENTITY_LABELS: Record<IdentityArchetype, string> = {
  athlete: "The Athlete",
  scholar: "The Scholar",
  builder: "The Builder",
  warrior: "The Warrior",
  creator: "The Creator",
  strategist: "The Strategist",
};

// Which dashboard features each mode shows
const MODE_FEATURES: Record<AppMode, Set<string>> = {
  full_protocol: new Set([
    "protocol_card",
    "xp_streak",
    "titan_score",
    "missions",
    "suggested_missions",
    "weekly_quests",
    "engine_sparklines",
    "skill_trees",
    "activity_heatmap",
    "radar",
    "week_comparison",
  ]),
  tracker: new Set([
    "titan_score",
    "missions",
    "engine_sparklines",
    "activity_heatmap",
    "radar",
    "week_comparison",
    "weekly_summary",
  ]),
  zen: new Set([
    "intention_input",
    "habits",
    "journal_prompt",
  ]),
};

const MODE_KEY = "app_mode";
const IDENTITY_KEY = "app_identity";

// ─── Store ────────────────────────────────────────────────────────────────────

type ModeState = {
  mode: AppMode;
  identity: IdentityArchetype | null;
  load: () => void;
  setMode: (mode: AppMode) => void;
  setIdentity: (identity: IdentityArchetype) => void;
  checkFeatureVisible: (feature: string) => boolean;
};

export const useModeStore = create<ModeState>()((set, get) => ({
  mode: getJSON<AppMode>(MODE_KEY, "full_protocol"),
  identity: getJSON<IdentityArchetype | null>(IDENTITY_KEY, null),

  load: () => {
    set({
      mode: getJSON<AppMode>(MODE_KEY, "full_protocol"),
      identity: getJSON<IdentityArchetype | null>(IDENTITY_KEY, null),
    });
  },

  setMode: (mode) => {
    setJSON(MODE_KEY, mode);
    set({ mode });
  },

  setIdentity: (identity) => {
    setJSON(IDENTITY_KEY, identity);
    set({ identity });
  },

  checkFeatureVisible: (feature) => {
    return MODE_FEATURES[get().mode].has(feature);
  },
}));
