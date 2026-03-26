import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, TOUCH_MIN, fonts, shadows } from "../../theme";

type Props = {
  title: string;
  xp: number;
  completed: boolean;
  kind: "main" | "secondary";
  onToggle: () => void;
  onDelete?: () => void;
};

export const MissionRow = React.memo(function MissionRow({ title, xp, completed, kind, onToggle, onDelete }: Props) {
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
        <Pressable onPress={handleToggle} style={[styles.row, completed && styles.rowDone]}>
          <View style={[styles.checkbox, completed && styles.checkboxDone]}>
            <Animated.View style={[styles.checkInner, checkStyle]} />
          </View>

          <View style={styles.content}>
            <Text style={[styles.title, completed && styles.titleDone]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.kindLabel}>
              {kind === "main" ? "MISSION" : "SIDE QUEST"}
            </Text>
          </View>

          <View style={[styles.xpBadge, completed && styles.xpBadgeDone]}>
            <Text style={[styles.xpText, completed && styles.xpTextDone]}>
              {completed ? "✓" : `+${xp}`}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.84)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 11,
    paddingVertical: 9,
    minHeight: TOUCH_MIN,
    gap: spacing.md,
    ...shadows.card,
  },
  rowDone: {
    borderColor: colors.success + "20",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  checkInner: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
  },
  titleDone: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  kindLabel: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
  },
  xpBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  xpBadgeDone: {
    backgroundColor: colors.successDim,
    borderColor: colors.success + "15",
  },
  xpText: {
    ...fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
  },
  xpTextDone: {
    color: colors.success,
  },
});
