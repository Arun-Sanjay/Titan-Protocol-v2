import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors, spacing, radius } from "../../theme";
import { getRankForLevel, xpForLevel } from "../../db/gamification";

type Props = {
  xp: number;
  level: number;
};

export function XPBar({ xp, level }: Props) {
  const rank = getRankForLevel(level);
  const currentLevelXP = xp - (level - 1) * 500;
  const needed = 500;
  const fraction = Math.min(1, currentLevelXP / needed);

  const barWidth = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withTiming(fraction, {
      duration: 1000,
      easing: Easing.bezierFn(0.25, 0.1, 0.25, 1),
    });
  }, [fraction]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%` as any,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.rank, { color: rank.color }]}>
          Level {level} — {rank.name.toUpperCase()}
        </Text>
        <Text style={styles.xpText}>{xp.toLocaleString()} XP</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  rank: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
  xpText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  track: {
    height: 6,
    backgroundColor: colors.surfaceBorder,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
});
