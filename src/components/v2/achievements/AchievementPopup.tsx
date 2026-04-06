import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  SlideInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fonts } from "../../../theme";
import type { AchievementDef, AchievementRarity } from "../../../stores/useAchievementStore";
import { ShareButton } from "../celebrations/ShareButton";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Props = {
  achievement: AchievementDef;
  onDismiss: () => void;
};

const RARITY_CONFIG: Record<AchievementRarity, {
  label: string;
  color: string;
  bgColor: string;
  haptic: () => void;
  autoDismiss: number | null; // ms, null = manual dismiss
  presentation: "bottom" | "center" | "fullscreen";
}> = {
  common: {
    label: "COMMON",
    color: "#9CA3AF",
    bgColor: "rgba(156, 163, 175, 0.08)",
    haptic: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    autoDismiss: 2000,
    presentation: "bottom",
  },
  uncommon: {
    label: "UNCOMMON",
    color: "#60A5FA",
    bgColor: "rgba(96, 165, 250, 0.08)",
    haptic: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    autoDismiss: null,
    presentation: "center",
  },
  rare: {
    label: "RARE",
    color: "#FBBF24",
    bgColor: "rgba(251, 191, 36, 0.06)",
    haptic: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    autoDismiss: null,
    presentation: "fullscreen",
  },
  epic: {
    label: "EPIC",
    color: "#A78BFA",
    bgColor: "rgba(167, 139, 250, 0.06)",
    haptic: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 300);
    },
    autoDismiss: null,
    presentation: "fullscreen",
  },
  legendary: {
    label: "LEGENDARY",
    color: "#FFD700",
    bgColor: "rgba(255, 215, 0, 0.06)",
    haptic: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 400);
    },
    autoDismiss: null,
    presentation: "fullscreen",
  },
};

export function AchievementPopup({ achievement, onDismiss }: Props) {
  const config = RARITY_CONFIG[achievement.rarity];
  const nameScale = useSharedValue(0);

  useEffect(() => {
    config.haptic();
    nameScale.value = withDelay(300, withSpring(1, { damping: 8, stiffness: 200 }));

    if (config.autoDismiss) {
      const timer = setTimeout(onDismiss, config.autoDismiss);
      return () => clearTimeout(timer);
    }
  }, []);

  const nameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nameScale.value }],
  }));

  // Bottom toast (Common)
  if (config.presentation === "bottom") {
    return (
      <Animated.View entering={SlideInDown.duration(300)} exiting={FadeOut.duration(200)} style={styles.bottomToast}>
        <Ionicons name={achievement.iconName as keyof typeof Ionicons.glyphMap} size={20} color={config.color} />
        <View style={styles.bottomText}>
          <Text style={[styles.bottomName, { color: config.color }]}>{achievement.name}</Text>
          <Text style={styles.bottomDesc}>{achievement.description}</Text>
        </View>
        <Text style={[styles.xpBadge, { color: config.color }]}>+{achievement.xpReward} XP</Text>
      </Animated.View>
    );
  }

  // Center card (Uncommon)
  if (config.presentation === "center") {
    return (
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.centerCard}>
          <Text style={[styles.rarityBadge, { color: config.color }]}>{config.label}</Text>
          <Ionicons name={achievement.iconName as keyof typeof Ionicons.glyphMap} size={36} color={config.color} />
          <Animated.Text style={[styles.centerName, { color: config.color }, nameStyle]}>
            {achievement.name}
          </Animated.Text>
          <Text style={styles.centerDesc}>{achievement.description}</Text>
          <Text style={[styles.centerXP, { color: config.color }]}>+{achievement.xpReward} XP</Text>
          <Text style={styles.tapHint}>Tap to dismiss</Text>
        </Animated.View>
      </Pressable>
    );
  }

  // Fullscreen (Rare/Epic/Legendary)
  return (
    <View style={[styles.fullscreen, { backgroundColor: config.bgColor }]}>
      <View style={styles.fullscreenCenter}>
        <Animated.Text entering={FadeIn.delay(500).duration(400)} style={[styles.rarityLabel, { color: config.color }]}>
          {config.label}
        </Animated.Text>

        <Animated.View entering={FadeInUp.delay(700).duration(400)}>
          <Ionicons name={achievement.iconName as keyof typeof Ionicons.glyphMap} size={56} color={config.color} />
        </Animated.View>

        <Animated.Text style={[styles.fullscreenName, { color: config.color }, nameStyle]}>
          {achievement.name}
        </Animated.Text>

        <Animated.Text entering={FadeIn.delay(1000).duration(400)} style={styles.fullscreenDesc}>
          {achievement.description}
        </Animated.Text>

        <Animated.Text entering={FadeIn.delay(1200).duration(400)} style={[styles.fullscreenXP, { color: config.color }]}>
          +{achievement.xpReward} XP
        </Animated.Text>
      </View>

      <Animated.View entering={FadeIn.delay(1500).duration(400)}>
        <Pressable style={[styles.claimBtn, { backgroundColor: config.color }]} onPress={onDismiss}>
          <Text style={styles.claimText}>
            {achievement.rarity === "legendary" ? "CLAIM" : "DISMISS"}
          </Text>
        </Pressable>
        {(achievement.rarity === "epic" || achievement.rarity === "legendary") && (
          <ShareButton
            type="achievement"
            title={achievement.name}
            subtitle={achievement.description}
            rarity={achievement.rarity}
            value={`+${achievement.xpReward} XP`}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Bottom toast
  bottomToast: {
    position: "absolute",
    bottom: 100,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  bottomText: { flex: 1, gap: 2 },
  bottomName: { fontSize: 14, fontWeight: "700" },
  bottomDesc: { fontSize: 11, color: colors.textMuted },
  xpBadge: { ...fonts.mono, fontSize: 12, fontWeight: "700" },

  // Center card
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing["2xl"],
  },
  centerCard: {
    backgroundColor: colors.bg,
    borderRadius: 16,
    padding: spacing["2xl"],
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    width: "100%",
  },
  rarityBadge: { fontSize: 10, fontWeight: "700", letterSpacing: 3 },
  centerName: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  centerDesc: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
  centerXP: { ...fonts.mono, fontSize: 16, fontWeight: "700" },
  tapHint: { fontSize: 11, color: colors.textMuted, marginTop: spacing.md },

  // Fullscreen
  fullscreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing["2xl"],
  },
  fullscreenCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xl,
  },
  rarityLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 4 },
  fullscreenName: { fontSize: 24, fontWeight: "800", textAlign: "center", letterSpacing: 1 },
  fullscreenDesc: { fontSize: 15, color: colors.textSecondary, textAlign: "center", lineHeight: 24 },
  fullscreenXP: { ...fonts.mono, fontSize: 20, fontWeight: "700" },
  claimBtn: {
    paddingVertical: spacing.lg,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: spacing["3xl"],
  },
  claimText: { fontSize: 16, fontWeight: "700", color: colors.bg, letterSpacing: 3 },
});
