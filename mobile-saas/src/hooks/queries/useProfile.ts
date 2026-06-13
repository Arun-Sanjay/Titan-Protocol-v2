import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  getProfile,
  upsertProfile,
  awardXP,
  type Profile,
} from "../../services/profile";
import { settleStreaks } from "../../services/xp";
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
        xp: 0,
        level: 1,
        streak_current: 0,
        streak_best: 0,
        streak_last_date: null,
        first_use_date: null,
        first_task_completed_at: null,
        onboarding_completed: false,
        tutorial_completed: false,
        trial_started_at: null,
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
 * Consistency-based streak settlement — the single streak authority.
 *
 * Replaces the old "active-yesterday" streak. `settleStreaks()` folds each
 * past, unsettled day's Titan score into the streak: a day >= 60% continues it
 * (+1), a day below (or a missed day) resets it to 0. Fired once per app-open
 * by `StreakSettlementGate`; idempotent (only advances past streak_last_date,
 * never settles today). Mirrors web's `useSettleStreaks`.
 */
export function useSettleStreaks() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => settleStreaks(),
    onSuccess: (result) => {
      // Mirror the authoritative streak into the MMKV cache the boss /
      // protocol-integrity layer reads (`lib/protocol-integrity.ts`'s
      // `protocol_streak` evaluator). That layer sits above the
      // QueryClientProvider so it can't read this value via the hook.
      if (result) setJSON("protocol_streak", result.streak);
      qc.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

/**
 * Generic profile-update mutation. Merge-updates the cloud profile row and
 * refreshes the profile query. Used by the trial/paywall flow to stamp
 * `trial_started_at`. Mirrors web's `useUpdateProfile`.
 */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<Omit<Profile, "id" | "created_at">>) =>
      upsertProfile(updates),
    onSuccess: () => {
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
