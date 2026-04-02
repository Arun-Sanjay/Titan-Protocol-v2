import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { ProtocolNarration, type NarrationLine } from "./ProtocolTerminal";
import { useEngineStore, selectTotalScore } from "../../../stores/useEngineStore";
import { getTodayKey, addDays } from "../../../lib/date";

type Props = { onComplete: () => void };

type Trajectory = "up" | "flat" | "down";

export function Day6Cinematic({ onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const scores = useEngineStore((s) => s.scores);
  const loadDateRange = useEngineStore((s) => s.loadDateRange);
  const [showMission, setShowMission] = useState(false);

  // Compute trajectory from last 5 days of scores
  const trajectory = useMemo<Trajectory>(() => {
    const today = getTodayKey();
    const day1 = addDays(today, -5);

    // Ensure scores are loaded for the range
    loadDateRange(day1, today);

    // Collect daily averages
    const dailyScores: number[] = [];
    for (let i = -5; i <= 0; i++) {
      const dk = addDays(today, i);
      const total = selectTotalScore(scores, dk);
      dailyScores.push(total);
    }

    // Compare recent average (last 2 days) vs early average (first 2 days)
    const earlyAvg = dailyScores.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    const recentAvg = dailyScores.slice(-2).reduce((a, b) => a + b, 0) / 2;

    if (recentAvg > earlyAvg + 5) return "up";
    if (recentAvg < earlyAvg - 5) return "down";
    return "flat";
  }, [scores, loadDateRange]);

  const narrationLines: NarrationLine[] = useMemo(() => {
    if (trajectory === "up") {
      return [
        { text: `${userName.toUpperCase()}. Your trajectory is UP.`, fontSize: 18, bold: true, delay: 1200 },
        { text: "The data doesn't lie. You're improving.", delay: 800 },
        {
          text: "Don't get comfortable. Comfort is where progress dies.",
          italic: true,
          color: colors.textSecondary,
          delay: 1000,
        },
      ];
    }
    if (trajectory === "down") {
      return [
        { text: `${userName.toUpperCase()}. The numbers are going the wrong direction.`, fontSize: 18, bold: true, delay: 1200 },
        { text: "I don't know what happened. But today, you fix it.", delay: 800 },
        {
          text: "No excuses. Execute.",
          bold: true,
          delay: 1000,
        },
      ];
    }
    // flat
    return [
      { text: `${userName.toUpperCase()}. Your trajectory is FLAT.`, fontSize: 18, bold: true, delay: 1200 },
      { text: "Consistent, but flat. I need to see growth, not maintenance.", delay: 800 },
      {
        text: "Push harder today. Surprise me.",
        italic: true,
        color: colors.textSecondary,
        delay: 1000,
      },
    ];
  }, [userName, trajectory]);

  const handleNarrationComplete = () => {
    setTimeout(() => setShowMission(true), 1200);
  };

  const handleAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markPlayed(6);
    onComplete();
  };

  return (
    <View style={styles.container}>
      {!showMission && (
        <View style={styles.center}>
          <ProtocolNarration
            lines={narrationLines}
            lineGap={800}
            onComplete={handleNarrationComplete}
          />
        </View>
      )}

      {showMission && (
        <ScrollView contentContainerStyle={styles.missionContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.delay(200).duration(500)}>
            <Text style={styles.missionHeader}>OPERATION: RISING</Text>
            <Text style={styles.missionSubheader}>Day 6 | Prove your trajectory</Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(1000).duration(400)} style={styles.footer}>
            <Pressable style={styles.acceptBtn} onPress={handleAccept}>
              <Text style={styles.acceptBtnText}>CONTINUE</Text>
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
  missionContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
    paddingBottom: spacing["3xl"],
  },
  missionHeader: {
    ...fonts.kicker,
    fontSize: 14,
    color: "#FBBF24",
    letterSpacing: 4,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  missionSubheader: {
    ...fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  footer: {
    marginTop: spacing["2xl"],
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
