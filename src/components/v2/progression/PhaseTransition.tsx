import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts } from "../../../theme";
import type { PhaseStats } from "../../../lib/progression-engine";
import { getPhaseMotivation, type Phase } from "../../../lib/progression-engine";

type Props = {
  oldPhase: Phase;
  newPhase: Phase;
  stats: PhaseStats;
  onComplete: () => void;
};

type Screen = 1 | 2 | 3;

export function PhaseTransition({ oldPhase, newPhase, stats, onComplete }: Props) {
  const [screen, setScreen] = useState<Screen>(1);

  // Screen 1: auto-advance after 2s
  useEffect(() => {
    if (screen === 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const timer = setTimeout(() => setScreen(2), 2000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  // Screen 2: auto-advance after 3s
  useEffect(() => {
    if (screen === 2) {
      const timer = setTimeout(() => setScreen(3), 3000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  const phaseLabel = oldPhase.charAt(0).toUpperCase() + oldPhase.slice(1);
  const newPhaseLabel = newPhase.charAt(0).toUpperCase() + newPhase.slice(1);

  if (screen === 1) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Animated.Text entering={FadeIn.duration(600)} style={styles.phaseComplete}>
            {phaseLabel.toUpperCase()} PHASE
          </Animated.Text>
          <Animated.Text entering={FadeIn.delay(400).duration(600)} style={styles.completeText}>
            COMPLETE
          </Animated.Text>
        </View>
      </View>
    );
  }

  if (screen === 2) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Animated.Text entering={FadeIn.duration(400)} style={styles.statsTitle}>
            YOUR {phaseLabel.toUpperCase()} PHASE
          </Animated.Text>

          <View style={styles.statsGrid}>
            <StatItem label="Days Completed" value={`${stats.daysCompleted}/${stats.totalDays}`} delay={200} />
            <StatItem label="Average Score" value={`${stats.avgScore}%`} delay={350} />
            <StatItem label="Best Streak" value={`${stats.bestStreak} days`} delay={500} />
            <StatItem label="Best Rank" value={stats.bestRank} delay={650} />
          </View>
        </View>
      </View>
    );
  }

  // Screen 3: user-controlled
  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Animated.Text entering={FadeIn.duration(600)} style={styles.entering}>
          ENTERING
        </Animated.Text>
        <Animated.Text entering={FadeIn.delay(300).duration(600)} style={styles.newPhase}>
          {newPhaseLabel.toUpperCase()} PHASE
        </Animated.Text>
        <Animated.Text entering={FadeIn.delay(600).duration(600)} style={styles.motivation}>
          {getPhaseMotivation(newPhase)}
        </Animated.Text>
      </View>

      <Animated.View entering={FadeIn.delay(900).duration(400)}>
        <Pressable style={styles.button} onPress={onComplete}>
          <Text style={styles.buttonText}>LET'S GO</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function StatItem({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)} style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing["2xl"],
    justifyContent: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.lg,
  },
  phaseComplete: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 4,
  },
  completeText: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 6,
  },
  statsTitle: {
    ...fonts.kicker,
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: spacing.xl,
  },
  statsGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
    justifyContent: "center",
  },
  statItem: {
    width: "42%",
    alignItems: "center",
    paddingVertical: spacing.xl,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    gap: spacing.xs,
  },
  statValue: {
    ...fonts.monoValue,
    fontSize: 22,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  entering: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 4,
  },
  newPhase: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 3,
    textAlign: "center",
  },
  motivation: {
    fontSize: 16,
    fontWeight: "400",
    color: colors.textSecondary,
    lineHeight: 24,
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  button: {
    paddingVertical: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    marginBottom: spacing["3xl"],
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.bg,
    letterSpacing: 3,
  },
});
