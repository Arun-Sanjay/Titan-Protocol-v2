/**
 * IntegrityWarningOverlay — Light, non-blocking overlay for 1-day miss.
 *
 * Shows a brief amber warning with voice, then auto-dismisses after 4 seconds.
 * Does NOT block the daily briefing — it shows on top briefly then goes away.
 */

import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import {
  playVoiceLineAsync,
  stopCurrentAudio,
  getFailureVoiceId,
} from "../../../lib/protocol-audio";

const AUTO_DISMISS_MS = 4000;
const AMBER = "#FBBF24";

type Props = {
  onDismiss: () => void;
};

export function IntegrityWarningOverlay({ onDismiss }: Props) {
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pulsing amber border
  const pulse = useSharedValue(0.3);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(251, 191, 36, ${pulse.value})`,
  }));

  // Play voice + haptic on mount, auto-dismiss
  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playVoiceLineAsync(getFailureVoiceId("WARNING"));

    autoCloseRef.current = setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);

    return () => {
      stopCurrentAudio();
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, []);

  const handleTap = () => {
    stopCurrentAudio();
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    onDismiss();
  };

  return (
    <Pressable style={styles.container} onPress={handleTap}>
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[styles.card, borderStyle]}
      >
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>INTEGRITY WARNING</Text>
        <Text style={styles.message}>
          You missed yesterday. Complete today to maintain your streak.
        </Text>
        <Text style={styles.tapHint}>TAP TO DISMISS</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    zIndex: 280, // Above briefing but below streak break cinematic
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },

  card: {
    width: "100%",
    backgroundColor: "rgba(251, 191, 36, 0.04)",
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },

  icon: {
    fontSize: 32,
  },

  title: {
    ...fonts.kicker,
    fontSize: 14,
    color: AMBER,
    letterSpacing: 3,
  },

  message: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: "center",
  },

  tapHint: {
    ...fonts.kicker,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 3,
    marginTop: spacing.sm,
  },
});
