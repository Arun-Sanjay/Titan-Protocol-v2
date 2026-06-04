import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  getProfile,
  upsertProfile,
  awardXP,
  updateStreak,
  type Profile,
} from "../../services/profile";
import { setJSON } from "../../db/storage";

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
        expo_push_token: null,
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
 * Backed by `services/profile.awardXP` which performs the read-modify-
 * write inside a SQLite transaction so concurrent awards never lose
 * XP or miss a rank-up event.
 *
 * Optimistic cache update is best-effort only — the authoritative
 * result comes from the service's transactional return value.
 */
export function useAwardXP() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (xpAmount: number) => awardXP(xpAmount),
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
 * Logic (in `services/profile.updateStreak`, atomic via transaction):
 *  - streak_last_date === dateKey → no change
 *  - streak_last_date === yesterday → increment
 *  - else → reset to 1
 */
export function useUpdateStreak() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (dateKey: string) => updateStreak(dateKey),
    onSuccess: (result) => {
      // Mirror the authoritative streak into the MMKV cache used by
      // `app/_layout.tsx` for the transmission context. The layout
      // sits above the QueryClientProvider so it can't read this value
      // via the hook; without this mirror it would stay at 0 forever
      // (CLAUDE.md §10 "Streak MMKV/SQLite duality" debt).
      setJSON("protocol_streak", result.newStreak);
      qc.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

/**
 * Persist a Settings mode change to the cloud profile so the next launch
 * (or a different device) reflects it. Without this hook the Settings
 * screen only updated the local Zustand mirror; the next sign-in
 * re-hydrated from the cloud and wiped the change.
 */
export function useUpdateProfileMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      mode: Profile["mode"];
      focus_engines?: Profile["focus_engines"];
    }) => {
      const updates: Partial<Profile> = { mode: vars.mode };
      if (vars.focus_engines !== undefined) {
        updates.focus_engines = vars.focus_engines;
      }
      await upsertProfile(updates);
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
