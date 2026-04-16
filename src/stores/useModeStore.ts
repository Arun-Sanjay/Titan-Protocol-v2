import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { EngineKey } from "../db/schema";

// ─── Types ─────────────────────────────────────────────────────────────────

export type IdentityArchetype =
  | "titan"
  | "athlete"
  | "scholar"
  | "hustler"
  | "showman"
  | "warrior"
  | "founder"
  | "charmer";

export type AppMode = "standard" | "titan" | "focus";
export type ExperienceMode = "full_protocol" | "structured" | "titan" | "tracker" | "focus" | "zen";

export type Feature =
  | "phases"
  | "narrative"
  | "skill_trees"
  | "quests"
  | "bosses"
  | "field_ops"
  | "mind_training"
  | "deep_work";

// ─── Constants ──────────────────────────────────────────────────────────────

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

const ALL_ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

// ─── Selectors (pure functions, importable without the hook) ────────────────

export function selectActiveEngines(
  mode: AppMode,
  focusEngines: EngineKey[],
): EngineKey[] {
  if (mode === "focus" && focusEngines.length > 0) return focusEngines;
  return ALL_ENGINES;
}

export function checkFeatureVisible(mode: AppMode, feature: Feature): boolean {
  // In standard mode, all features are visible
  if (mode === "standard" || mode === "titan") return true;
  // Focus mode hides non-essential features
  const FOCUS_VISIBLE: Feature[] = ["phases", "narrative"];
  return FOCUS_VISIBLE.includes(feature);
}

// ─── Store ──────────────────────────────────────────────────────────────────

type ModeState = {
  mode: AppMode;
  identity: IdentityArchetype;
  focusEngines: EngineKey[];
  experienceMode: ExperienceMode;
  setMode: (mode: AppMode) => void;
  setIdentity: (archetype: IdentityArchetype) => void;
  setFocusEngines: (engines: EngineKey[]) => void;
  setExperienceMode: (mode: ExperienceMode) => void;
};

export const useModeStore = create<ModeState>((set) => ({
  mode: getJSON<AppMode>("app_mode", "standard"),
  identity: getJSON<IdentityArchetype>("identity_archetype", "titan"),
  focusEngines: getJSON<EngineKey[]>("focus_engines", []),
  experienceMode: getJSON<ExperienceMode>("experience_mode", "full_protocol"),

  setMode: (mode) => {
    setJSON("app_mode", mode);
    set({ mode });
  },
  setIdentity: (archetype) => {
    setJSON("identity_archetype", archetype);
    set({ identity: archetype });
  },
  setFocusEngines: (engines) => {
    setJSON("focus_engines", engines);
    set({ focusEngines: engines });
  },
  setExperienceMode: (mode) => {
    setJSON("experience_mode", mode);
    set({ experienceMode: mode });
  },
}));
