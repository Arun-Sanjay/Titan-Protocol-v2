import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";
import { useAchievementStore, type AchievementDef, type AchievementRarity } from "../../stores/useAchievementStore";

const RARITY_COLORS: Record<AchievementRarity, string> = {
  common: "#6B7280",
  uncommon: "#A78BFA",
  rare: "#60A5FA",
  epic: "#FBBF24",
  legendary: "#F97316",
};

const RARITY_LABELS: Record<AchievementRarity, string> = {
  common: "COMMON",
  uncommon: "UNCOMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

/**
 * Achievement toast overlay — auto-shows when pendingCelebration exists.
 * Sits at the top of the screen with rarity-colored border.
 */
export function AchievementToast() {
  const pending = useAchievementStore((s) => s.pendingCelebration);
  const dismiss = useAchievementStore((s) => s.dismissCelebration);

  if (!pending) return null;
  return <AchievementToastInner achievement={pending} onDismiss={dismiss} />;
}

function AchievementToastInner({
  achievement,
  onDismiss,
}: {
  achievement: AchievementDef;
  onDismiss: () => void;
}) {
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const borderColor = RARITY_COLORS[achievement.rarity];

  useEffect(() => {
    Haptics.notificationAsync(
      achievement.rarity === "legendary" || achievement.rarity === "epic"
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );

    // Slide in
    translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
    opacity.value = withTiming(1, { duration: 300 });

    // Auto-dismiss after 4 seconds
    timer.current = setTimeout(() => {
      translateY.value = withTiming(-120, { duration: 300, easing: Easing.in(Easing.ease) });
      opacity.value = withTiming(0, { duration: 300 }, () => {
        runOnJS(onDismiss)();
      });
    }, 4000);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [achievement.id]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <Pressable onPress={onDismiss} style={[styles.card, { borderColor }]}>
        <View style={styles.header}>
          <Text style={[styles.rarityLabel, { color: borderColor }]}>
            {RARITY_LABELS[achievement.rarity]}
          </Text>
          <Text style={styles.xpBadge}>+{achievement.xpReward} XP</Text>
        </View>

        <View style={styles.body}>
          <Ionicons
            name={(achievement.iconName as any) || "trophy-outline"}
            size={28}
            color={borderColor}
            style={styles.icon}
          />
          <View style={styles.textContainer}>
            <Text style={styles.name}>{achievement.name}</Text>
            <Text style={styles.description}>{achievement.description}</Text>
          </View>
        </View>

        <View style={[styles.glowLine, { backgroundColor: borderColor }]} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    zIndex: 8000,
  },
  card: {
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  rarityLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },
  xpBadge: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
    color: colors.success,
  },
  body: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  glowLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.6,
  },
});
