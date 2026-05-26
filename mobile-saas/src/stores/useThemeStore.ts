import { create } from "zustand";
import { storage } from "../db/storage";

/**
 * Device-local theme picker. MMKV-backed (per the architecture rule
 * that user data goes to Supabase; device prefs stay local).
 *
 * v1 ships dark-only; we expose two named dark variants so the picker
 * UI has something to flip. "cyberpunk" is currently a no-op alias for
 * "hud" — it'll fork visually post-launch once the user signals demand.
 */
export type ThemeKey = "hud" | "cyberpunk";

type ThemeState = {
  theme: ThemeKey;
  setTheme: (next: ThemeKey) => void;
};

const STORAGE_KEY = "titan.themeKey";

function loadInitial(): ThemeKey {
  try {
    const v = storage.getString(STORAGE_KEY);
    if (v === "hud" || v === "cyberpunk") return v;
  } catch {
    // Ignore — MMKV unavailable in tests; fall back to default.
  }
  return "hud";
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: loadInitial(),
  setTheme: (next) => {
    try {
      storage.set(STORAGE_KEY, next);
    } catch {
      // Best-effort; in-memory state still reflects the change.
    }
    set({ theme: next });
  },
}));
