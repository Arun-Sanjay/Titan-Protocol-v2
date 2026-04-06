import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors, spacing } from "../../../theme";
import { getJSON } from "../../../db/storage";
import { useHabitStore } from "../../../stores/useHabitStore";

const CHAIN_DAYS = 14;
const DOT_SIZE = 10;

type Props = {
  habitId: number;
  engineColor?: string;
};

export function HabitChain({ habitId, engineColor = colors.success }: Props) {
  // Subscribe to completedIds so chain updates when habits are toggled
  const completedIds = useHabitStore((s) => s.completedIds);

  // Build 14-day chain data
  const chain = useMemo(() => {
    const cells: { dateKey: string; completed: boolean; isToday: boolean }[] = [];
    for (let i = CHAIN_DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const logs = getJSON<number[]>(`habit_logs:${dk}`, []);
      cells.push({ dateKey: dk, completed: logs.includes(habitId), isToday: i === 0 });
    }
    return cells;
  }, [habitId, completedIds]);

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
