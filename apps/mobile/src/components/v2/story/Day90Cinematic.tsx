import React, { useState, useMemo } from "react";
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
type Phase = "stats" | "speech" | "wellDone" | "transition";

export function Day90Cinematic({ onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const setAct = useStoryStore((s) => s.setAct);
  const scores = useEngineStore((s) => s.scores);
  const loadDateRange = useEngineStore((s) => s.loadDateRange);
  const streakCurrent = useProtocolStore((s) => s.streakCurrent);
  const xp = useProfileStore((s) => s.profile.xp);
  const level = useProfileStore((s) => s.profile.level);
  const identity = useOnboardingStore((s) => s.identity) ?? "titan";
  const archetypeName = IDENTITY_LABELS[identity as IdentityArchetype] ?? "THE TITAN";

  const [phase, setPhase] = useState<Phase>("stats");

  const averageScore = useMemo(() => {
    const today = getTodayKey();
    const start = addDays(today, -89);
    loadDateRange(start, today);

    let total = 0;
    let count = 0;
    for (let i = -89; i <= 0; i++) {
      const dk = addDays(today, i);
      const dayScore = selectTotalScore(scores, dk);
      total += dayScore;
      count++;
    }
    return count > 0 ? Math.round(total / count) : 0;
  }, [scores, loadDateRange]);

  // Phase 1: Terminal stats (callback to Day 1)
  const statsLines: TerminalLine[] = useMemo(
    () => [
      { text: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", delay: 600, haptic: "medium" },
      { text: "TITAN PROTOCOL \u2014 90 DAY ASSESSMENT", fontSize: 16, bold: true, delay: 800, haptic: "heavy" },
      { text: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", delay: 400, haptic: "none" },
      { text: `SUBJECT: ${userName.toUpperCase()}`, delay: 500 },
      { text: `CLASSIFICATION: ${archetypeName.toUpperCase()}`, delay: 500 },
      { text: "STATUS: OPERATIONAL", delay: 600, color: colors.success, bold: true, haptic: "heavy" },
      { text: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", delay: 400, haptic: "none" },
      { text: `AVERAGE SCORE: ${averageScore}%`, delay: 500, color: averageScore >= 70 ? colors.success : "#FBBF24" },
      { text: `STREAK: ${streakCurrent} DAYS`, delay: 500 },
      { text: `TOTAL XP: ${xp}  |  LEVEL: ${level}`, delay: 500 },
      { text: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", delay: 400, haptic: "none" },
    ],
    [userName, archetypeName, averageScore, streakCurrent, xp, level],
  );

  // Phase 2: The longest Protocol speech
  const speechLines: NarrationLine[] = useMemo(
    () => [
      { text: `${userName}. Ninety days.`, fontSize: 22, bold: true, delay: 1500 },
      { text: "On Day 1, I scanned you and the assessment was: non-operational.", delay: 1200 },
      { text: "I told you that was unacceptable.", delay: 1000 },
      { text: "Look at this data.", delay: 1000 },
      { text: "This... is not the same person.", bold: true, delay: 1500 },
      { text: "I don't say this often. In fact, I don't say it at all.", delay: 1200 },
      { text: "But I'm saying it now:", italic: true, color: colors.textSecondary, delay: 1500 },
    ],
    [userName],
  );

  const handleStatsComplete = () => {
    setTimeout(() => setPhase("speech"), 1500);
  };

  const handleSpeechComplete = () => {
    setTimeout(() => setPhase("wellDone"), 2000);
  };

  const handleWellDoneTimeout = () => {
    setTimeout(() => setPhase("transition"), 4000);
  };

  const handleAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAct("sustain");
    markPlayed(90);
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
          <ProtocolNarration lines={speechLines} lineGap={1000} onComplete={handleSpeechComplete} />
        </View>
      )}

      {phase === "wellDone" && (
        <View style={styles.wellDoneContainer}>
          <Animated.Text
            entering={FadeIn.delay(500).duration(1500)}
            style={styles.wellDoneText}
            onLayout={handleWellDoneTimeout}
          >
            Well done, {userName}.
          </Animated.Text>
        </View>
      )}

      {phase === "transition" && (
        <ScrollView contentContainerStyle={styles.transitionContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.delay(200).duration(800)} style={styles.phaseBlock}>
            <Text style={styles.phaseLabel}>SUSTAIN PHASE</Text>
            <Text style={styles.phaseSubtitle}>Maintain the standard. This is who you are now.</Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(1200).duration(400)} style={styles.footer}>
            <Pressable style={styles.btn} onPress={handleAccept}>
              <Text style={styles.btnText}>ENTER SUSTAIN PHASE</Text>
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
  wellDoneContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing["2xl"],
  },
  wellDoneText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FBBF24",
    textAlign: "center",
    letterSpacing: 2,
    lineHeight: 44,
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
    backgroundColor: "#FBBF24",
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
