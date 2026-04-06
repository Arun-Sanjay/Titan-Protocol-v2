/**
 * Surprise Store — Manages active surprise state for the overlay system.
 *
 * Lightweight Zustand store that holds the currently active surprise
 * (if any) so the layout can render the SurpriseOverlay component.
 */

import { create } from "zustand";
import {
  checkForSurprise,
  activateDoubleXP,
  isDoubleXPActive,
  getDoubleXPRemainingMs,
  type Surprise,
} from "../lib/surprise-engine";

type SurpriseState = {
  /** The currently active surprise, or null if none */
  activeSurprise: Surprise | null;

  /**
   * Check if a surprise should fire. Call after cinematics/briefing flow.
   * If a surprise triggers, it's stored in `activeSurprise` for the overlay.
   */
  check: (streak: number, consistencyRate: number) => void;

  /** User accepted an actionable surprise (bonus challenge, double XP, etc.) */
  accept: () => void;

  /** User dismissed the surprise (or it auto-dismissed) */
  dismiss: () => void;

  /** Check if Double XP window is active */
  isDoubleXP: () => boolean;

  /** Get remaining Double XP time in ms */
  doubleXPRemaining: () => number;
};

export const useSurpriseStore = create<SurpriseState>((set, get) => ({
  activeSurprise: null,

  check: (streak, consistencyRate) => {
    const surprise = checkForSurprise(streak, consistencyRate);
    if (surprise) {
      set({ activeSurprise: surprise });
    }
  },

  accept: () => {
    const surprise = get().activeSurprise;
    if (!surprise) return;

    // Activate Double XP if that's the type
    if (surprise.type === "DOUBLE_XP_WINDOW") {
      activateDoubleXP();
    }

    set({ activeSurprise: null });
  },

  dismiss: () => {
    set({ activeSurprise: null });
  },

  isDoubleXP: () => isDoubleXPActive(),

  doubleXPRemaining: () => getDoubleXPRemainingMs(),
}));
