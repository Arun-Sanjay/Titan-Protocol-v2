import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { useOnboardingStore, ONBOARDING_STEPS } from "../src/stores/useOnboardingStore";
import { OnboardingShell } from "../src/components/v2/onboarding/OnboardingShell";
import { StepWelcome } from "../src/components/v2/onboarding/StepWelcome";
import { StepIdentity } from "../src/components/v2/onboarding/StepIdentity";
import { StepMode } from "../src/components/v2/onboarding/StepMode";
import { StepEngines } from "../src/components/v2/onboarding/StepEngines";
import { StepSchedule } from "../src/components/v2/onboarding/StepSchedule";
import { StepComplete } from "../src/components/v2/onboarding/StepComplete";

// ─── Step component map ─────────────────────────────────────────────────────

const STEP_COMPONENTS: Record<string, React.FC> = {
  welcome: StepWelcome,
  identity: StepIdentity,
  mode: StepMode,
  engines: StepEngines,
  schedule: StepSchedule,
  first_protocol: StepComplete,
};

// ─── Main onboarding screen ────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const stepKey = ONBOARDING_STEPS[currentStep];

  // If already completed on mount, redirect to tabs
  useEffect(() => {
    if (useOnboardingStore.getState().completed) {
      router.replace("/(tabs)");
    }
  }, []);

  const StepComponent = STEP_COMPONENTS[stepKey];

  return (
    <OnboardingShell>
      {StepComponent ? <StepComponent /> : null}
    </OnboardingShell>
  );
}
