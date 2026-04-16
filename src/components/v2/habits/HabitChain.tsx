import React, { useMemo } from "react";
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
import { useHabitLogsForRange } from "../../../hooks/queries/useHabits";

const CHAIN_DAYS = 14;
const DOT_SIZE = 10;

type Props = {
  habitId: string;
  engineColor?: string;
};

export function HabitChain({ habitId, engineColor = colors.success }: Props) {
  // Compute date range once per mount (14-day rolling window).
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

  const { data: logs = [] } = useHabitLogsForRange(startKey, endKey);

  const chain = useMemo(() => {
    const completedByDate = new Map<string, Set<string>>();
    for (const log of logs) {
      if (!completedByDate.has(log.date_key)) completedByDate.set(log.date_key, new Set());
      completedByDate.get(log.date_key)!.add(log.habit_id);
    }
    return dateKeys.map((dk, i) => ({
      dateKey: dk,
      completed: completedByDate.get(dk)?.has(habitId) ?? false,
      isToday: i === dateKeys.length - 1,
    }));
  }, [habitId, logs, dateKeys]);

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
