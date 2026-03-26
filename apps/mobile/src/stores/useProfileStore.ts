import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { UserProfile } from "../db/schema";

const PROFILE_KEY = "user_profile";
const XP_PER_LEVEL = 500;

const DEFAULT_PROFILE: UserProfile = {
  id: "default",
  xp: 0,
  level: 1,
  streak: 0,
  best_streak: 0,
  last_active_date: "",
};

export const XP_REWARDS = {
  MAIN_TASK: 20,
  SIDE_QUEST: 10,
  HABIT_COMPLETE: 5,
  JOURNAL_ENTRY: 15,
  STREAK_BONUS_7: 50,
  STREAK_BONUS_30: 200,
  PERFECT_DAY: 100,
} as const;

type ProfileState = {
  profile: UserProfile;
  load: () => void;
  awardXP: (dateKey: string, source: string, amount: number) => void;
  updateStreak: (dateKey: string) => void;
};

export const useProfileStore = create<ProfileState>()((set, get) => ({
  profile: DEFAULT_PROFILE,

  load: () => {
    set({ profile: getJSON<UserProfile>(PROFILE_KEY, DEFAULT_PROFILE) });
  },

  awardXP: (_dateKey, _source, amount) => {
    const profile = { ...get().profile };
    profile.xp += amount;
    const newLevel = Math.floor(profile.xp / XP_PER_LEVEL) + 1;
    if (newLevel > profile.level) profile.level = newLevel;
    setJSON(PROFILE_KEY, profile);
    set({ profile });
  },

  updateStreak: (dateKey) => {
    const profile = { ...get().profile };
    const today = new Date(dateKey);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    let newStreak: number;
    if (profile.last_active_date === yesterdayKey) {
      newStreak = profile.streak + 1;
    } else if (profile.last_active_date === dateKey) {
      newStreak = profile.streak;
    } else {
      newStreak = 1;
    }

    profile.streak = newStreak;
    profile.best_streak = Math.max(newStreak, profile.best_streak);
    profile.last_active_date = dateKey;
    setJSON(PROFILE_KEY, profile);
    set({ profile });
  },
}));
