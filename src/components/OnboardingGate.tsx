import React from "react";
import { useProfile } from "../hooks/queries/useProfile";
import { CinematicOnboarding } from "./v2/onboarding/CinematicOnboarding";

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
 * Cloud-only gating. The previous version OR'd in a local MMKV
 * `useOnboardingStore.completed` "fast-path" flag — but that flag was
 * a global, device-wide key, so user A completing onboarding and
 * signing out left the flag set, and user B's next sign-in skipped
 * the gate entirely and inherited A's local setup. SQLite is now
 * authoritative: it's a ~1ms read on cold start, so the fast-path
 * was theatre. Sign-out clears the local flag (`useAuthStore.signOut`)
 * as belt-and-suspenders.
 *
 * Design notes:
 *   - While the profile query is loading or missing, render children.
 *     The parent layout already shows the splash screen during initial
 *     load, so users see that instead of a flash of nothing.
 *   - If `profile.onboarding_completed` is false, render
 *     `CinematicOnboarding` and let it call `useCompleteOnboarding`
 *     on its own — that flips the cloud flag, the React Query cache
 *     updates, and this gate falls through to children on the next
 *     render.
 */
type Props = {
  children: React.ReactNode;
};

export function OnboardingGate({ children }: Props) {
  const { data: profile, isLoading } = useProfile();

  // Don't gate while the profile is loading — the parent layout's
  // splash is up, and gating now would flash the cinematic.
  if (isLoading || !profile) {
    return <>{children}</>;
  }

  if (profile.onboarding_completed) {
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
