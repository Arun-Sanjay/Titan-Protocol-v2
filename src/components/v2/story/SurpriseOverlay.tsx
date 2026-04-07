/**
 * SurpriseOverlay — Full-screen overlay for random Protocol events.
 *
 * Displays with voice playback, haptic feedback, and staggered animations.
 * Actionable surprises (Emergency Op, Bonus Challenge, Double XP) show
 * Accept/Dismiss buttons. Passive surprises (Transmissions) auto-dismiss.
 */

import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { playVoiceLineAsync, stopCurrentAudio } from "../../../lib/protocol-audio";
import type { Surprise } from "../../../lib/surprise-engine";

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 6000; // Passive transmissions auto-dismiss after 6s

const TYPE_COLORS: Record<string, string> = {
  EMERGENCY_OP: "#f87171",      // red
  BONUS_CHALLENGE: "#FBBF24",   // gold
  PROTOCOL_TRANSMISSION: "#60A5FA", // blue
  DOUBLE_XP_WINDOW: "#A78BFA",  // purple
};

const TYPE_ICONS: Record<string, string> = {
  EMERGENCY_OP: "⚠️",
  BONUS_CHALLENGE: "⚡",
  PROTOCOL_TRANSMISSION: "📡",
  DOUBLE_XP_WINDOW: "🔥",
};

// ─── Component ───��────────────────────────────────��───────────────────────────

type Props = {
  surprise: Surprise;
  onAccept: () => void;
  onDismiss: () => void;
};

export function SurpriseOverlay({ surprise, onAccept, onDismiss }: Props) {
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accentColor = TYPE_COLORS[surprise.type] ?? colors.primary;

  // Pulsing border for urgency
  const borderPulse = useSharedValue(0.3);
  useEffect(() => {
    borderPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(borderPulse);
    };
  }, [borderPulse]);
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(${hexToRgb(accentColor)}, ${borderPulse.value})`,
  }));

  // Play voice + haptic on mount
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    playVoiceLineAsync(surprise.voiceId);

    // Auto-dismiss for passive surprises
    if (!surprise.actionable) {
      autoCloseRef.current = setTimeout(() => {
        onDismiss();
      }, AUTO_DISMISS_MS);
    }

    return () => {
      stopCurrentAudio();
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, []);

  const handleAccept = () => {
    stopCurrentAudio();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onAccept();
  };

  const handleDismiss = () => {
    stopCurrentAudio();
    onDismiss();
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.card, borderStyle]}>
        {/* Icon + Type badge */}
        <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.header}>
          <Text style={styles.icon}>{TYPE_ICONS[surprise.type] ?? "📡"}</Text>
          <Text style={[styles.typeBadge, { color: accentColor }]}>
            {surprise.type.replace(/_/g, " ")}
          </Text>
        </Animated.View>

        {/* Title */}
        <Animated.Text
          entering={FadeInDown.delay(400).duration(400)}
          style={[styles.title, { color: accentColor }]}
        >
          {surprise.title}
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text
          entering={FadeInDown.delay(600).duration(400)}
          style={styles.subtitle}
        >
          {surprise.subtitle}
        </Animated.Text>

        {/* Message */}
        <Animated.Text
          entering={FadeInDown.delay(800).duration(400)}
          style={styles.message}
        >
          {surprise.message}
        </Animated.Text>

        {/* Bonus XP indicator */}
        {surprise.bonusXP && (
          <Animated.View entering={FadeIn.delay(1000).duration(300)} style={styles.bonusRow}>
            <Text style={[styles.bonusText, { color: accentColor }]}>
              +{surprise.bonusXP} BONUS XP
            </Text>
          </Animated.View>
        )}

        {/* Duration indicator for Double XP */}
        {surprise.durationMs && (
          <Animated.View entering={FadeIn.delay(1000).duration(300)} style={styles.bonusRow}>
            <Text style={[styles.bonusText, { color: accentColor }]}>
              {Math.round(surprise.durationMs / 60000)} MINUTE WINDOW
            </Text>
          </Animated.View>
        )}

        {/* Action buttons */}
        {surprise.actionable ? (
          <Animated.View entering={FadeIn.delay(1200).duration(400)} style={styles.buttonRow}>
            <Pressable
              style={[styles.acceptBtn, { backgroundColor: accentColor }]}
              onPress={handleAccept}
            >
              <Text style={styles.acceptBtnText}>ACCEPT</Text>
            </Pressable>
            <Pressable style={styles.dismissBtn} onPress={handleDismiss}>
              <Text style={styles.dismissBtnText}>DISMISS</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.delay(1200).duration(400)} style={styles.passiveRow}>
            <Pressable onPress={handleDismiss}>
              <Text style={styles.tapToContinue}>TAP TO CONTINUE</Text>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────��────────────────────────

function hexToRgb(hex: string): string {
  if (!hex || hex.length < 7 || hex[0] !== "#") return "255, 255, 255";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "255, 255, 255";
  return `${r}, ${g}, ${b}`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    zIndex: 250,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },

  card: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.xl,
    alignItems: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  icon: {
    fontSize: 24,
  },

  typeBadge: {
    ...fonts.kicker,
    fontSize: 10,
    letterSpacing: 3,
  },

  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: spacing.xs,
  },

  subtitle: {
    fontSize: 13,
    fontStyle: "italic",
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },

  message: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: spacing.lg,
  },

  bonusRow: {
    marginBottom: spacing.lg,
  },

  bonusText: {
    ...fonts.kicker,
    fontSize: 12,
    letterSpacing: 2,
  },

  buttonRow: {
    width: "100%",
    gap: spacing.md,
  },

  acceptBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    width: "100%",
  },

  acceptBtnText: {
    ...fonts.kicker,
    fontSize: 14,
    color: "#000",
    letterSpacing: 3,
    fontWeight: "800",
  },

  dismissBtn: {
    paddingVertical: spacing.sm,
    alignItems: "center",
  },

  dismissBtnText: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 2,
  },

  passiveRow: {
    paddingVertical: spacing.sm,
  },

  tapToContinue: {
    ...fonts.kicker,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 3,
  },
});
