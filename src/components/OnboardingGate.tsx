import React from "react";
import { Redirect, useSegments } from "expo-router";
import { useProfile } from "../hooks/queries/useProfile";

/**
 * Phase 3.3b: Onboarding gate.
 *
 * Lives inside the signed-in render path (below QueryClientProvider)
 * so it can read the profile via React Query. Redirects to /onboarding
 * if the profile has not yet completed onboarding.
 *
 * Design notes:
 *   - Returns null while the profile query is loading. The parent
 *     layout already shows the splash screen during initial load, so
 *     users see that instead of a flash of nothing.
 *   - If the user is already inside /onboarding, we don't redirect
 *     them again (avoids a redirect loop on the onboarding screen
 *     itself).
 *   - If the profile query fails or returns null, we still render
 *     children. The old local-state onboarding flow takes over as a
 *     fallback — this keeps the migration risk-free.
 *   - Once the profile is loaded AND onboarding_completed is false,
 *     we redirect. The onboarding screen itself should call
 *     useCompleteOnboarding() at the end so the flag flips.
 */
type Props = {
  children: React.ReactNode;
};

export function OnboardingGate({ children }: Props) {
  const { data: profile, isLoading } = useProfile();
  const segments = useSegments();

  // Allow the onboarding/tutorial/walkthrough screens themselves to
  // render without a guard — otherwise we'd redirect them to themselves.
  const segment = segments[0];
  const inOnboardingFlow =
    segment === "onboarding" ||
    segment === "tutorial" ||
    segment === "walkthrough";

  // Don't redirect while the profile is loading or missing — avoids a
  // race on first app launch where the profile row might be 50ms behind
  // the auth event.
  if (isLoading || !profile) {
    return <>{children}</>;
  }

  if (!profile.onboarding_completed && !inOnboardingFlow) {
    return <Redirect href="/onboarding" />;
  }

  return <>{children}</>;
}
