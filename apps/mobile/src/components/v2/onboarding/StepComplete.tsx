import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { useModeStore, IDENTITY_LABELS } from "../../../stores/useModeStore";
import { useIdentityStore } from "../../../stores/useIdentityStore";

export function StepComplete() {
  const router = useRouter();
  const identity = useOnboardingStore((s) => s.identity);
  const mode = useOnboardingStore((s) => s.mode);
  const finish = useOnboardingStore((s) => s.finish);
  const setModeGlobal = useModeStore((s) => s.setMode);
  const setIdentityGlobal = useModeStore((s) => s.setIdentity);
  const selectIdentity = useIdentityStore((s) => s.selectIdentity);

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Persist identity and mode to their global stores
    if (identity) {
      setIdentityGlobal(identity);
      // Also save to the identity store (for weights, votes, etc.)
      selectIdentity(identity as any);
    }
    if (mode) setModeGlobal(mode);

    // Mark onboarding complete
    finish();

    // Navigate to the guided walkthrough
    router.replace("/walkthrough");
  };

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.checkmark}>{"\u2713"}</Text>
        <Text style={styles.title}>ONBOARDING COMPLETE</Text>
        {identity && (
          <Text style={styles.subtitle}>
            Welcome, {IDENTITY_LABELS[identity]}.
          </Text>
        )}
        <Text style={styles.body}>
          Now let's set up your engines, habits, and tools.{"\n"}
          This takes about 3 minutes.
        </Text>
      </View>

      <Pressable style={styles.btn} onPress={handleContinue}>
        <Text style={styles.btnText}>START SETUP</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingBottom: spacing["3xl"],
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  checkmark: {
    fontSize: 72, color: colors.success, marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28, fontWeight: "800", color: colors.text,
    letterSpacing: 2, marginBottom: spacing.md, textAlign: "center",
  },
  subtitle: {
    fontSize: 16, color: colors.textSecondary, marginBottom: spacing.md,
  },
  body: {
    fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20,
  },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.lg, alignItems: "center",
  },
  btnText: { ...fonts.kicker, fontSize: 13, color: "#000", letterSpacing: 2 },
});
