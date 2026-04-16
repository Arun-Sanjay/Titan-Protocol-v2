import React, { useState, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { useProfile } from "../../../hooks/queries/useProfile";
import { useProtocolStore } from "../../../stores/useProtocolStore";
import { useEngineStore, selectTotalScore, ENGINES } from "../../../stores/useEngineStore";
import { ProtocolTerminal, ProtocolNarration, type TerminalLine, type NarrationLine } from "./ProtocolTerminal";
import { getTodayKey, addDays } from "../../../lib/date";
import { playSequence, stopCurrentAudio } from "../../../lib/protocol-audio";

type Props = { onComplete: () => void };
type Phase = "stats" | "speech";

/**
 * Day 10 — "Double Digits"
 * Milestone cinematic with stats terminal showing 10-day summary,
 * then an encouraging speech recognizing persistence.
 */
export function Day10Cinematic({ onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const scores = useEngineStore((s) => s.scores);
  const loadDateRange = useEngineStore((s) => s.loadDateRange);
  const streakCurrent = useProtocolStore((s) => s.streakCurrent);
  const { data: profile } = useProfile();
  const xp = profile?.xp ?? 0;

  const [phase, setPhase] = useState<Phase>("stats");

  // Compute 10-day stats
  const { averageScore, daysActive } = useMemo(() => {
    const today = getTodayKey();
    const start = addDays(today, -9);
    loadDateRange(start, today);

    let total = 0;
    let count = 0;
    let active = 0;

    for (let i = -9; i <= 0; i++) {
      const dk = addDays(today, i);
      const dayScore = selectTotalScore(scores, dk);
      if (dayScore > 0) active++;
      total += dayScore;
      count++;
    }

    return {
      averageScore: count > 0 ? Math.round(total / count) : 0,
      daysActive: active,
    };
  }, [scores, loadDateRange]);

  // Phase 1: Terminal stats
  const statsLines: TerminalLine[] = useMemo(
    () => [
      { text: "10-DAY MILESTONE", fontSize: 16, bold: true, delay: 800, haptic: "heavy" },
      { text: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", delay: 400, haptic: "none" },
      { text: `DAYS ACTIVE: ${daysActive}/10`, delay: 500 },
      { text: `AVERAGE SCORE: ${averageScore}%`, delay: 500, color: averageScore >= 70 ? colors.success : averageScore >= 50 ? "#FBBF24" : "#f87171" },
      { text: `STREAK: ${streakCurrent} DAYS`, delay: 500 },
      { text: `XP EARNED: ${xp.toLocaleString()}`, delay: 500 },
      { text: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", delay: 400, haptic: "none" },
      { text: "DOUBLE DIGITS REACHED", fontSize: 14, bold: true, delay: 800, haptic: "medium", color: colors.success },
    ],
    [averageScore, daysActive, streakCurrent, xp],
  );

  // Phase 2: Protocol speech
  const speechLines: NarrationLine[] = useMemo(
    () => [
      { text: "Ten days. Double digits.", fontSize: 20, bold: true, delay: 1200 },
      { text: "Most people who download a self-improvement app delete it by day three.", delay: 1000 },
      { text: "You're still here.", delay: 800 },
      {
        text: "That's not luck. That's something else. Let's find out what.",
        italic: true,
        color: colors.textSecondary,
        delay: 1000,
      },
    ],
    [],
  );

  // Play voice when speech phase starts
  useEffect(() => {
    if (phase === "speech") {
      playSequence([
        { id: "CIN-D10-001", delayAfter: 300 },
        { id: "CIN-D10-002", delayAfter: 300 },
        { id: "CIN-D10-003" },
      ]).catch(() => {});
    }
    return () => { stopCurrentAudio(); };
  }, [phase]);

  const handleStatsComplete = () => {
    setTimeout(() => setPhase("speech"), 1500);
  };

  const handleDone = () => {
    stopCurrentAudio();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markPlayed(10);
    onComplete();
  };

  return (
    <View style={styles.container}>
      {phase === "stats" && (
        <View style={styles.center}>
          <ProtocolTerminal lines={statsLines} lineInterval={500} onComplete={handleStatsComplete} />
        </View>
      )}

      {phase === "speech" && (
        <View style={styles.speechContent}>
          <ProtocolNarration lines={speechLines} lineGap={800} onComplete={() => {}} />
          <Animated.View entering={FadeIn.delay(speechLines.length * 900 + 1000).duration(400)} style={styles.footer}>
            <Pressable style={styles.btn} onPress={handleDone}>
              <Text style={styles.btnText}>CONTINUE</Text>
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
    zIndex: 200,
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
    backgroundColor: colors.primary,
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
