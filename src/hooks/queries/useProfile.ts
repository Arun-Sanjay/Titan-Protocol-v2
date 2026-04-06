/**
 * Phase 3.3b: Profile query hooks.
 *
 * React Query wrappers around src/services/profile.ts. These are the
 * ONLY way the UI reads or mutates the current user's profile after
 * Phase 3.3 — the old useProfileStore will be deprecated once every
 * consumer migrates.
 *
 * Conventions:
 *   - queryKey starts with the table name so invalidations can scope
 *     by domain (e.g. queryClient.invalidateQueries({ queryKey: ['profile'] })).
 *   - Mutations take the input types from src/services/profile.ts.
 *   - Mutations invalidate the profile query on success so all
 *     subscribers get the fresh data automatically.
 *   - awardXP returns the leveledUp + fromLevel/toLevel so the caller
 *     can enqueue a rank-up event (3.3f wires the overlay).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  awardXP,
  completeOnboarding,
  getProfile,
  updateProfile,
  updateStreak,
  type Profile,
  type ProfileUpdate,
  type AwardXPResult,
} from "../../services/profile";

export const profileQueryKey = ["profile"] as const;

/**
 * Fetch the current user's profile. Only runs if the user is signed in.
 * Returns `undefined` while loading, `null` if the profile row doesn't
 * exist yet (tiny race window after sign-up), and the profile once
 * loaded.
 */
export function useProfile() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<Profile | null>({
    queryKey: profileQueryKey,
    queryFn: getProfile,
    // Don't fire until we have an authenticated user — avoids a pointless
    // 401 on every app launch before the auth store hydrates.
    enabled: Boolean(userId),
  });
}

/**
 * Mutation: partial update of the current user's profile.
 * Optimistic: applies the update to the cache immediately, then rolls
 * back if the server rejects.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation<Profile, Error, ProfileUpdate, { previous: Profile | null }>({
    mutationFn: updateProfile,
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: profileQueryKey });
      const previous = queryClient.getQueryData<Profile | null>(profileQueryKey) ?? null;
      if (previous) {
        queryClient.setQueryData<Profile | null>(profileQueryKey, {
          ...previous,
          ...updates,
        } as Profile);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(profileQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

/**
 * Mutation: award XP to the current user. Returns an AwardXPResult so
 * the caller can react to a level-up (e.g. enqueue a rank-up event in
 * Phase 3.3f).
 */
export function useAwardXP() {
  const queryClient = useQueryClient();

  return useMutation<AwardXPResult, Error, number>({
    mutationFn: awardXP,
    onSuccess: (result) => {
      // Update the profile cache with the new xp/level directly — no
      // need to refetch.
      queryClient.setQueryData<Profile | null>(profileQueryKey, result.profile);
    },
  });
}

/**
 * Mutation: bump the user's streak for the given dateKey.
 */
export function useUpdateStreak() {
  const queryClient = useQueryClient();

  return useMutation<Profile, Error, string>({
    mutationFn: updateStreak,
    onSuccess: (profile) => {
      queryClient.setQueryData<Profile | null>(profileQueryKey, profile);
    },
  });
}

/**
 * Mutation: mark onboarding as completed and persist archetype + initial
 * profile fields. Used at the end of the onboarding cinematic.
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation<
    Profile,
    Error,
    Parameters<typeof completeOnboarding>[0]
  >({
    mutationFn: completeOnboarding,
    onSuccess: (profile) => {
      queryClient.setQueryData<Profile | null>(profileQueryKey, profile);
    },
  });
}
