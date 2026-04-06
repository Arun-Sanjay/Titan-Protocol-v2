/**
 * BossDefeatCinematic — Victory sequence when boss challenge is completed.
 *
 * Phase flow: "terminal" → "celebration"
 * Terminal shows day results (checkmarks), boss name crossed out with "DEFEATED",
 * XP reward animation. "CLAIM REWARDS" button.
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import {
  ProtocolTerminal,
  type TerminalLine,
} from "./ProtocolTerminal";
import {
  playVoiceLineAsync,
  stopCurrentAudio,
  getBossDefeatVoiceId,
} from "../../../lib/protocol-audio";

type Props = {
  bossTitle: string;
  daysRequired: number;
  dayResults: boolean[];
  xpReward: number;
  onClaim: () => void;
};

export function BossDefeatCinematic({
  bossTitle,
  daysRequired,
  dayResults,
  xpReward,
  onClaim,
}: Props) {
  const [phase, setPhase] = useState<"terminal" | "celebration">("terminal");
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const terminalLines: TerminalLine[] = useMemo(() => {
    const lines: TerminalLine[] = [
      { text: "BOSS CHALLENGE — RESULTS", delay: 600, haptic: "medium" },
      { text: "─────────────────────────", delay: 300, haptic: "none" },
    ];

    // Day results
    for (let i = 0; i < daysRequired; i++) {
      const passed = dayResults[i] ?? false;
      lines.push({
        text: `DAY ${i + 1}: ${passed ? "✓ PASSED" : "✗ FAILED"}`,
        delay: 400,
        color: passed ? colors.success : "#f87171",
        haptic: i === daysRequired - 1 ? "medium" : "none",
      });
    }

    lines.push(
      { text: "─────────────────────────", delay: 300, haptic: "none" },
      { text: "STATUS: DEFEATED", fontSize: 16, bold: true, delay: 800, haptic: "heavy", color: colors.success },
    );

    return lines;
  }, [daysRequired, dayResults]);

  // Play voice on celebration phase
  useEffect(() => {
    if (phase === "celebration") {
      playVoiceLineAsync(getBossDefeatVoiceId());
    }
    return () => { stopCurrentAudio(); };
  }, [phase]);

  // Victory haptic on mount
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // Cleanup phase timer on unmount
  useEffect(() => {
    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, []);

  const handleTerminalComplete = () => {
    phaseTimerRef.current = setTimeout(() => setPhase("celebration"), 1200);
  };

  const handleClaim = () => {
    stopCurrentAudio();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClaim();
  };

  return (
    <View style={styles.container}>
      {/* Gold bar at top — victory */}
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

      {phase === "celebration" && (
        <View style={styles.celebrationContent}>
          <Animated.Text entering={FadeIn.delay(200).duration(400)} style={styles.defeatedIcon}>
            🏆
          </Animated.Text>

          <Animated.Text entering={FadeInDown.delay(400).duration(400)} style={styles.bossName}>
            {bossTitle.toUpperCase()}
          </Animated.Text>

          <Animated.View entering={FadeIn.delay(600).duration(300)} style={styles.defeatedBadge}>
            <Text style={styles.defeatedText}>DEFEATED</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(800).duration(400)} style={styles.rewardCard}>
            <Text style={styles.rewardLabel}>REWARD</Text>
            <Text style={styles.rewardXP}>+{xpReward} XP</Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(1200).duration(400)} style={styles.footer}>
            <Pressable style={styles.claimBtn} onPress={handleClaim}>
              <Text style={styles.claimBtnText}>CLAIM REWARDS</Text>
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
    backgroundColor: "#FBBF24",
    zIndex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
  },
  celebrationContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  defeatedIcon: { fontSize: 56 },
  bossName: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 3,
    textAlign: "center",
    textDecorationLine: "line-through",
    textDecorationColor: "#FBBF24",
  },
  defeatedBadge: {
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  defeatedText: {
    ...fonts.kicker,
    fontSize: 14,
    color: "#FBBF24",
    letterSpacing: 4,
  },
  rewardCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: spacing.lg,
    alignItems: "center",
    width: "100%",
  },
  rewardLabel: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: 4,
  },
  rewardXP: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FBBF24",
    letterSpacing: 2,
  },
  footer: {
    width: "100%",
    marginTop: spacing.lg,
  },
  claimBtn: {
    backgroundColor: "#FBBF24",
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    width: "100%",
  },
  claimBtnText: {
    ...fonts.kicker,
    fontSize: 14,
    color: "#000",
    letterSpacing: 3,
    fontWeight: "800",
  },
});
