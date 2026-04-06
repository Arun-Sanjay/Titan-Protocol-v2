/**
 * BossActivateCinematic — 3-2-1 countdown when user accepts a boss challenge.
 *
 * Heavy haptics on each count, "CHALLENGE ACTIVE" slam, auto-dismiss after 3s.
 */

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts } from "../../../theme";
import {
  playVoiceLineAsync,
  stopCurrentAudio,
  getBossActivateVoiceId,
} from "../../../lib/protocol-audio";

type Props = {
  bossTitle: string;
  onComplete: () => void;
};

export function BossActivateCinematic({ bossTitle, onComplete }: Props) {
  const [count, setCount] = useState(3);
  const [showActive, setShowActive] = useState(false);

  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // 3
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    scale.value = withSequence(
      withTiming(1.3, { duration: 150, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 250 }),
    );

    // 2
    timers.push(setTimeout(() => {
      setCount(2);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      scale.value = withSequence(
        withTiming(1.3, { duration: 150, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 250 }),
      );
    }, 1000));

    // 1
    timers.push(setTimeout(() => {
      setCount(1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      scale.value = withSequence(
        withTiming(1.3, { duration: 150, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 250 }),
      );
    }, 2000));

    // ACTIVE
    timers.push(setTimeout(() => {
      setShowActive(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playVoiceLineAsync(getBossActivateVoiceId());
    }, 3000));

    // Auto-dismiss
    timers.push(setTimeout(() => {
      stopCurrentAudio();
      onComplete();
    }, 6000));

    return () => {
      timers.forEach(clearTimeout);
      stopCurrentAudio();
    };
  }, []);

  return (
    <View style={styles.container}>
      {!showActive ? (
        <Animated.View style={[styles.countWrap, scaleStyle]}>
          <Text style={styles.countText}>{count}</Text>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(300)} style={styles.activeWrap}>
          <Text style={styles.activeLabel}>CHALLENGE ACTIVE</Text>
          <Text style={styles.bossName}>{bossTitle.toUpperCase()}</Text>
          <View style={styles.statusRow}>
            <View style={styles.activeDot} />
            <Text style={styles.statusText}>EVALUATING DAILY</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    zIndex: 260,
    justifyContent: "center",
    alignItems: "center",
  },
  countWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 80,
    fontWeight: "800",
    color: "#f87171",
    letterSpacing: 4,
  },
  activeWrap: {
    alignItems: "center",
    gap: spacing.lg,
  },
  activeLabel: {
    ...fonts.kicker,
    fontSize: 12,
    color: "#f87171",
    letterSpacing: 4,
  },
  bossName: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 3,
    textAlign: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f87171",
  },
  statusText: {
    ...fonts.kicker,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
  },
});
