import React, { useState, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { useProfile } from "../../../hooks/queries/useProfile";
import { useEngineStore, selectTotalScore, ENGINES } from "../../../stores/useEngineStore";
import { ProtocolTerminal, ProtocolNarration, type TerminalLine, type NarrationLine } from "./ProtocolTerminal";
import { getTodayKey, addDays } from "../../../lib/date";
import { playVoiceLineAsync, stopCurrentAudio } from "../../../lib/protocol-audio";

type Props = { onComplete: () => void };
type Phase = "stats" | "speech";

export function Day14Cinematic({ onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const scores = useEngineStore((s) => s.scores);
  const loadDateRange = useEngineStore((s) => s.loadDateRange);
  const { data: profile } = useProfile();
  const streakCurrent = profile?.streak_current ?? 0;
  const xp = profile?.xp ?? 0;

  const [phase, setPhase] = useState<Phase>("stats");

  // Compute average score over 14 days
  const { averageScore, missionsCompleted, weakEngine } = useMemo(() => {
    const today = getTodayKey();
    const start = addDays(today, -13);
    loadDateRange(start, today);

    let total = 0;
    let count = 0;
    let missions = 0;
    const engineTotals: Record<string, { sum: number; cnt: number }> = {};
    for (const e of ENGINES) engineTotals[e] = { sum: 0, cnt: 0 };

    for (let i = -13; i <= 0; i++) {
      const dk = addDays(today, i);
      const dayScore = selectTotalScore(scores, dk);
      if (dayScore > 0) missions++;
      total += dayScore;
      count++;

      for (const e of ENGINES) {
        const eScore = scores[`${e}:${dk}`] ?? 0;
        engineTotals[e].sum += eScore;
        engineTotals[e].cnt++;
      }
    }

    let weakest = "body";
    let weakestAvg = 999;
    for (const e of ENGINES) {
      const avg = engineTotals[e].cnt > 0 ? engineTotals[e].sum / engineTotals[e].cnt : 0;
      if (avg < weakestAvg) {
        weakestAvg = avg;
        weakest = e;
      }
    }

    return {
      averageScore: count > 0 ? Math.round(total / count) : 0,
      missionsCompleted: missions,
      weakEngine: weakest.toUpperCase(),
    };
  }, [scores, loadDateRange]);

  // Phase 1: Terminal stats
  const statsLines: TerminalLine[] = useMemo(
    () => [
      { text: "WEEK 2 EVALUATION", fontSize: 16, bold: true, delay: 800, haptic: "heavy" },
      { text: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", delay: 400, haptic: "none" },
      { text: `AVERAGE SCORE: ${averageScore}%`, delay: 500, color: averageScore >= 70 ? colors.success : averageScore >= 50 ? "#FBBF24" : "#f87171" },
      { text: `STREAK: ${streakCurrent} DAYS`, delay: 500 },
      { text: `MISSIONS COMPLETED: ${missionsCompleted}`, delay: 500 },
      { text: `HABITS MAINTAINED: ${Math.max(0, missionsCompleted - 2)}`, delay: 500 },
      { text: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", delay: 400, haptic: "none" },
    ],
    [averageScore, streakCurrent, missionsCompleted],
  );

  // Phase 2: Protocol speech (3 tiers)
  const speechLines: NarrationLine[] = useMemo(() => {
    if (averageScore >= 70) {
      return [
        { text: `Two weeks, ${userName}.`, fontSize: 20, bold: true, delay: 1200 },
        { text: "Your output is climbing.", delay: 800 },
        { text: "I'm starting to think you might actually be serious about this.", delay: 1000 },
      ];
    }
    if (averageScore >= 50) {
      return [
        { text: `Two weeks in, ${userName}.`, fontSize: 20, bold: true, delay: 1200 },
        { text: "You're surviving, but surviving isn't thriving.", delay: 800 },
        { text: `I need more from your ${weakEngine} engine.`, delay: 1000 },
      ];
    }
    return [
      { text: `${userName}.`, fontSize: 20, bold: true, delay: 1200 },
      { text: "Let's talk.", delay: 800 },
      { text: "Your numbers are below where they should be.", delay: 800 },
      { text: "I'm not giving up on you.", delay: 800 },
      { text: "But I need you to not give up on yourself.", bold: true, delay: 1000 },
    ];
  }, [userName, averageScore, weakEngine]);

  // Play voice when speech phase starts
  useEffect(() => {
    if (phase === "speech") {
      const voiceId =
        averageScore >= 70 ? "CIN-D14-HIGH" : averageScore >= 50 ? "CIN-D14-MID" : "CIN-D14-LOW";
      playVoiceLineAsync(voiceId);
    }
    return () => { stopCurrentAudio(); };
  }, [phase, averageScore]);

  const handleStatsComplete = () => {
    setTimeout(() => setPhase("speech"), 1500);
  };

  const handleDone = () => {
    stopCurrentAudio();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markPlayed(14);
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
        <ScrollView contentContainerStyle={styles.speechContent} showsVerticalScrollIndicator={false}>
          <ProtocolNarration lines={speechLines} lineGap={800} onComplete={() => {}} />
          <Animated.View entering={FadeIn.delay(speechLines.length * 900 + 1000).duration(400)} style={styles.footer}>
            <Pressable style={styles.btn} onPress={handleDone}>
              <Text style={styles.btnText}>CONTINUE</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
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
