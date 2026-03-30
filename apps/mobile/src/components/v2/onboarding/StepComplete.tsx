import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { useModeStore, IDENTITY_LABELS } from "../../../stores/useModeStore";

export function StepComplete() {
  const identity = useOnboardingStore((s) => s.identity);
  const mode = useOnboardingStore((s) => s.mode);
  const finish = useOnboardingStore((s) => s.finish);
  const setModeGlobal = useModeStore((s) => s.setMode);
  const setIdentityGlobal = useModeStore((s) => s.setIdentity);

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Persist identity and mode to their global stores
    if (identity) setIdentityGlobal(identity);
    if (mode) setModeGlobal(mode);

    // Mark onboarding complete — this removes the overlay
    finish();
  };

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.title}>YOU'RE READY</Text>
        {identity && (
          <Text style={styles.subtitle}>
            Welcome, {IDENTITY_LABELS[identity]}.
          </Text>
        )}
        <Text style={styles.body}>
          Your Titan Protocol is configured and ready to go.{"\n"}
          Start your first day by completing some missions.
        </Text>
      </View>

      <Pressable style={styles.btn} onPress={handleFinish}>
        <Text style={styles.btnText}>LET'S GO</Text>
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
    fontSize: 32, fontWeight: "800", color: colors.text,
    letterSpacing: 2, marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: 16, color: colors.textSecondary, marginBottom: spacing.md,
  },
  body: {
    fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20,
  },
  btn: {
    backgroundColor: colors.success, borderRadius: radius.md,
    paddingVertical: spacing.lg, alignItems: "center",
  },
  btnText: { ...fonts.kicker, fontSize: 13, color: "#000", letterSpacing: 2 },
});
