import React from "react";
import { useRouter } from "expo-router";
import { Tutorial } from "../src/components/v2/onboarding/Tutorial";
import { useOnboardingStore } from "../src/stores/useOnboardingStore";

export default function TutorialScreen() {
  const router = useRouter();

  function handleComplete() {
    useOnboardingStore.getState().completeTutorial();
    router.replace("/(tabs)");
  }

  return <Tutorial onComplete={handleComplete} />;
}
