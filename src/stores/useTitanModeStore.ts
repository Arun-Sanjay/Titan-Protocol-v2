import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

type TitanModeState = {
  unlocked: boolean;
  unlockedAt: string | null;

  unlock: () => void;
};

export const useTitanModeStore = create<TitanModeState>((set) => ({
  unlocked: getJSON<boolean>("titan_mode_unlocked", false),
  unlockedAt: getJSON<string | null>("titan_mode_unlocked_at", null),

  unlock: () => {
    const now = new Date().toISOString();
    setJSON("titan_mode_unlocked", true);
    setJSON("titan_mode_unlocked_at", now);
    set({ unlocked: true, unlockedAt: now });
  },
}));
