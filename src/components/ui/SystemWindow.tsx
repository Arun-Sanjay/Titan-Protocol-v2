/**
 * SystemWindow — Full-screen modal overlay for critical System events.
 *
 * Four visual types: info, quest, alert, reward. Each has a distinct border
 * color and triggers a matching haptic pattern on mount.
 *
 * Usage:
 *   <SystemWindow
 *     visible={showModal}
 *     type="reward"
 *     title="RANK ACHIEVED"
 *     onAction={() => setShowModal(false)}
 *   >
 *     <Text>You reached Operator rank.</Text>
 *   </SystemWindow>
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { colors, spacing, radius, fonts, shadows } from "../../theme";
import { playSystemPing, playWarning, playRewardChime } from "../../lib/sound";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SystemWindowType = "info" | "quest" | "alert" | "reward";

export type SystemWindowProps = {
  visible: boolean;
  type: SystemWindowType;
  title: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction: () => void;
  onDismiss?: () => void;
  accentColor?: string;
};

// ─── Border colors by type ───────────────────────────────────────────────────

const TYPE_BORDERS: Record<SystemWindowType, string> = {
  info: colors.surfaceBorderStrong,
  quest: colors.text,
  alert: colors.danger,
  reward: colors.success,
};

const TYPE_ICONS: Record<SystemWindowType, string> = {
  info: "\u26A1",     // lightning
  quest: "\u26A1",    // lightning
  alert: "\u26A0\uFE0F", // warning
  reward: "\u26A1",   // lightning
};

// ─── Haptic triggers by type ─────────────────────────────────────────────────

const TYPE_HAPTICS: Record<SystemWindowType, () => void> = {
  info: playSystemPing,
  quest: playSystemPing,
  alert: playWarning,
  reward: playRewardChime,
};

// ─── Dimensions ──────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PANEL_MAX_WIDTH = SCREEN_WIDTH * 0.85;

// ─── Component ───────────────────────────────────────────────────────────────

export function SystemWindow({
  visible,
  type,
  title,
  children,
  actionLabel = "ACKNOWLEDGED",
  onAction,
  onDismiss,
  accentColor,
}: SystemWindowProps) {
  const overlayOpacity = useSharedValue(0);
  const panelScale = useSharedValue(0.85);
  const panelOpacity = useSharedValue(0);

  const borderColor = accentColor ?? TYPE_BORDERS[type];
  const icon = TYPE_ICONS[type];

  // ── Mount / unmount animation ────────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      // Fire haptic
      TYPE_HAPTICS[type]();

      // Animate in
      overlayOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
      panelOpacity.value = withTiming(1, { duration: 200 });
      panelScale.value = withSpring(1, { damping: 15, stiffness: 200 });
    } else {
      // Animate out
      overlayOpacity.value = withTiming(0, { duration: 150 });
      panelOpacity.value = withTiming(0, { duration: 150 });
      panelScale.value = withTiming(0.9, { duration: 150 });
    }
  }, [visible]);

  // ── Animated styles ──────────────────────────────────────────────────────

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOpacity.value,
    transform: [{ scale: panelScale.value }],
  }));

  // ── Overlay tap ──────────────────────────────────────────────────────────

  function handleOverlayPress() {
    if (type === "info" && onDismiss) {
      onDismiss();
    }
  }

  if (!visible) return null;

  // ── Reward glow shadow ───────────────────────────────────────────────────

  const rewardGlow =
    type === "reward"
      ? shadows.glow
      : undefined;

  return (
    <View style={styles.root}>
      {/* Overlay */}
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleOverlayPress} />
      </Animated.View>

      {/* Panel */}
      <Animated.View
        style={[
          styles.panel,
          { borderColor, maxWidth: PANEL_MAX_WIDTH },
          rewardGlow,
          panelStyle,
        ]}
      >
        {/* Top accent line */}
        <View style={[styles.accentLine, { backgroundColor: borderColor }]} />

        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={[styles.titleIcon, { color: borderColor }]}>{icon}</Text>
          <Text style={[styles.titleText, { color: borderColor }]}>{title}</Text>
        </View>

        {/* Content */}
        <View style={styles.body}>{children}</View>

        {/* Action button */}
        <Pressable
          style={[styles.actionButton, { borderColor }]}
          onPress={onAction}
          android_ripple={{ color: "rgba(255,255,255,0.08)" }}
        >
          <Text style={[styles.actionLabel, { color: borderColor }]}>
            {actionLabel}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  panel: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  accentLine: {
    height: 2,
    width: "100%",
    opacity: 0.5,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  titleIcon: {
    fontSize: 16,
  },
  titleText: {
    fontFamily: fonts.mono?.fontFamily ?? "monospace",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  actionButton: {
    borderTopWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.md,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  actionLabel: {
    fontFamily: fonts.mono?.fontFamily ?? "monospace",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});
