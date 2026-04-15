/**
 * ComebackCinematic — Plays when user hits 3-day recovery milestone.
 *
 * Shows pre-break streak, recovery progress, and restored streak value.
 * Voice line acknowledges the effort of coming back.
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
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
  getComebackVoiceId,
} from "../../../lib/protocol-audio";

type Props = {
  preBreakStreak: number;
  currentStreak: number;
  restoredStreak: number; // floor(preBreakStreak * 0.75)
  onContinue: () => void;
};

export function ComebackCinematic({
  preBreakStreak,
  currentStreak,
  restoredStreak,
  onContinue,
}: Props) {
  const [phase, setPhase] = useState<"terminal" | "speech">("terminal");

  // ─── Terminal phase ─────────────────────────────────────────────────────

  const terminalLines: TerminalLine[] = useMemo(
    () => [
      { text: "RECOVERY PROTOCOL", delay: 600, haptic: "medium" },
      { text: "─────────────────────────", delay: 300, haptic: "none" },
      { text: `PRE-BREAK STREAK: ${preBreakStreak} DAYS`, delay: 500 },
      { text: `RECOVERY DAYS: 3/3 ✓`, delay: 500, color: colors.success },
      { text: "─────────────────────────", delay: 300, haptic: "none" },
      {
        text: "RECOVERY COMPLETE",
        fontSize: 16,
        bold: true,
        delay: 800,
        haptic: "heavy",
        color: colors.success,
      },
      {
        text: `STREAK RESTORED: ${currentStreak} → ${restoredStreak}`,
        delay: 600,
        color: colors.success,
      },
    ],
    [preBreakStreak, currentStreak, restoredStreak],
  );

  // ─── Speech phase ──────────────────────────────────────────────────────

  const speechLines: NarrationLine[] = useMemo(
    () => [
      { text: "Three consecutive days.", fontSize: 20, bold: true, delay: 1200 },
      { text: "Recovery mode complete.", delay: 800 },
      { text: `Your ${preBreakStreak}-day history isn't forgotten.`, delay: 800 },
      {
        text: `Streak restored to ${restoredStreak}. Now maintain it.`,
        bold: true,
        delay: 1000,
      },
    ],
    [preBreakStreak, restoredStreak],
  );

  // Play voice when speech phase starts
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (phase === "speech") {
      playVoiceLineAsync(getComebackVoiceId());
    }
    return () => { stopCurrentAudio(); };
  }, [phase]);

  // Cleanup phase transition timer on unmount
  useEffect(() => {
    return () => { if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current); };
  }, []);

  // Success haptic on mount — this is a positive moment
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleTerminalComplete = () => {
    phaseTimerRef.current = setTimeout(() => setPhase("speech"), 1500);
  };

  const handleContinue = () => {
    stopCurrentAudio();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onContinue();
  };

  return (
    <View style={styles.container}>
      {/* Green bar at top — positive moment */}
      <View style={styles.topBar} />

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
            <Pressable style={styles.btn} onPress={handleContinue}>
              <Text style={styles.btnText}>RESUME PROTOCOL</Text>
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
    zIndex: 300,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.success,
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
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["3xl"],
    alignItems: "center",
    width: "100%",
  },
  btnText: {
    ...fonts.kicker,
    fontSize: 14,
    color: "#000",
    letterSpacing: 3,
    fontWeight: "800",
  },
});
