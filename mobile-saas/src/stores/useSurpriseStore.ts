import { create } from "zustand";
import { checkForSurprise, type Surprise } from "../lib/surprise-engine";

type SurpriseState = {
  activeSurprise: Surprise | null;
  check: (streak: number, consistencyRate: number) => void;
  accept: () => void;
  dismiss: () => void;
};

/**
 * Surprise overlay state.
 *
 * `check()` delegates entirely to surprise-engine's `checkForSurprise()`
 * which handles grace period, cooldown, time window, probability, type
 * selection, and MMKV flag marking. The store only holds the active
 * surprise for the overlay to render.
 */
export const useSurpriseStore = create<SurpriseState>((set) => ({
  activeSurprise: null,

  check: (streak, consistencyRate) => {
    const surprise = checkForSurprise(streak, consistencyRate);
    if (surprise) {
      set({ activeSurprise: surprise });
    }
  },

  accept: () => {
    set({ activeSurprise: null });
  },

  dismiss: () => {
    set({ activeSurprise: null });
  },
}));
