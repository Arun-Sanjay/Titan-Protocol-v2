import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId, useCurrentUserEmail } from "../../lib/session";
import { getProfile, upsertProfile, type Profile } from "../../services/profile";
import { settleStreaks } from "../../services/xp";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const profileKeys = {
  all: ["profile"] as const,
};

// Re-export Profile type for callers that import from this module.
export type { Profile };

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useProfile() {
  const userId = useCurrentUserId();

  return useQuery({
    queryKey: profileKeys.all,
    queryFn: async (): Promise<Profile> => {
      const row = await getProfile();
      if (row) return row;
      // Row hasn't been materialised yet (fresh signup, pre-sync). Return
      // a defaulted shape so callers don't crash on null. The real row
      // gets written into SQLite on the next upsertProfile call.
      return {
        id: userId ?? "",
        email: null,
        xp: 0,
        level: 1,
        streak_current: 0,
        streak_best: 0,
        streak_last_date: null,
        first_use_date: null,
        first_task_completed_at: null,
        onboarding_completed: false,
        tutorial_completed: false,
        display_name: null,
        archetype: null,
        mode: "full_protocol",
        focus_engines: [],
        expo_push_token: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    },
    enabled: Boolean(userId),
  });
}

/**
 * Award XP and detect level-up.
 *
 * Level formula: level = floor(xp / 500) + 1
 * Returns { leveledUp, fromLevel, toLevel, xp } so callers can
 * enqueue a rank-up event when leveledUp is true.
 *
 * Optimistic: immediately updates profile cache with new XP/level.
 */
export function useAwardXP() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      xpAmount: number,
    ): Promise<{
      leveledUp: boolean;
      fromLevel: number;
      toLevel: number;
      xp: number;
    }> => {
      const profile = await getProfile();
      const oldXP = profile?.xp ?? 0;
      const oldLevel = profile?.level ?? 1;
      const newXP = Math.max(0, oldXP + xpAmount);
      const newLevel = Math.floor(newXP / 500) + 1;

      await upsertProfile({ xp: newXP, level: newLevel });

      return {
        leveledUp: newLevel > oldLevel,
        fromLevel: oldLevel,
        toLevel: newLevel,
        xp: newXP,
      };
    },
    onMutate: async (xpAmount) => {
      await qc.cancelQueries({ queryKey: profileKeys.all });
      const prev = qc.getQueryData<Profile>(profileKeys.all);
      if (prev) {
        const newXP = Math.max(0, prev.xp + xpAmount);
        const newLevel = Math.floor(newXP / 500) + 1;
        qc.setQueryData<Profile>(profileKeys.all, {
          ...prev,
          xp: newXP,
          level: newLevel,
        });
      }
      return { prev };
    },
    onError: (_err, _xp, ctx) => {
      if (ctx?.prev) qc.setQueryData(profileKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

/**
 * Consistency-based streak settlement — the single streak authority.
 *
 * Replaces the old "active-yesterday" streak. `settleStreaks()` folds each
 * past, unsettled day's Titan score into the streak: a day >= 60% continues it
 * (+1), a day below (or a missed day) resets it to 0. Fired once per app-open
 * by `StreakSettlementGate`; idempotent (only advances past streak_last_date,
 * never settles today).
 */
export function useSettleStreaks() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => settleStreaks(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

type OnboardingData = {
  archetype?: string;
  display_name?: string | null;
  mode?: string;
  focus_engines?: string[];
  first_use_date?: string;
};

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const userEmail = useCurrentUserEmail();

  return useMutation({
    mutationFn: async (data?: OnboardingData) => {
      if (!userId) throw new Error("Not authenticated");
      const updates: Partial<Profile> = {
        email: userEmail ?? null,
        onboarding_completed: true,
      };
      if (data?.archetype)
        updates.archetype = data.archetype as Profile["archetype"];
      if (data?.display_name !== undefined)
        updates.display_name = data.display_name;
      if (data?.mode) updates.mode = data.mode as Profile["mode"];
      if (data?.focus_engines)
        updates.focus_engines =
          data.focus_engines as Profile["focus_engines"];
      if (data?.first_use_date) updates.first_use_date = data.first_use_date;

      await upsertProfile(updates);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}
