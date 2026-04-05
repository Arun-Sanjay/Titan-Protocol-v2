/**
 * StreakBreakCinematic — Dramatic cinematic for BREACH (2 days missed)
 * and RESET (3+ days missed).
 *
 * Phase flow: "terminal" → "speech"
 * Terminal shows old streak, damage calculation, new streak in red.
 * Speech plays a severity-matched voice line.
 * Requires "CONTINUE" acknowledgment button.
 */

import React, { useState, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import {
  ProtocolTerminal,
  ProtocolNarration,
  type TerminalLine,
  type NarrationLine,
} from "./ProtocolTerminal";
import {
  playVoiceLineAsync,
  stopCurrentAudio,
  getFailureVoiceId,
} from "../../../lib/protocol-audio";
import type { IntegrityStatus } from "../../../lib/protocol-integrity";

type Props = {
  status: "BREACH" | "RESET";
  oldStreak: number;
  newStreak: number;
  missedDays: number;
  onContinue: () => void;
};

export function StreakBreakCinematic({
  status,
  oldStreak,
  newStreak,
  missedDays,
  onContinue,
}: Props) {
  const [phase, setPhase] = useState<"terminal" | "speech">("terminal");

  const isBreach = status === "BREACH";
  const accentColor = isBreach ? "#FBBF24" : "#f87171"; // amber for breach, red for reset
  const statusLabel = isBreach ? "INTEGRITY BREACH" : "PROTOCOL RESET";

  // ─── Terminal phase ─────────────────────────────────────────────────────

  const terminalLines: TerminalLine[] = useMemo(
    () => [
      { text: "INTEGRITY CHECK", delay: 600, haptic: "medium" },
      { text: "─────────────────────────", delay: 300, haptic: "none" },
      { text: `DAYS MISSED: ${missedDays}`, delay: 500, color: accentColor },
      { text: `PREVIOUS STREAK: ${oldStreak} DAYS`, delay: 500 },
      { text: "─────────────────────────", delay: 300, haptic: "none" },
      {
        text: statusLabel,
        fontSize: 16,
        bold: true,
        delay: 800,
        haptic: "heavy",
        color: accentColor,
      },
      { text: `NEW STREAK: ${newStreak}`, delay: 600, color: accentColor },
    ],
    [oldStreak, newStreak, missedDays, statusLabel, accentColor],
  );

  // ─── Speech phase ──────────────────────────────────────────────────────

  const speechLines: NarrationLine[] = useMemo(() => {
    if (isBreach) {
      return [
        { text: `${missedDays} days absent.`, fontSize: 20, bold: true, delay: 1200 },
        { text: `Your streak was ${oldStreak}. Now it's ${newStreak}.`, delay: 800 },
        {
          text: "That's not a punishment. That's physics.",
          italic: true,
          color: colors.textSecondary,
          delay: 1000,
        },
      ];
    }
    // RESET
    return [
      { text: `${missedDays} days offline.`, fontSize: 20, bold: true, delay: 1200 },
      { text: "Your streak is zero.", delay: 800 },
      { text: "Everything you built went dormant.", delay: 800 },
      {
        text: "But you're here now. That's something.",
        italic: true,
        color: colors.textSecondary,
        delay: 1000,
      },
    ];
  }, [isBreach, oldStreak, newStreak, missedDays]);

  // Play voice when speech phase starts
  useEffect(() => {
    if (phase === "speech") {
      const voiceId = getFailureVoiceId(status);
      playVoiceLineAsync(voiceId);
    }
    return () => { stopCurrentAudio(); };
  }, [phase, status]);

  // Heavy haptic on mount — this is a serious moment
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  const handleTerminalComplete = () => {
    setTimeout(() => setPhase("speech"), 1500);
  };

  const handleContinue = () => {
    stopCurrentAudio();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onContinue();
  };

  return (
    <View style={styles.container}>
      {/* Red/amber border flash at top */}
      <View style={[styles.topBar, { backgroundColor: accentColor }]} />

      {phase === "terminal" && (
        <View style={styles.center}>
          <ProtocolTerminal
            lines={terminalLines}
            lineInterval={500}
            onComplete={handleTerminalComplete}
          />
        </View>
      )}

      {phase === "speech" && (
        <View style={styles.speechContent}>
          <ProtocolNarration lines={speechLines} lineGap={800} onComplete={() => {}} />

          <Animated.View
            entering={FadeIn.delay(speechLines.length * 900 + 1000).duration(400)}
            style={styles.footer}
          >
            <Pressable style={[styles.btn, { borderColor: accentColor }]} onPress={handleContinue}>
              <Text style={[styles.btnText, { color: accentColor }]}>CONTINUE</Text>
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
    zIndex: 300, // Above everything — this blocks progression
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
  },
  speechContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing["2xl"],
    paddingBottom: spacing["3xl"],
  },
  footer: {
    width: "100%",
    alignItems: "center",
    marginTop: spacing["3xl"],
  },
  btn: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["3xl"],
    alignItems: "center",
    width: "100%",
    backgroundColor: "transparent",
  },
  btnText: {
    ...fonts.kicker,
    fontSize: 14,
    letterSpacing: 3,
    fontWeight: "800",
  },
});
