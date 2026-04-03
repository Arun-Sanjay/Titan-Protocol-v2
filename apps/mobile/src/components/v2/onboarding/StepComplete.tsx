import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from "react-native-reanimated";
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

  // Checkmark scale animation
  const checkScale = useSharedValue(0);

  // Ambient glow pulse
  const glowOpacity = useSharedValue(0.06);

  useEffect(() => {
    // Checkmark: 0 -> 1.15 -> 1.0
    checkScale.value = withSequence(
      withTiming(1.15, { duration: 400, easing: Easing.out(Easing.cubic) }),
      withTiming(1.0, { duration: 200 }),
    );

    // Ambient glow pulse: 0.06 -> 0.15 -> 0.06, repeating
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.06, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // repeat indefinitely
      false,
    );
  }, [checkScale, glowOpacity]);

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

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
        <View style={styles.checkmarkContainer}>
          {/* Ambient glow */}
          <Animated.View style={[styles.ambientGlow, glowAnimatedStyle]} />
          {/* Checkmark */}
          <Animated.View style={checkAnimatedStyle}>
            <Text style={styles.checkmark}>{"\u2713"}</Text>
          </Animated.View>
        </View>
        <Animated.View entering={FadeInDown.delay(500).duration(500)}>
          <Text style={styles.title}>ONBOARDING COMPLETE</Text>
        </Animated.View>
        {identity && (
          <Animated.View entering={FadeIn.delay(800).duration(400)}>
            <Text style={styles.subtitle}>
              Welcome, {IDENTITY_LABELS[identity]}.
            </Text>
          </Animated.View>
        )}
        <Animated.View entering={FadeIn.delay(1000).duration(400)}>
          <Text style={styles.body}>
            Now let's set up your engines, habits, and tools.{"\n"}
            This takes about 3 minutes.
          </Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(1300).duration(400)}>
        <Pressable style={styles.btn} onPress={handleContinue}>
          <Text style={styles.btnText}>START SETUP</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingBottom: spacing["3xl"],
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  checkmarkContainer: {
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.xl,
    width: 120, height: 120,
  },
  ambientGlow: {
    position: "absolute",
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.success,
  },
  checkmark: {
    fontSize: 72, color: colors.success,
  },
  title: {
    fontSize: 28, fontWeight: "800", color: colors.text,
    letterSpacing: 2, marginBottom: spacing.md, textAlign: "center",
  },
  subtitle: {
    fontSize: 16, color: colors.textSecondary, marginBottom: spacing.md, textAlign: "center",
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
