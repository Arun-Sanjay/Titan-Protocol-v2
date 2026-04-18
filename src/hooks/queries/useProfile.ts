import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import { getProfile, upsertProfile, type Profile } from "../../services/profile";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const profileQueryKey = ["profile"] as const;

// Re-export Profile type for callers that import from this module.
export type { Profile };

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useProfile() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: profileQueryKey,
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
      await qc.cancelQueries({ queryKey: profileQueryKey });
      const prev = qc.getQueryData<Profile>(profileQueryKey);
      if (prev) {
        const newXP = Math.max(0, prev.xp + xpAmount);
        const newLevel = Math.floor(newXP / 500) + 1;
        qc.setQueryData<Profile>(profileQueryKey, {
          ...prev,
          xp: newXP,
          level: newLevel,
        });
      }
      return { prev };
    },
    onError: (_err, _xp, ctx) => {
      if (ctx?.prev) qc.setQueryData(profileQueryKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

/**
 * Update streak based on the current date.
 *
 * Logic:
 *  - streak_last_date === dateKey → no change
 *  - streak_last_date === yesterday → increment
 *  - else → reset to 1
 */
export function useUpdateStreak() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (dateKey: string): Promise<{ newStreak: number }> => {
      const profile = await getProfile();
      const lastDate = profile?.streak_last_date ?? null;
      let newStreak = profile?.streak_current ?? 0;

      if (lastDate !== dateKey) {
        const last = new Date(lastDate ?? "1970-01-01");
        const current = new Date(dateKey);
        const diffDays = Math.round(
          (current.getTime() - last.getTime()) / 86_400_000,
        );
        newStreak = diffDays === 1 ? newStreak + 1 : 1;
      }

      const newBest = Math.max(newStreak, profile?.streak_best ?? 0);
      await upsertProfile({
        streak_current: newStreak,
        streak_best: newBest,
        streak_last_date: dateKey,
      });
      return { newStreak };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileQueryKey });
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
  const userId = useAuthStore((s) => s.user?.id);
  const userEmail = useAuthStore((s) => s.user?.email);

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
      qc.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}
