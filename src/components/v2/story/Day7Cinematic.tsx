import React, { useState, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { ProtocolNarration, ProtocolTerminal, type NarrationLine, type TerminalLine } from "./ProtocolTerminal";
import { useEngineStore, selectTotalScore } from "../../../stores/useEngineStore";
import { useProtocolStore } from "../../../stores/useProtocolStore";
import { useProfile } from "../../../hooks/queries/useProfile";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { IDENTITY_LABELS, type IdentityArchetype } from "../../../stores/useModeStore";
import { getTodayKey, addDays } from "../../../lib/date";
import { generateDailyOperation } from "../../../lib/operation-engine";
import { useAllTasks, useRecentCompletionMap } from "../../../hooks/queries/useTasks";
import { playVoiceLineAsync, stopCurrentAudio } from "../../../lib/protocol-audio";

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

export function Day7Cinematic({ onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const setAct = useStoryStore((s) => s.setAct);
  const scores = useEngineStore((s) => s.scores);
  const loadDateRange = useEngineStore((s) => s.loadDateRange);
  const streakCurrent = useProtocolStore((s) => s.streakCurrent);
  const { data: profile } = useProfile();
  const xp = profile?.xp ?? 0;
  const streak = profile?.streak_current ?? 0;
  const storyAct = useStoryStore((s) => s.currentAct);
  const identity = useOnboardingStore((s) => s.identity) ?? "titan";
  const archetypeName = IDENTITY_LABELS[identity as IdentityArchetype] ?? "THE TITAN";

  const [phase, setPhase] = useState<Phase>("stats");

  // Compute average score over 7 days
  const averageScore = useMemo(() => {
    const today = getTodayKey();
    const start = addDays(today, -6);
    loadDateRange(start, today);

    let total = 0;
    let count = 0;
    for (let i = -6; i <= 0; i++) {
      const dk = addDays(today, i);
      const dayScore = selectTotalScore(scores, dk);
      total += dayScore;
      count++;
    }
    return count > 0 ? Math.round(total / count) : 0;
  }, [scores, loadDateRange]);

  const rank = getRankLetter(averageScore);

  // Phase 3.6: cloud task data for operation engine
  const { data: cloudTasks = [] } = useAllTasks();
  const { data: completionMap = {} } = useRecentCompletionMap();

  // Get today's task count for the operation overview
  const taskCount = useMemo(() => {
    const op = generateDailyOperation(userName, 7, streak, String(storyAct), cloudTasks, completionMap);
    return op.taskCount;
  }, [userName, streak, storyAct, cloudTasks, completionMap]);

  // Phase 1: Terminal stats
  const statsLines: TerminalLine[] = useMemo(
    () => [
      { text: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", delay: 600, haptic: "medium" },
      { text: "INDUCTION PERIOD: COMPLETE", fontSize: 16, bold: true, delay: 800, haptic: "heavy" },
      { text: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", delay: 400, haptic: "none" },
      { text: `SUBJECT: ${userName.toUpperCase()}`, delay: 500 },
      { text: `CLASSIFICATION: ${archetypeName.toUpperCase()}`, delay: 500 },
      { text: "DAYS SURVIVED: 7", delay: 500 },
      { text: `AVERAGE SCORE: ${averageScore}%`, delay: 500, color: averageScore >= 70 ? colors.success : averageScore >= 50 ? "#FBBF24" : "#f87171" },
      { text: `STREAK: ${streakCurrent} DAYS`, delay: 500 },
      { text: `XP EARNED: ${xp}`, delay: 500 },
      { text: `RANK: ${rank}`, delay: 600, haptic: "heavy", bold: true, fontSize: 16, color: rank === "SS" || rank === "S" ? "#FBBF24" : rank === "A" ? colors.success : colors.text },
      { text: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", delay: 400, haptic: "none" },
      { text: `FINAL OPERATION: ${taskCount} TASKS ASSIGNED`, delay: 600, color: "#FBBF24" },
    ],
    [userName, archetypeName, averageScore, streakCurrent, xp, rank, taskCount],
  );

  // Phase 2: Protocol speech based on performance
  const speechLines: NarrationLine[] = useMemo(() => {
    if (averageScore >= 70) {
      return [
        { text: `Seven days, ${userName}.`, fontSize: 20, bold: true, delay: 1200 },
        { text: "You completed the induction period.", delay: 800 },
        { text: "I'll be honest \u2014 most don't make it this far.", delay: 800 },
        { text: "Your performance exceeded baseline expectations.", delay: 800 },
        { text: "I'm upgrading your clearance. Welcome to the Foundation Phase.", bold: true, delay: 1000 },
        { text: "The real work starts now.", italic: true, color: colors.textSecondary, delay: 1200 },
      ];
    }
    if (averageScore >= 50) {
      return [
        { text: `Seven days, ${userName}.`, fontSize: 20, bold: true, delay: 1200 },
        { text: "Your performance was... adequate.", delay: 800 },
        { text: "There's potential here. But potential is just a word until you prove it.", delay: 1000 },
        { text: "You've earned Foundation Phase access. Don't waste it.", bold: true, delay: 1000 },
      ];
    }
    return [
      { text: `Seven days, ${userName}.`, fontSize: 20, bold: true, delay: 1200 },
      { text: "Your numbers aren't impressive. I won't lie to you.", delay: 800 },
      { text: "But you showed up. Seven days. That counts for something.", delay: 1000 },
      { text: "Foundation Phase is unlocked. Prove you belong here.", bold: true, delay: 1000 },
    ];
  }, [userName, averageScore]);

  // Play voice when speech phase starts
  useEffect(() => {
    if (phase === "speech") {
      const voiceId =
        averageScore >= 70 ? "CIN-D7-HIGH" : averageScore >= 50 ? "CIN-D7-MID" : "CIN-D7-LOW";
      playVoiceLineAsync(voiceId);
    }
    return () => { stopCurrentAudio(); };
  }, [phase, averageScore]);

  const handleStatsComplete = () => {
    setTimeout(() => setPhase("speech"), 1500);
  };

  const handleSpeechComplete = () => {
    setTimeout(() => setPhase("transition"), 1500);
  };

  const handleAccept = () => {
    stopCurrentAudio();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markPlayed(7);
    setAct("foundation");
    onComplete();
  };

  return (
    <View style={styles.container}>
      {/* Phase 1: Terminal Stats */}
      {phase === "stats" && (
        <View style={styles.center}>
          <ProtocolTerminal
            lines={statsLines}
            lineInterval={500}
            onComplete={handleStatsComplete}
          />
        </View>
      )}

      {/* Phase 2: Protocol Speech */}
      {phase === "speech" && (
        <View style={styles.center}>
          <ProtocolNarration
            lines={speechLines}
            lineGap={800}
            onComplete={handleSpeechComplete}
          />
        </View>
      )}

      {/* Phase 3: Transition */}
      {phase === "transition" && (
        <ScrollView contentContainerStyle={styles.transitionContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.delay(200).duration(800)} style={styles.phaseBlock}>
            <Text style={styles.phaseLabel}>FOUNDATION PHASE</Text>
            <Text style={styles.phaseSubtitle}>Build the base. No shortcuts.</Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(1200).duration(400)} style={styles.footer}>
            <Pressable style={styles.acceptBtn} onPress={handleAccept}>
              <Text style={styles.acceptBtnText}>ENTER FOUNDATION PHASE</Text>
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
  acceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["3xl"],
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
});
