/**
 * BossFailCinematic — Plays when a boss challenge day is failed.
 *
 * Phase flow: "terminal" → "speech"
 * Terminal shows the failed day highlighted in red.
 * Stern but non-punishing voice line. "UNDERSTOOD" button.
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
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
  getBossFailVoiceId,
} from "../../../lib/protocol-audio";

type Props = {
  bossTitle: string;
  dayNumber: number; // which day of the boss challenge failed (1-indexed)
  dayResults: boolean[];
  onContinue: () => void;
};

export function BossFailCinematic({
  bossTitle,
  dayNumber,
  dayResults,
  onContinue,
}: Props) {
  const [phase, setPhase] = useState<"terminal" | "speech">("terminal");
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const terminalLines: TerminalLine[] = useMemo(() => {
    const lines: TerminalLine[] = [
      { text: "BOSS CHALLENGE — FAILED", fontSize: 16, bold: true, delay: 800, haptic: "heavy", color: "#f87171" },
      { text: "─────────────────────────", delay: 300, haptic: "none" },
      { text: `TARGET: ${bossTitle.toUpperCase()}`, delay: 500 },
      { text: "─────────────────────────", delay: 300, haptic: "none" },
    ];

    // Show day results so far
    for (let i = 0; i < dayResults.length; i++) {
      const passed = dayResults[i];
      lines.push({
        text: `DAY ${i + 1}: ${passed ? "✓ PASSED" : "✗ FAILED"}`,
        delay: 400,
        color: passed ? colors.success : "#f87171",
      });
    }

    lines.push(
      { text: "─────────────────────────", delay: 300, haptic: "none" },
      { text: "CHALLENGE TERMINATED", delay: 600, color: "#f87171", haptic: "medium" },
    );

    return lines;
  }, [bossTitle, dayResults]);

  const speechLines: NarrationLine[] = useMemo(
    () => [
      { text: `${bossTitle}.`, fontSize: 20, bold: true, delay: 1200 },
      { text: "Not this time.", delay: 800 },
      {
        text: "Regroup. Strengthen. Come back when you're ready.",
        italic: true,
        color: colors.textSecondary,
        delay: 1000,
      },
    ],
    [bossTitle],
  );

  // Play voice when speech phase starts
  useEffect(() => {
    if (phase === "speech") {
      playVoiceLineAsync(getBossFailVoiceId());
    }
    return () => { stopCurrentAudio(); };
  }, [phase]);

  // Error haptic on mount
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  // Cleanup phase timer on unmount
  useEffect(() => {
    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, []);

  const handleTerminalComplete = () => {
    phaseTimerRef.current = setTimeout(() => setPhase("speech"), 1200);
  };

  const handleContinue = () => {
    stopCurrentAudio();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onContinue();
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar} />

      {phase === "terminal" && (
        <View style={styles.center}>
          <ProtocolTerminal
            lines={terminalLines}
            lineInterval={400}
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
              <Text style={styles.btnText}>UNDERSTOOD</Text>
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
    borderColor: "#f87171",
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
    color: "#f87171",
    letterSpacing: 3,
    fontWeight: "800",
  },
});
