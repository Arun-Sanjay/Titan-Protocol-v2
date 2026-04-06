import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import { K } from "../db/keys";
import { isDoubleXPActive } from "../lib/surprise-engine";
import type { UserProfile } from "../db/schema";

// Phase 2.2D: keys sourced from central registry.
const PROFILE_KEY = K.userProfile;
const RANK_UP_QUEUE_KEY = K.pendingRankUps;
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

/**
 * Phase 2.1E: Rank-up events are persisted to MMKV so that level-ups
 * survive screen unmounts, app backgrounding, and rapid successive XP
 * awards. Previously the LevelUpOverlay was mounted only in the dashboard
 * tab and used a useRef-based detection that missed events when the user
 * was on any other screen (the core bug).
 *
 * Now: useProfileStore.awardXP() detects the level change at the source
 * and enqueues an event. The LevelUpOverlay (mounted in the root layout
 * in Phase 2.1E) subscribes to the queue head and shows whatever is
 * pending, calling dequeueRankUp() on dismiss.
 */
export type RankUpEvent = {
  id: string;
  from: number;
  to: number;
  at: number;
};

type ProfileState = {
  profile: UserProfile;
  pendingRankUps: RankUpEvent[];
  load: () => void;
  awardXP: (dateKey: string, source: string, amount: number) => void;
  updateStreak: (dateKey: string) => void;
  dequeueRankUp: () => void;
};

function genRankUpId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
  profile: DEFAULT_PROFILE,
  pendingRankUps: getJSON<RankUpEvent[]>(RANK_UP_QUEUE_KEY, []),

  load: () => {
    set({
      profile: getJSON<UserProfile>(PROFILE_KEY, DEFAULT_PROFILE),
      pendingRankUps: getJSON<RankUpEvent[]>(RANK_UP_QUEUE_KEY, []),
    });
  },

  awardXP: (_dateKey, _source, amount) => {
    if (!Number.isFinite(amount)) return;
    // Double XP window from surprise system
    const finalAmount = isDoubleXPActive() ? amount * 2 : amount;
    const prevProfile = get().profile;
    const prevLevel = prevProfile.level;

    const profile = { ...prevProfile };
    profile.xp = Math.max(0, profile.xp + finalAmount); // Clamp to 0 minimum
    profile.level = Math.max(1, Math.floor(profile.xp / XP_PER_LEVEL) + 1);
    setJSON(PROFILE_KEY, profile);

    // Phase 2.1E: detect level change at the source.
    // Guard: only enqueue on positive level changes from >=1 (not initial
    // load from 0). Handles multi-level jumps (e.g., big XP awards crossing
    // several level boundaries) as a single rank-up event from->to.
    if (profile.level > prevLevel && prevLevel >= 1) {
      const event: RankUpEvent = {
        id: genRankUpId(),
        from: prevLevel,
        to: profile.level,
        at: Date.now(),
      };
      const nextQueue = [...get().pendingRankUps, event];
      setJSON(RANK_UP_QUEUE_KEY, nextQueue);
      set({ profile, pendingRankUps: nextQueue });
    } else {
      set({ profile });
    }
  },

  dequeueRankUp: () => {
    const [, ...rest] = get().pendingRankUps;
    setJSON(RANK_UP_QUEUE_KEY, rest);
    set({ pendingRankUps: rest });
  },

  updateStreak: (dateKey) => {
    const profile = { ...get().profile };
    const today = new Date(dateKey + "T00:00:00");
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

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
