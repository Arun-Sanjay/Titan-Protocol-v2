import React, { useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { OnboardingChrome } from "../../src/components/ui/OnboardingChrome";
import { useOnboardingStore } from "../../src/stores/useOnboardingStore";
import { colors, fonts, radius, spacing } from "../../src/theme";

export default function OnboardingStep1() {
  const router = useRouter();
  const finish = useOnboardingStore((s) => s.finish);

  const handleSkip = useCallback(() => {
    finish();
    router.replace("/(tabs)");
  }, [finish, router]);

  const handleContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(onboarding)/step-2");
  }, [router]);

  return (
    <OnboardingChrome step={1} onSkip={handleSkip}>
      <View style={styles.body}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.heroBlock}>
          <Text style={styles.kicker}>TITAN PROTOCOL</Text>
          <Text style={styles.title}>Welcome, operator.</Text>
          <Text style={styles.body_text}>
            Your personal OS for relentless execution. Four engines, one
            daily score, synced across every device you sign in on.
          </Text>
        </Animated.View>

        <View style={styles.footer}>
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.ctaText}>CONTINUE</Text>
          </Pressable>
        </View>
      </View>
    </OnboardingChrome>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: spacing.xl, justifyContent: "space-between" },
  heroBlock: { marginTop: spacing["4xl"], gap: spacing.md },
  kicker: { ...fonts.kicker, color: colors.textSecondary, letterSpacing: 2 },
  title: { ...fonts.title, fontSize: 34, letterSpacing: -0.5 },
  body_text: {
    ...fonts.body,
    color: colors.textSecondary,
    lineHeight: 24,
    fontSize: 16,
    marginTop: spacing.md,
  },
  footer: { marginBottom: spacing.xl },
  cta: {
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  ctaText: { ...fonts.kicker, color: colors.bg, fontSize: 13, letterSpacing: 2 },
  pressed: { opacity: 0.7 },
});
