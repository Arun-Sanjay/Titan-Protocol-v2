import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Store ──────────────────────────────────────────────────────────────────

type TitleState = {
  equippedId: string | null;
  unlockedIds: string[];

  equip: (titleId: string) => void;
  unequip: () => void;
  unlock: (titleId: string) => void;
  isUnlocked: (titleId: string) => boolean;
  load: () => void;
};

export const useTitleStore = create<TitleState>((set, get) => ({
  equippedId: getJSON<string | null>("title_equipped", null),
  unlockedIds: getJSON<string[]>("titles_unlocked", []),

  equip: (titleId) => {
    setJSON("title_equipped", titleId);
    set({ equippedId: titleId });
  },

  unequip: () => {
    setJSON("title_equipped", null);
    set({ equippedId: null });
  },

  unlock: (titleId) => {
    set((s) => {
      if (s.unlockedIds.includes(titleId)) return s;
      const unlockedIds = [...s.unlockedIds, titleId];
      setJSON("titles_unlocked", unlockedIds);
      return { unlockedIds };
    });
  },

  isUnlocked: (titleId) => {
    return get().unlockedIds.includes(titleId);
  },

  load: () => {
    set({
      equippedId: getJSON<string | null>("title_equipped", null),
      unlockedIds: getJSON<string[]>("titles_unlocked", []),
    });
  },
}));
