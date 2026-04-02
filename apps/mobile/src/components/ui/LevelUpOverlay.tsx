import React, { useEffect, useCallback } from "react";
import { StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  FadeIn,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  newLevel: number;
  onDismiss: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LevelUpOverlay({ newLevel, onDismiss }: Props) {
  const flashOpacity = useSharedValue(0);

  const dismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    // Haptic on mount
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // White flash: 0 -> 1 instantly, hold 100ms, fade out 300ms
    flashOpacity.value = withSequence(
      withTiming(0.85, { duration: 30 }),
      withDelay(100, withTiming(0, { duration: 300 })),
    );

    // Auto-dismiss after 4 seconds
    const timer = setTimeout(dismiss, 4000);
    return () => clearTimeout(timer);
  }, [dismiss, flashOpacity]);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  return (
    <Pressable style={styles.container} onPress={dismiss}>
      {/* White flash overlay */}
      <Animated.View style={[styles.flash, flashStyle]} pointerEvents="none" />

      {/* LEVEL UP text */}
      <Animated.Text
        entering={FadeIn.delay(200).duration(600)}
        style={styles.levelUpText}
      >
        LEVEL UP
      </Animated.Text>

      {/* Level number */}
      <Animated.Text
        entering={FadeIn.delay(500).duration(600)}
        style={styles.levelNumber}
      >
        LEVEL {newLevel}
      </Animated.Text>

      {/* Tap to dismiss hint */}
      <Animated.Text
        entering={FadeIn.delay(1200).duration(500)}
        style={styles.dismissHint}
      >
        TAP TO CONTINUE
      </Animated.Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 300,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
  },
  levelUpText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FBBF24",
    letterSpacing: 6,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  levelNumber: {
    fontSize: 48,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  dismissHint: {
    position: "absolute",
    bottom: 80,
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
});
