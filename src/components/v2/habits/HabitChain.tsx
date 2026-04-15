import React, { useEffect, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { colors, spacing } from "../../../theme";
import { useHabitStore } from "../../../stores/useHabitStore";

const CHAIN_DAYS = 14;
const DOT_SIZE = 10;

type Props = {
  habitId: number;
  engineColor?: string;
};

export function HabitChain({ habitId, engineColor = colors.success }: Props) {
  // Phase 2.3F: read from store cache (warmed below) instead of doing
  // 14 MMKV reads per habit on every render. With N habits on the track
  // screen this dropped 14N disk operations to 14 (one shared warmup).
  const completedIds = useHabitStore((s) => s.completedIds);
  const loadDateRange = useHabitStore((s) => s.loadDateRange);

  // Compute date range once per render (depends only on Date.now()/14d window).
  const { startKey, endKey, dateKeys } = useMemo(() => {
    const today = new Date();
    const dks: string[] = [];
    for (let i = CHAIN_DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dks.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    return { startKey: dks[0], endKey: dks[dks.length - 1], dateKeys: dks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warm the store cache for the visible window once on mount.
  useEffect(() => {
    loadDateRange(startKey, endKey);
  }, [startKey, endKey, loadDateRange]);

  // Build the 14-day chain from the cache (zero MMKV reads in render).
  const chain = useMemo(() => {
    return dateKeys.map((dk, i) => {
      const ids = completedIds[dk] ?? [];
      return {
        dateKey: dk,
        completed: ids.includes(habitId),
        isToday: i === dateKeys.length - 1,
      };
    });
  }, [habitId, completedIds, dateKeys]);

  return (
    <View style={styles.container}>
      {chain.map((cell, idx) => (
        <ChainDot
          key={cell.dateKey}
          completed={cell.completed}
          isToday={cell.isToday}
          color={engineColor}
        />
      ))}
    </View>
  );
}

function ChainDot({ completed, isToday, color }: { completed: boolean; isToday: boolean; color: string }) {
  // Pulse animation for today's dot
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    if (isToday && !completed) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
    return () => {
      // Phase 2.1A: cancel infinite pulse on unmount. HabitChain renders
      // 14 ChainDots per habit, and the habits list can have 20+ habits,
      // so leaking these adds up fast.
      cancelAnimation(pulse);
    };
  }, [isToday, completed]);

  const animStyle = useAnimatedStyle(() => ({
    transform: isToday && !completed ? [{ scale: pulse.value }] : [],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        completed && { backgroundColor: color },
        !completed && styles.dotEmpty,
        isToday && !completed && styles.dotToday,
        animStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: "transparent",
  },
  dotEmpty: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  dotToday: {
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.30)",
    backgroundColor: "transparent",
  },
});
