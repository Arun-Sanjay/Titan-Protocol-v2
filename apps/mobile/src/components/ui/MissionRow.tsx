import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, TOUCH_MIN, fonts, shadows } from "../../theme";
import type { EngineKey } from "../../db/schema";

const ENGINE_BORDER_COLORS: Record<EngineKey, string> = {
  body: "#00FF88",
  mind: "#A78BFA",
  money: "#FBBF24",
  charisma: "#60A5FA",
};

type Props = {
  title: string;
  xp: number;
  completed: boolean;
  kind: "main" | "secondary";
  engine?: EngineKey;
  onToggle: () => void;
  onDelete?: () => void;
  highlighted?: boolean;
};

export const MissionRow = React.memo(function MissionRow({ title, xp, completed, kind, engine, onToggle, onDelete, highlighted }: Props) {
  const translateX = useSharedValue(0);
  const checkScale = useSharedValue(completed ? 1 : 0);
  const cardScale = useSharedValue(1);

  // Flash green on highlight
  const flashOpacity = useSharedValue(0);
  useEffect(() => {
    if (highlighted) {
      flashOpacity.value = 0.25;
      flashOpacity.value = withTiming(0, { duration: 600 });
    }
  }, [highlighted]);
  const flashStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(0, 255, 136, ${flashOpacity.value})`,
  }));

  // XP popup animation values
  const xpPopupY = useSharedValue(0);
  const xpPopupOpacity = useSharedValue(0);
  const [showXpPopup, setShowXpPopup] = useState(false);

  React.useEffect(() => {
    checkScale.value = withTiming(completed ? 1 : 0, { duration: 300 });
  }, [completed]);

  const handleToggle = () => {
    const wasCompleted = completed;
    onToggle();

    if (!wasCompleted) {
      // Completing — show XP popup + card pulse
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowXpPopup(true);

      // Card pulse
      cardScale.value = withSequence(
        withTiming(1.02, { duration: 100 }),
        withTiming(1.0, { duration: 150 }),
      );

      // XP popup float up
      xpPopupY.value = 0;
      xpPopupOpacity.value = 1;
      xpPopupY.value = withTiming(-40, { duration: 800 });
      xpPopupOpacity.value = withDelay(400, withTiming(0, { duration: 400 }));

      // Hide popup after animation
      setTimeout(() => setShowXpPopup(false), 900);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
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

  const cardPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  const xpPopupStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: xpPopupY.value }],
    opacity: xpPopupOpacity.value,
  }));

  const borderColor = engine ? ENGINE_BORDER_COLORS[engine] : "rgba(255, 255, 255, 0.12)";

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={[styles.container, rowStyle, cardPulseStyle]}>
        {/* Green flash overlay on completion */}
        <Animated.View style={[styles.flashOverlay, flashStyle]} pointerEvents="none" />
        <Pressable
          onPress={handleToggle}
          style={[
            styles.row,
            completed && styles.rowDone,
            { borderLeftWidth: 3, borderLeftColor: borderColor },
          ]}
        >
          <View style={[styles.checkbox, completed && styles.checkboxDone]}>
            <Animated.View style={[styles.checkInner, checkStyle]} />
          </View>

          <View style={styles.content}>
            <Text style={[styles.title, completed && styles.titleDone]} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.kindLabel}>
                {kind === "main" ? "MISSION" : "SIDE QUEST"}
              </Text>
              {engine && (
                <>
                  <Text style={styles.metaSep}>{"\u00B7"}</Text>
                  <Text style={[styles.engineLabel, { color: ENGINE_BORDER_COLORS[engine] }]}>
                    {engine.toUpperCase()}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={[styles.xpBadge, completed && styles.xpBadgeDone]}>
            <Text style={[styles.xpText, completed && styles.xpTextDone]}>
              {completed ? "\u2713" : `+${xp} XP`}
            </Text>
          </View>
        </Pressable>

        {/* XP Popup Animation */}
        {showXpPopup && (
          <Animated.View style={[styles.xpPopup, xpPopupStyle]}>
            <Text style={[styles.xpPopupText, { color: engine ? ENGINE_BORDER_COLORS[engine] : colors.success }]}>
              +{xp} XP
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.md,
    zIndex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.84)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 11,
    paddingVertical: 10,
    minHeight: TOUCH_MIN,
    gap: spacing.md,
    ...shadows.card,
  },
  rowDone: {
    borderColor: colors.success + "20",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
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
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  kindLabel: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
  },
  metaSep: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
  },
  engineLabel: {
    ...fonts.kicker,
    fontSize: 9,
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
    fontSize: 11,
    color: colors.textSecondary,
  },
  xpTextDone: {
    color: colors.success,
  },
  // XP popup
  xpPopup: {
    position: "absolute",
    right: spacing.lg,
    top: -8,
    zIndex: 10,
  },
  xpPopupText: {
    ...fonts.mono,
    fontSize: 16,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 4,
  },
});
