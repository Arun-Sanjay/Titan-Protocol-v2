import React from "react";
import { useProfile } from "../hooks/queries/useProfile";
import { CinematicOnboarding } from "./v2/onboarding/CinematicOnboarding";
import { useOnboardingStore } from "../stores/useOnboardingStore";

/**
 * Phase 3.1: Onboarding gate (redesigned in Phase 3.1 of the v1
 * launch plan).
 *
 * Lives inside the signed-in render path (below QueryClientProvider)
 * so it can read the profile via React Query. When the cloud profile
 * has `onboarding_completed = false`, this component renders the
 * `CinematicOnboarding` flow INLINE instead of redirecting to
 * `/onboarding` — the legacy redirect target was the dead `OnboardingShell`
 * (Step* flow) that was deleted in Phase 3.4.
 *
 * The previous design had a structural bug: a new user could see BOTH
 * the inline `CinematicOnboarding` overlay (gated on MMKV state) AND
 * the legacy `OnboardingShell` route at the same time, because the two
 * gates were independent. Collapsing both into a single gate fixes
 * that.
 *
 * Design notes:
 *   - While the profile query is loading or missing, render children.
 *     The parent layout already shows the splash screen during initial
 *     load, so users see that instead of a flash of nothing.
 *   - If profile.onboarding_completed is false, render
 *     `CinematicOnboarding` and let it call `useCompleteOnboarding`
 *     on its own — that flips the cloud flag, the React Query cache
 *     updates, and this gate falls through to children on the next
 *     render.
 *   - The local MMKV `useOnboardingStore.completed` flag is still
 *     respected as a fast-path: if it's true (set by a previous
 *     run on the same device) we let the user through immediately
 *     even if the cloud query hasn't refetched yet.
 */
type Props = {
  children: React.ReactNode;
};

export function OnboardingGate({ children }: Props) {
  const { data: profile, isLoading } = useProfile();
  const localCompleted = useOnboardingStore((s) => s.completed);

  // Don't gate while the profile is loading — the parent layout's
  // splash is up, and gating now would flash the cinematic.
  if (isLoading || !profile) {
    return <>{children}</>;
  }

  // Cloud is authoritative, but the local MMKV mirror is a fast-path
  // so users who completed onboarding on this device get through
  // even if the cloud query is in flight.
  if (profile.onboarding_completed || localCompleted) {
    return <>{children}</>;
  }

  return (
    <CinematicOnboarding
      onComplete={() => {
        // No-op: CinematicOnboarding writes the local + cloud flags
        // itself; this gate will re-render and pass through children
        // when React Query refetches profile.
      }}
    />
  );
}
