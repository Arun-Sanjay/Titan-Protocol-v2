import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts } from "../../../theme";
import { titanColors } from "../../../theme/colors";
import { getJSON, setJSON } from "../../../db/storage";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { IDENTITIES } from "../../../stores/useIdentityStore";
import { IDENTITY_LABELS } from "../../../stores/useModeStore";

const FIRST_LAUNCH_KEY = "first_launch_seen";

const ARCHETYPE_ICONS: Record<string, string> = {
  titan: "\u26A1", athlete: "\uD83D\uDCAA", scholar: "\uD83D\uDCDA", hustler: "\uD83D\uDCB0",
  showman: "\uD83C\uDFA4", warrior: "\u2694\uFE0F", founder: "\uD83D\uDE80", charmer: "\u2728",
};

type Props = {
  onComplete: () => void;
};

export function isFirstLaunchSeen(): boolean {
  return getJSON<boolean>(FIRST_LAUNCH_KEY, false);
}

export function markFirstLaunchSeen(): void {
  setJSON(FIRST_LAUNCH_KEY, true);
}

export function FirstLaunchCinematic({ onComplete }: Props) {
  const identity = useOnboardingStore((s) => s.identity);
  const meta = IDENTITIES.find((i) => i.id === identity);
  const isTitan = identity === "titan";
  const accentColor = isTitan ? titanColors.accent : colors.primary;

  // Animated values
  const iconScale = useSharedValue(0.5);
  const iconOpacity = useSharedValue(0);

  useEffect(() => {
    // Start animation sequence
    setTimeout(() => {
      iconScale.value = withTiming(1, { duration: 800 });
      iconOpacity.value = withTiming(1, { duration: 800 });
    }, 500);

    // Haptic at name reveal
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 1500);

    // Auto-complete after 6 seconds
    const timer = setTimeout(() => {
      markFirstLaunchSeen();
      onComplete();
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Archetype icon */}
      <Animated.Text style={[styles.icon, iconStyle]}>
        {ARCHETYPE_ICONS[identity ?? "titan"] ?? "\u26A1"}
      </Animated.Text>

      {/* Archetype name */}
      <Animated.Text
        entering={FadeIn.delay(1300).duration(800)}
        style={[styles.name, { color: accentColor }]}
      >
        {meta?.name ?? (identity ? IDENTITY_LABELS[identity] : "THE TITAN")}
      </Animated.Text>

      {/* Chapter 1 */}
      <Animated.Text
        entering={FadeIn.delay(2500).duration(800)}
        style={styles.chapter}
      >
        CHAPTER 1: THE AWAKENING
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text
        entering={FadeIn.delay(3800).duration(600)}
        style={[styles.tagline, isTitan && { color: titanColors.accent }]}
      >
        Your story begins now.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing.xl,
  },
  name: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  chapter: {
    ...fonts.kicker,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 3,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  tagline: {
    fontSize: 14,
    fontStyle: "italic",
    color: colors.textSecondary,
    textAlign: "center",
  },
});
