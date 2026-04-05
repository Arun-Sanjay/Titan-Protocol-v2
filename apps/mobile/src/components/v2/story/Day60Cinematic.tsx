import React, { useState, useMemo, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { useProfileStore } from "../../../stores/useProfileStore";
import { useProtocolStore } from "../../../stores/useProtocolStore";
import { useEngineStore, selectTotalScore, ENGINES } from "../../../stores/useEngineStore";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { IDENTITY_LABELS, type IdentityArchetype } from "../../../stores/useModeStore";
import { ProtocolTerminal, ProtocolNarration, type TerminalLine, type NarrationLine } from "./ProtocolTerminal";
import { getTodayKey, addDays } from "../../../lib/date";

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

export function Day60Cinematic({ onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const setAct = useStoryStore((s) => s.setAct);
  const enginesOnline = useStoryStore((s) => s.enginesOnline);
  const scores = useEngineStore((s) => s.scores);
  const loadDateRange = useEngineStore((s) => s.loadDateRange);
  const streakCurrent = useProtocolStore((s) => s.streakCurrent);
  const xp = useProfileStore((s) => s.profile.xp);
  const level = useProfileStore((s) => s.profile.level);
  const identity = useOnboardingStore((s) => s.identity) ?? "titan";
  const archetypeName = IDENTITY_LABELS[identity as IdentityArchetype] ?? "THE TITAN";

  const [phase, setPhase] = useState<Phase>("stats");
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, []);

  // Compute scores for Day 1, Day 30, and Day 60 windows
  const { avgDay1, avgDay30, avgDay60, rank } = useMemo(() => {
    const today = getTodayKey();
    loadDateRange(addDays(today, -59), today);

    // First week average (Day 1-7)
    let t1 = 0, c1 = 0;
    for (let i = -59; i <= -53; i++) {
      const dk = addDays(today, i);
      t1 += selectTotalScore(scores, dk);
      c1++;
    }

    // Day 24-30 average
    let t30 = 0, c30 = 0;
    for (let i = -36; i <= -30; i++) {
      const dk = addDays(today, i);
      t30 += selectTotalScore(scores, dk);
      c30++;
    }

    // Last 7 days average (Day 54-60)
    let t60 = 0, c60 = 0;
    for (let i = -6; i <= 0; i++) {
      const dk = addDays(today, i);
      t60 += selectTotalScore(scores, dk);
      c60++;
    }

    const a1 = c1 > 0 ? Math.round(t1 / c1) : 0;
    const a30 = c30 > 0 ? Math.round(t30 / c30) : 0;
    const a60 = c60 > 0 ? Math.round(t60 / c60) : 0;

    return { avgDay1: a1, avgDay30: a30, avgDay60: a60, rank: getRankLetter(a60) };
  }, [scores, loadDateRange]);

  const enginesOnlineCount = Object.values(enginesOnline).filter(Boolean).length;

  // Phase 1: Terminal stats with comparison
  const statsLines: TerminalLine[] = useMemo(
    () => [
      { text: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", delay: 600, haptic: "medium" },
      { text: "BUILDING PHASE \u2014 COMPLETE", fontSize: 16, bold: true, delay: 800, haptic: "heavy" },
      { text: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", delay: 400, haptic: "none" },
      { text: `SUBJECT: ${userName.toUpperCase()}`, delay: 500 },
      { text: `CLASSIFICATION: ${archetypeName.toUpperCase()}`, delay: 500 },
      { text: "DAYS ACTIVE: 60", delay: 500 },
      { text: "\u2500\u2500\u2500 PERFORMANCE TRAJECTORY \u2500\u2500\u2500", delay: 600, haptic: "medium" },
      { text: `DAY 1-7 AVG:   ${avgDay1}%`, delay: 500, color: colors.textMuted },
      { text: `DAY 24-30 AVG: ${avgDay30}%`, delay: 500, color: "#FBBF24" },
      { text: `DAY 54-60 AVG: ${avgDay60}%`, delay: 500, color: colors.success },
      { text: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", delay: 400, haptic: "none" },
      { text: `ENGINES ONLINE: ${enginesOnlineCount}/4`, delay: 500 },
      { text: `STREAK: ${streakCurrent} DAYS`, delay: 500 },
      { text: `TOTAL XP: ${xp}  |  LEVEL: ${level}`, delay: 500 },
      { text: `RANK: ${rank}`, delay: 600, haptic: "heavy", bold: true, fontSize: 16, color: rank === "SS" || rank === "S" ? "#FBBF24" : rank === "A" ? colors.success : colors.text },
      { text: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", delay: 400, haptic: "none" },
    ],
    [userName, archetypeName, avgDay1, avgDay30, avgDay60, enginesOnlineCount, streakCurrent, xp, level, rank],
  );

  // Phase 2: Protocol speech (first time using archetype title)
  const speechLines: NarrationLine[] = useMemo(
    () => [
      { text: `${userName}. Sixty days.`, fontSize: 20, bold: true, delay: 1200 },
      { text: "I've been watching thousands of recruits cycle through this system.", delay: 1000 },
      { text: "Most never reach this screen.", delay: 800 },
      { text: "You're not a recruit anymore.", bold: true, delay: 1200 },
      { text: `You're ${archetypeName.toUpperCase()}.`, fontSize: 22, bold: true, color: "#FBBF24", delay: 1500 },
      { text: "That's not something I assigned you. That's something you earned.", delay: 1200 },
      { text: "Intensify Phase unlocked. From here, I stop holding your hand.", italic: true, color: colors.textSecondary, delay: 1200 },
    ],
    [userName, archetypeName],
  );

  const handleStatsComplete = () => {
    phaseTimerRef.current = setTimeout(() => setPhase("speech"), 1500);
  };

  const handleSpeechComplete = () => {
    phaseTimerRef.current = setTimeout(() => setPhase("transition"), 1500);
  };

  const handleAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAct("intensify");
    markPlayed(60);
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
            <Text style={styles.phaseLabel}>INTENSIFY PHASE</Text>
            <Text style={styles.phaseSubtitle}>No more safety nets. Prove what you're made of.</Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(1200).duration(400)} style={styles.footer}>
            <Pressable style={styles.btn} onPress={handleAccept}>
              <Text style={styles.btnText}>ENTER INTENSIFY PHASE</Text>
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
