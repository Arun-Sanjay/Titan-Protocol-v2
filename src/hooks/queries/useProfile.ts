import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import { supabase } from "../../lib/supabase";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const profileQueryKey = ["profile"] as const;

// ─── Types ─────────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  xp: number;
  level: number;
  streak_current: number;
  streak_best: number;
  streak_last_date: string | null;
  first_use_date: string | null;
  onboarding_completed: boolean;
  tutorial_completed: boolean;
  display_name: string | null;
  archetype: string | null;
  mode: string;
  focus_engines: string[];
  created_at: string;
  updated_at: string;
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useProfile() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: profileQueryKey,
    queryFn: async (): Promise<Profile> => {
      // maybeSingle: returns null rather than erroring when the row
      // hasn't been created yet (new signup, trigger race, etc.).
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (data) return data as Profile;

      return {
        id: userId ?? "",
        xp: 0,
        level: 1,
        streak_current: 0,
        streak_best: 0,
        streak_last_date: null,
        first_use_date: null,
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
      const { data: profile, error: fetchErr } = await supabase
        .from("profiles")
        .select("xp, level")
        .single();
      if (fetchErr) throw fetchErr;

      const oldXP = profile.xp ?? 0;
      const oldLevel = profile.level ?? 1;
      const newXP = Math.max(0, oldXP + xpAmount);
      const newLevel = Math.floor(newXP / 500) + 1;

      const userId = (await supabase.auth.getUser()).data.user!.id;
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ xp: newXP, level: newLevel })
        .eq("id", userId);
      if (updateErr) throw updateErr;

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
 * - If streak_last_date === dateKey → no change (already counted today)
 * - If streak_last_date === yesterday → increment streak
 * - Otherwise → reset to 1 (new streak started)
 *
 * Uses profiles.streak_last_date (not last_active_date).
 */
export function useUpdateStreak() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (dateKey: string): Promise<{ newStreak: number }> => {
      const { data: profile, error: fetchErr } = await supabase
        .from("profiles")
        .select("streak_current, streak_best, streak_last_date")
        .single();
      if (fetchErr) throw fetchErr;

      const lastDate = profile.streak_last_date;
      let newStreak = profile.streak_current ?? 0;

      if (lastDate !== dateKey) {
        const last = new Date(lastDate ?? "1970-01-01");
        const current = new Date(dateKey);
        const diffMs = current.getTime() - last.getTime();
        const diffDays = Math.round(diffMs / 86_400_000);
        newStreak = diffDays === 1 ? newStreak + 1 : 1;
      }

      const newBest = Math.max(newStreak, profile.streak_best ?? 0);
      const userId = (await supabase.auth.getUser()).data.user!.id;

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          streak_current: newStreak,
          streak_best: newBest,
          streak_last_date: dateKey,
        })
        .eq("id", userId);
      if (updateErr) throw updateErr;

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
      const payload: Record<string, unknown> = {
        id: userId,
        email: userEmail ?? null,
        onboarding_completed: true,
      };
      if (data?.archetype) payload.archetype = data.archetype;
      if (data?.display_name !== undefined)
        payload.display_name = data.display_name;
      if (data?.mode) payload.mode = data.mode;
      if (data?.focus_engines) payload.focus_engines = data.focus_engines;
      if (data?.first_use_date) payload.first_use_date = data.first_use_date;

      const { error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}
