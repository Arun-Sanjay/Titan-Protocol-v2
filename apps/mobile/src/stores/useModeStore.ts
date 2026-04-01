import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppMode = "full_protocol" | "structured" | "tracker" | "focus" | "zen" | "titan";

/** Alias used by v2 settings / tutorial */
export type ExperienceMode = AppMode;

export type IdentityArchetype =
  | "titan"
  | "athlete"
  | "scholar"
  | "hustler"
  | "showman"
  | "warrior"
  | "founder"
  | "charmer";

export const IDENTITY_LABELS: Record<IdentityArchetype, string> = {
  titan: "The Titan",
  athlete: "The Athlete",
  scholar: "The Scholar",
  hustler: "The Hustler",
  showman: "The Showman",
  warrior: "The Warrior",
  founder: "The Founder",
  charmer: "The Charmer",
};

// Which dashboard features each mode shows
const MODE_FEATURES: Record<AppMode, Set<string>> = {
  full_protocol: new Set([
    "protocol_card",
    "protocol",
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
    "narrative",
    "mind_training",
    "quests",
  ]),
  structured: new Set([
    "protocol_card",
    "protocol",
    "xp_streak",
    "titan_score",
    "missions",
    "engine_sparklines",
    "skill_trees",
    "activity_heatmap",
    "radar",
    "quests",
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
  focus: new Set([
    "titan_score",
    "missions",
    "engine_sparklines",
    "activity_heatmap",
  ]),
  zen: new Set([
    "intention_input",
    "habits",
    "journal_prompt",
  ]),
  titan: new Set([
    "protocol_card",
    "protocol",
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
    "narrative",
    "mind_training",
    "quests",
  ]),
};

// ─── Standalone helpers (used by profile, hub, etc.) ─────────────────────────

export type Feature = string;

export function checkFeatureVisible(mode: AppMode, feature: string): boolean {
  return MODE_FEATURES[mode]?.has(feature) ?? false;
}

/** Returns the list of engines that should be visible for a given mode + focusEngines selection. */
export function selectActiveEngines(mode: AppMode, focusEngines: string[]): string[] {
  const all = ["body", "mind", "money", "charisma"];
  if (mode === "focus" && focusEngines.length > 0) return focusEngines;
  return all;
}

const MODE_KEY = "app_mode";
const IDENTITY_KEY = "app_identity";
const FOCUS_ENGINES_KEY = "focus_engines";

// ─── Store ────────────────────────────────────────────────────────────────────

type ModeState = {
  mode: AppMode;
  identity: IdentityArchetype | null;
  focusEngines: string[];
  load: () => void;
  setMode: (mode: AppMode) => void;
  setIdentity: (identity: IdentityArchetype) => void;
  setFocusEngines: (engines: string[]) => void;
  checkFeatureVisible: (feature: string) => boolean;
  /** Alias used by protocol-completion */
  isFeatureVisible: (feature: string) => boolean;
};

export const useModeStore = create<ModeState>()((set, get) => ({
  mode: getJSON<AppMode>(MODE_KEY, "full_protocol"),
  identity: getJSON<IdentityArchetype | null>(IDENTITY_KEY, null),
  focusEngines: getJSON<string[]>(FOCUS_ENGINES_KEY, []),

  load: () => {
    set({
      mode: getJSON<AppMode>(MODE_KEY, "full_protocol"),
      identity: getJSON<IdentityArchetype | null>(IDENTITY_KEY, null),
      focusEngines: getJSON<string[]>(FOCUS_ENGINES_KEY, []),
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

  setFocusEngines: (engines) => {
    setJSON(FOCUS_ENGINES_KEY, engines);
    set({ focusEngines: engines });
  },

  checkFeatureVisible: (feature) => {
    return MODE_FEATURES[get().mode]?.has(feature) ?? false;
  },

  isFeatureVisible: (feature) => {
    return MODE_FEATURES[get().mode]?.has(feature) ?? false;
  },
}));
