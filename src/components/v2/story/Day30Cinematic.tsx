import React, { useState, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { useProfile } from "../../../hooks/queries/useProfile";
import { useEngineStore, selectTotalScore, ENGINES } from "../../../stores/useEngineStore";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { IDENTITY_LABELS, type IdentityArchetype } from "../../../stores/useModeStore";
import { ProtocolTerminal, ProtocolNarration, type TerminalLine, type NarrationLine } from "./ProtocolTerminal";
import { getTodayKey, addDays } from "../../../lib/date";
import { playSequence, stopCurrentAudio } from "../../../lib/protocol-audio";

type Props = { onComplete: () => void };
type Phase = "stats" | "speech" | "transition";

function getRankLetter(avg: number): string {
  if (avg >= 95) return "SS";
  if (avg >= 85) return "S";
  if (avg >= 70) return "A";
  if (avg >= 50) return "B";
  if (avg >= 30) return "C";
  return "D";
}

export function Day30Cinematic({ onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const setAct = useStoryStore((s) => s.setAct);
  const enginesOnline = useStoryStore((s) => s.enginesOnline);
  const scores = useEngineStore((s) => s.scores);
  const loadDateRange = useEngineStore((s) => s.loadDateRange);
  const { data: profile } = useProfile();
  const streakCurrent = profile?.streak_current ?? 0;
  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 1;
  const identity = useOnboardingStore((s) => s.identity) ?? "titan";
  const archetypeName = IDENTITY_LABELS[identity as IdentityArchetype] ?? "THE TITAN";

  const [phase, setPhase] = useState<Phase>("stats");

  const averageScore = useMemo(() => {
    const today = getTodayKey();
    const start = addDays(today, -29);
    loadDateRange(start, today);

    let total = 0;
    let count = 0;
    for (let i = -29; i <= 0; i++) {
      const dk = addDays(today, i);
      const dayScore = selectTotalScore(scores, dk);
      total += dayScore;
      count++;
    }
    return count > 0 ? Math.round(total / count) : 0;
  }, [scores, loadDateRange]);

  const rank = getRankLetter(averageScore);
  const enginesOnlineCount = Object.values(enginesOnline).filter(Boolean).length;

  // Phase 1: Terminal stats
  const statsLines: TerminalLine[] = useMemo(
    () => [
      { text: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", delay: 600, haptic: "medium" },
      { text: "FOUNDATION PHASE \u2014 COMPLETE", fontSize: 16, bold: true, delay: 800, haptic: "heavy" },
      { text: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", delay: 400, haptic: "none" },
      { text: `SUBJECT: ${userName.toUpperCase()}`, delay: 500 },
      { text: "DAYS ACTIVE: 30", delay: 500 },
      { text: `AVERAGE SCORE: ${averageScore}%`, delay: 500, color: averageScore >= 70 ? colors.success : averageScore >= 50 ? "#FBBF24" : "#f87171" },
      { text: `ENGINES ONLINE: ${enginesOnlineCount}/4`, delay: 500, color: enginesOnlineCount >= 4 ? colors.success : colors.text },
      { text: `STREAK: ${streakCurrent} DAYS`, delay: 500 },
      { text: `TOTAL XP: ${xp}`, delay: 500 },
      { text: `LEVEL: ${level}`, delay: 500 },
      { text: `RANK: ${rank}`, delay: 600, haptic: "heavy", bold: true, fontSize: 16, color: rank === "SS" || rank === "S" ? "#FBBF24" : rank === "A" ? colors.success : colors.text },
      { text: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", delay: 400, haptic: "none" },
    ],
    [userName, averageScore, enginesOnlineCount, streakCurrent, xp, level, rank],
  );

  // Phase 2: Protocol speech
  const speechLines: NarrationLine[] = useMemo(
    () => [
      { text: `${userName}. Thirty days.`, fontSize: 20, bold: true, delay: 1200 },
      { text: "When you started, your status was non-operational.", delay: 1000 },
      { text: "Now look at these numbers.", delay: 800 },
      { text: "This is real. This isn't motivation. This is evidence.", bold: true, delay: 1200 },
      { text: "I'm upgrading your clearance to Building Phase.", delay: 1000 },
      { text: "The bar rises. But so have you.", italic: true, color: colors.textSecondary, delay: 1200 },
    ],
    [userName],
  );

  // Play voice when speech phase starts
  useEffect(() => {
    if (phase === "speech") {
      playSequence([
        { id: "CIN-D30-001", delayAfter: 400 },
        { id: "CIN-D30-002" },
      ]).catch(() => {});
    }
    return () => { stopCurrentAudio(); };
  }, [phase]);

  const handleStatsComplete = () => {
    setTimeout(() => setPhase("speech"), 1500);
  };

  const handleSpeechComplete = () => {
    setTimeout(() => setPhase("transition"), 1500);
  };

  const handleAccept = () => {
    stopCurrentAudio();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAct("building");
    markPlayed(30);
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
        <View style={styles.center}>
          <ProtocolNarration lines={speechLines} lineGap={800} onComplete={handleSpeechComplete} />
        </View>
      )}

      {phase === "transition" && (
        <ScrollView contentContainerStyle={styles.transitionContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.delay(200).duration(800)} style={styles.phaseBlock}>
            <Text style={styles.phaseLabel}>BUILDING PHASE</Text>
            <Text style={styles.phaseSubtitle}>Strengthen what's weak. Sharpen what's strong.</Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(1200).duration(400)} style={styles.footer}>
            <Pressable style={styles.btn} onPress={handleAccept}>
              <Text style={styles.btnText}>ENTER BUILDING PHASE</Text>
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
  transitionContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing["2xl"],
    paddingBottom: spacing["3xl"],
  },
  phaseBlock: {
    alignItems: "center",
    marginBottom: spacing["3xl"],
  },
  phaseLabel: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: 6,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  phaseSubtitle: {
    ...fonts.mono,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    letterSpacing: 1,
  },
  footer: {
    width: "100%",
    alignItems: "center",
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
