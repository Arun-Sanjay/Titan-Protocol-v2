import { create } from "zustand";
import {
  checkTitles,
  getUnlockedTitles,
  getEquippedTitle,
  equipTitle,
  unequipTitle,
} from "../lib/titles";
import type { TitleDef, TitleCheckContext } from "../lib/titles";

type TitleState = {
  unlockedIds: string[];
  equippedId: string | null;
  pendingTitle: TitleDef | null;

  load: () => void;
  checkAndUnlock: (context: TitleCheckContext) => TitleDef[];
  equip: (titleId: string) => void;
  unequip: () => void;
  dismissPending: () => void;
};

export const useTitleStore = create<TitleState>()((set, _get) => ({
  unlockedIds: [],
  equippedId: null,
  pendingTitle: null,

  load: () => {
    const unlockedIds = getUnlockedTitles();
    const equippedId = getEquippedTitle();
    set({ unlockedIds, equippedId });
  },

  checkAndUnlock: (context) => {
    const newlyUnlocked = checkTitles(context);
    if (newlyUnlocked.length > 0) {
      const unlockedIds = getUnlockedTitles();
      set({ unlockedIds, pendingTitle: newlyUnlocked[0] });
    }
    return newlyUnlocked;
  },

  equip: (titleId) => {
    equipTitle(titleId);
    set({ equippedId: titleId });
  },

  unequip: () => {
    unequipTitle();
    set({ equippedId: null });
  },

  dismissPending: () => {
    set({ pendingTitle: null });
  },
}));
