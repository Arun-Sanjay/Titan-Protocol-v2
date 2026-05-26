import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing } from "../../theme";

type Props = {
  step: 1 | 2 | 3;
  total?: number;
  onSkip?: () => void;
  children: React.ReactNode;
};

/**
 * Shared chrome for the M5 onboarding wizard. Renders a step indicator
 * + "Skip All" link top-right; pushes children below.
 */
export function OnboardingChrome({ step, total = 3, onSkip, children }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.progress}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i + 1 === step ? styles.dotActive : null,
                i + 1 < step ? styles.dotDone : null,
              ]}
            />
          ))}
        </View>
        {onSkip && (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onSkip();
            }}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.skipLabel}>SKIP ALL</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  progress: { flexDirection: "row", gap: spacing.xs },
  dot: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  dotActive: { backgroundColor: colors.text },
  dotDone: { backgroundColor: colors.textMuted },
  skipLabel: {
    ...fonts.kicker,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 2,
  },
  body: { flex: 1 },
});
