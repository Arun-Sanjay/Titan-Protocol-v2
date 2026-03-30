import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../../../theme";
import type { SkillNodeStatus } from "../../../stores/useSkillTreeStore";

type Props = {
  status: SkillNodeStatus;
  name: string;
  level: number;
  engineColor: string;
  progress?: number; // 0-100 for in_progress
};

const NODE_SIZE = 24;

export function SkillNode({ status, name, level, engineColor, progress }: Props) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (status === "in_progress") {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
  }, [status]);

  const animStyle = useAnimatedStyle(() => ({
    transform: status === "in_progress" ? [{ scale: pulse.value }] : [],
  }));

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.node,
          status === "locked" && styles.nodeLocked,
          status === "in_progress" && { backgroundColor: engineColor + "4D", borderColor: engineColor },
          status === "completed" && { backgroundColor: engineColor, borderColor: engineColor },
          animStyle,
        ]}
      >
        {status === "locked" && (
          <Ionicons name="lock-closed" size={10} color={colors.textMuted} />
        )}
        {status === "completed" && (
          <Ionicons name="checkmark" size={14} color={colors.bg} />
        )}
        {status === "in_progress" && (
          <Text style={[styles.levelText, { color: engineColor }]}>{level}</Text>
        )}
      </Animated.View>
      <Text
        style={[
          styles.name,
          status === "completed" && { color: engineColor },
          status === "locked" && styles.nameLocked,
        ]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 4,
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  nodeLocked: {
    backgroundColor: "rgba(107, 114, 128, 0.10)",
    borderColor: "rgba(107, 114, 128, 0.30)",
  },
  levelText: {
    fontSize: 10,
    fontWeight: "700",
  },
  name: {
    fontSize: 9,
    fontWeight: "500",
    color: colors.textSecondary,
    maxWidth: 60,
    textAlign: "center",
  },
  nameLocked: {
    color: colors.textMuted,
    opacity: 0.5,
  },
});
