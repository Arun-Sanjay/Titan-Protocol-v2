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

/**
 * Map the cloud `profiles.mode` (ExperienceMode) onto the legacy in-store
 * `mode` (AppMode) used by `checkFeatureVisible` and a couple of legacy
 * UI branches. Keeping the two in sync is mandatory: the Settings screen
 * writes `experienceMode` only, and before this mapping the AppMode-driven
 * gates kept showing the OLD experience even after a mode change.
 */
export function deriveAppMode(experienceMode: ExperienceMode): AppMode {
  if (experienceMode === "titan") return "titan";
  if (experienceMode === "focus") return "focus";
  return "standard";
}

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

// On boot, derive the persisted `mode` from `experienceMode` so the two
// can never come back from a previous session out of sync. (They got
// out of sync before the deriveAppMode wiring landed, so this also
// self-heals legacy installs.)
const _initialExperienceMode = getJSON<ExperienceMode>(
  "experience_mode",
  "full_protocol",
);
const _initialAppMode = deriveAppMode(_initialExperienceMode);

export const useModeStore = create<ModeState>((set) => ({
  mode: _initialAppMode,
  identity: getJSON<IdentityArchetype>("identity_archetype", "titan"),
  focusEngines: getJSON<EngineKey[]>("focus_engines", []),
  experienceMode: _initialExperienceMode,

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
    // Settings only writes experienceMode, but `checkFeatureVisible`
    // reads `mode` — keep both in lockstep so feature gates actually
    // change when the user swaps modes.
    const derived = deriveAppMode(mode);
    setJSON("experience_mode", mode);
    setJSON("app_mode", derived);
    set({ experienceMode: mode, mode: derived });
  },
}));
