import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { useOnboardingStore } from "../src/stores/useOnboardingStore";
import { OnboardingShell } from "../src/components/v2/onboarding/OnboardingShell";

// ─── Main onboarding screen ────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();

  // If already completed on mount, redirect to tabs
  useEffect(() => {
    if (useOnboardingStore.getState().completed) {
      router.replace("/(tabs)");
    }
  }, []);

  return <OnboardingShell />;
}
