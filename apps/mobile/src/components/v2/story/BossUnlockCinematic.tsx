/**
 * BossUnlockCinematic — Reveals a new boss challenge with theatrical flair.
 *
 * Phase flow: "alert" → "reveal"
 * Red pulsing border, "BOSS CHALLENGE DETECTED" terminal,
 * boss name + requirement reveal, then ENTER WAR ROOM / LATER buttons.
 */

import React, { useState, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import {
  ProtocolTerminal,
  type TerminalLine,
} from "./ProtocolTerminal";
import {
  playVoiceLineAsync,
  stopCurrentAudio,
  getBossUnlockVoiceId,
} from "../../../lib/protocol-audio";

type Props = {
  bossId: string;
  bossTitle: string;
  bossDescription: string;
  bossRequirement: string;
  daysRequired: number;
  xpReward: number;
  onEnterWarRoom: () => void;
  onDismiss: () => void;
};

export function BossUnlockCinematic({
  bossId,
  bossTitle,
  bossDescription,
  bossRequirement,
  daysRequired,
  xpReward,
  onEnterWarRoom,
  onDismiss,
}: Props) {
  const [phase, setPhase] = useState<"alert" | "reveal">("alert");

  // Pulsing red border
  const borderPulse = useSharedValue(0.3);
  useEffect(() => {
    borderPulse.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(248, 113, 113, ${borderPulse.value})`,
  }));

  // Alert terminal lines
  const alertLines: TerminalLine[] = useMemo(
    () => [
      { text: "SCANNING THREAT LEVEL...", delay: 800 },
      { text: "─────────────────────────", delay: 300, haptic: "none" },
      { text: "BOSS CHALLENGE DETECTED", fontSize: 16, bold: true, delay: 800, haptic: "heavy", color: "#f87171" },
      { text: `TARGET: ${bossTitle.toUpperCase()}`, delay: 600, color: "#f87171" },
      { text: `DURATION: ${daysRequired} DAYS`, delay: 500 },
      { text: `REWARD: ${xpReward} XP`, delay: 500, color: "#FBBF24" },
    ],
    [bossTitle, daysRequired, xpReward],
  );

  // Play voice
  useEffect(() => {
    if (phase === "alert") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    if (phase === "reveal") {
      // Play boss-specific line (falls back to generic if unknown boss)
      playVoiceLineAsync(getBossUnlockVoiceId(bossId));
    }
    return () => { stopCurrentAudio(); };
  }, [phase, bossId]);

  const handleAlertComplete = () => {
    setTimeout(() => setPhase("reveal"), 1000);
  };

  const handleEnter = () => {
    stopCurrentAudio();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onEnterWarRoom();
  };

  const handleLater = () => {
    stopCurrentAudio();
    onDismiss();
  };

  return (
    <View style={styles.container}>
      {/* Red bar at top */}
      <View style={styles.topBar} />

      {phase === "alert" && (
        <View style={styles.center}>
          <ProtocolTerminal
            lines={alertLines}
            lineInterval={500}
            onComplete={handleAlertComplete}
          />
        </View>
      )}

      {phase === "reveal" && (
        <View style={styles.center}>
          <Animated.View style={[styles.bossCard, borderStyle]}>
            <Animated.Text entering={FadeIn.delay(200).duration(400)} style={styles.bossIcon}>
              💀
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(400).duration(400)} style={styles.bossTitle}>
              {bossTitle.toUpperCase()}
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(600).duration(400)} style={styles.bossDesc}>
              {bossDescription}
            </Animated.Text>
            <Animated.View entering={FadeIn.delay(800).duration(400)} style={styles.reqCard}>
              <Text style={styles.reqLabel}>REQUIREMENT</Text>
              <Text style={styles.reqText}>{bossRequirement}</Text>
            </Animated.View>
            <Animated.View entering={FadeIn.delay(1000).duration(400)} style={styles.statsRow}>
              <Text style={styles.statText}>{daysRequired} DAYS</Text>
              <Text style={styles.statDivider}>·</Text>
              <Text style={[styles.statText, { color: "#FBBF24" }]}>+{xpReward} XP</Text>
            </Animated.View>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(1200).duration(400)} style={styles.buttonRow}>
            <Pressable style={styles.enterBtn} onPress={handleEnter}>
              <Text style={styles.enterBtnText}>ENTER WAR ROOM</Text>
            </Pressable>
            <Pressable style={styles.laterBtn} onPress={handleLater}>
              <Text style={styles.laterBtnText}>LATER</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    zIndex: 260,
  },
  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 3,
    backgroundColor: "#f87171",
    zIndex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  bossCard: {
    width: "100%",
    backgroundColor: "rgba(248, 113, 113, 0.04)",
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  bossIcon: { fontSize: 40 },
  bossTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f87171",
    letterSpacing: 3,
    textAlign: "center",
  },
  bossDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: "center",
  },
  reqCard: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: spacing.md,
    alignItems: "center",
  },
  reqLabel: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: 4,
  },
  reqText: {
    fontSize: 13,
    color: colors.text,
    textAlign: "center",
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statText: {
    ...fonts.kicker,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  statDivider: { color: colors.textMuted, fontSize: 10 },
  buttonRow: {
    width: "100%",
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  enterBtn: {
    backgroundColor: "#f87171",
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    width: "100%",
  },
  enterBtnText: {
    ...fonts.kicker,
    fontSize: 14,
    color: "#000",
    letterSpacing: 3,
    fontWeight: "800",
  },
  laterBtn: {
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  laterBtnText: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 2,
  },
});
