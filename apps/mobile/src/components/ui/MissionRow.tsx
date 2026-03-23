import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, TOUCH_MIN } from "../../theme";

type Props = {
  title: string;
  xp: number;
  completed: boolean;
  kind: "main" | "secondary";
  onToggle: () => void;
  onDelete?: () => void;
};

export function MissionRow({ title, xp, completed, kind, onToggle, onDelete }: Props) {
  const translateX = useSharedValue(0);
  const checkScale = useSharedValue(completed ? 1 : 0);

  React.useEffect(() => {
    checkScale.value = withTiming(completed ? 1 : 0, { duration: 300 });
  }, [completed]);

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggle();
  };

  const swipeGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationX > 0) {
        translateX.value = Math.min(e.translationX, 120);
      } else if (onDelete) {
        translateX.value = Math.max(e.translationX, -120);
      }
    })
    .onEnd((e) => {
      if (e.translationX > 80 && !completed) {
        runOnJS(handleToggle)();
      } else if (e.translationX < -80 && onDelete) {
        runOnJS(onDelete)();
      }
      translateX.value = withTiming(0, { duration: 200 });
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={[styles.container, rowStyle]}>
        <Pressable onPress={handleToggle} style={styles.row}>
          {/* Checkbox */}
          <View style={[styles.checkbox, completed && styles.checkboxDone]}>
            <Animated.View style={[styles.checkInner, checkStyle]} />
          </View>

          {/* Title */}
          <View style={styles.content}>
            <Text
              style={[
                styles.title,
                completed && styles.titleDone,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text style={styles.kindLabel}>
              {kind === "main" ? "MISSION" : "SIDE QUEST"}
            </Text>
          </View>

          {/* XP */}
          <View style={[styles.xpBadge, completed && styles.xpBadgeDone]}>
            <Text style={[styles.xpText, completed && styles.xpTextDone]}>
              {completed ? "✓" : `+${xp}`}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: TOUCH_MIN,
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: {
    borderColor: colors.success,
    backgroundColor: colors.successDim,
  },
  checkInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
  },
  titleDone: {
    color: colors.textSecondary,
    textDecorationLine: "line-through",
  },
  kindLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  xpBadge: {
    backgroundColor: colors.primaryDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  xpBadgeDone: {
    backgroundColor: colors.successDim,
  },
  xpText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  xpTextDone: {
    color: colors.success,
  },
});
