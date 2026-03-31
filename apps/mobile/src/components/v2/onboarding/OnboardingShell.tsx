import React from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../../../theme";
import { HUDBackground } from "../../ui/AnimatedBackground";
import { useOnboardingStore, ONBOARDING_STEPS } from "../../../stores/useOnboardingStore";
import { StepWelcome } from "./StepWelcome";
import { StepIdentity } from "./StepIdentity";
import { StepGoals } from "./StepGoals";
import { StepMode } from "./StepMode";
import { StepEngines } from "./StepEngines";
import { StepSchedule } from "./StepSchedule";
import { StepPreview } from "./StepPreview";
import { StepReveal } from "./StepReveal";
import { StepComplete } from "./StepComplete";

// ─── Progress Dots ────────────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            i === current && dotStyles.dotActive,
            i < current && dotStyles.dotDone,
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: spacing.md },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  dotActive: { backgroundColor: colors.primary, width: 20 },
  dotDone: { backgroundColor: "rgba(255,255,255,0.40)" },
});

// ─── Shell ────────────────────────────────────────────────────────────────────

export function OnboardingShell() {
  const stepIndex = useOnboardingStore((s) => s.stepIndex);
  const next = useOnboardingStore((s) => s.next);
  const back = useOnboardingStore((s) => s.back);
  const setStepIndex = useOnboardingStore((s) => s.setStepIndex);

  const stepId = ONBOARDING_STEPS[stepIndex];

  const renderStep = () => {
    switch (stepId) {
      case "welcome":
        return <StepWelcome onNext={next} />;
      case "identity":
        return <StepIdentity onNext={next} onBack={back} />;
      case "reveal":
        return <StepReveal onNext={next} onBack={back} />;
      case "goals":
        return <StepGoals onNext={next} onBack={back} />;
      case "mode":
        return <StepMode onNext={next} onBack={back} />;
      case "engines":
        return <StepEngines onNext={next} onBack={back} />;
      case "schedule":
        return <StepSchedule onNext={next} onBack={back} />;
      case "preview":
        return <StepPreview onNext={next} onBack={back} goToStep={setStepIndex} />;
      case "complete":
        return <StepComplete />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <HUDBackground />
      {stepId !== "welcome" && stepId !== "complete" && (
        <ProgressDots current={stepIndex} total={ONBOARDING_STEPS.length} />
      )}
      <View style={styles.stepWrap}>{renderStep()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    zIndex: 100,
  },
  stepWrap: { flex: 1 },
});
