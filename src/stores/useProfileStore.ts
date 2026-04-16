import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { UserProfile } from "../db/schema";

// ─── XP Rewards (re-exported for backward compat) ──────────────────────────

export const XP_REWARDS = {
  MAIN_TASK: 20,
  SIDE_QUEST: 10,
  HABIT_COMPLETE: 5,
  JOURNAL_ENTRY: 15,
  STREAK_BONUS_7: 50,
  STREAK_BONUS_30: 200,
  PERFECT_DAY: 100,
} as const;

const XP_PER_LEVEL = 500;

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: UserProfile = {
  id: "default",
  xp: 0,
  level: 1,
  streak: 0,
  best_streak: 0,
  last_active_date: "",
};

// ─── Store ──────────────────────────────────────────────────────────────────

type ProfileState = {
  profile: UserProfile;

  load: () => void;
  awardXP: (dateKey: string, source: string, amount: number) => void;
  updateStreak: (dateKey: string) => void;
  setProfile: (profile: Partial<UserProfile>) => void;
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: getJSON<UserProfile>("user_profile", DEFAULT_PROFILE),

  load: () => {
    const profile = getJSON<UserProfile>("user_profile", DEFAULT_PROFILE);
    set({ profile });
  },

  awardXP: (_dateKey, _source, amount) => {
    set((s) => {
      const newXP = s.profile.xp + amount;
      const newLevel = Math.floor(newXP / XP_PER_LEVEL) + 1;
      const profile: UserProfile = {
        ...s.profile,
        xp: newXP,
        level: newLevel,
      };
      setJSON("user_profile", profile);
      return { profile };
    });
  },

  updateStreak: (dateKey) => {
    set((s) => {
      const prev = s.profile.last_active_date;
      // Simple consecutive day check
      const prevDate = prev ? new Date(prev) : null;
      const today = new Date(dateKey);
      let streak = s.profile.streak;

      if (prevDate) {
        const diff = Math.round(
          (today.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diff === 1) {
          streak += 1;
        } else if (diff > 1) {
          streak = 1;
        }
        // diff === 0 means same day, keep streak
      } else {
        streak = 1;
      }

      const best_streak = Math.max(s.profile.best_streak, streak);
      const profile: UserProfile = {
        ...s.profile,
        streak,
        best_streak,
        last_active_date: dateKey,
      };
      setJSON("user_profile", profile);
      return { profile };
    });
  },

  setProfile: (partial) => {
    set((s) => {
      const profile = { ...s.profile, ...partial };
      setJSON("user_profile", profile);
      return { profile };
    });
  },
}));
