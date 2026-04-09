import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import { K } from "../db/keys";
import { isDoubleXPActive } from "../lib/surprise-engine";
import { enqueueRankUp } from "../services/rank-ups";
import { logError } from "../lib/error-log";
import type { UserProfile } from "../db/schema";

// Phase 2.2D: keys sourced from central registry.
const PROFILE_KEY = K.userProfile;
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
 * Phase 2.4: the MMKV-backed `pendingRankUps` queue and its
 * `dequeueRankUp` action have been deleted. They were the legacy half
 * of the dual rank-up queue documented in the engineering report
 * (§6.9). The cloud `rank_up_events` table is now the only source of
 * truth — RankUpOverlayMount.tsx subscribes to `usePendingRankUps()`
 * from `hooks/queries/useRankUps.ts`.
 *
 * Existing legacy callers of `useProfileStore.awardXP` (QuestCard,
 * WarRoom) get migrated to the cloud `useAwardXP` mutation in Phase 6.
 * Until then, this store's `awardXP` keeps the local MMKV profile in
 * sync AND fires a fire-and-forget call to `services/rank-ups
 * .enqueueRankUp` on level-up so the cloud overlay still triggers.
 */

type ProfileState = {
  profile: UserProfile;
  load: () => void;
  awardXP: (dateKey: string, source: string, amount: number) => void;
  updateStreak: (dateKey: string) => void;
};

export const useProfileStore = create<ProfileState>()((set, get) => ({
  profile: getJSON<UserProfile>(PROFILE_KEY, DEFAULT_PROFILE),

  load: () => {
    set({ profile: getJSON<UserProfile>(PROFILE_KEY, DEFAULT_PROFILE) });
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
    set({ profile });

    // Phase 2.4: enqueue rank-up to the cloud table on level change.
    // Fire-and-forget — if the user is offline the call will fail and
    // the overlay won't fire for this particular event, but Phase 6
    // will migrate the two legacy callers (QuestCard, WarRoom) to
    // useAwardXP from hooks/queries/useProfile.ts which uses the
    // optimistic-mutation path with offline queueing. Until then this
    // is the cleanest way to keep the legacy callers wired without
    // resurrecting the dead MMKV queue.
    if (profile.level > prevLevel && prevLevel >= 1) {
      enqueueRankUp({ fromLevel: prevLevel, toLevel: profile.level }).catch(
        (e) => {
          logError("useProfileStore.awardXP.enqueueRankUp", e, {
            fromLevel: prevLevel,
            toLevel: profile.level,
          });
        },
      );
    }
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
