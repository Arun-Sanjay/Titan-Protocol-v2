import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { titanColors } from "../../../theme/colors";

type Props = {
  onNext: () => void;
  onBack: () => void;
};

const XP_REFERENCE = [
  { label: "Mission", value: "+20 XP" },
  { label: "Side Quest", value: "+10 XP" },
  { label: "Habit", value: "+5 XP" },
  { label: "Journal", value: "+15 XP" },
];

const RANKS = [
  { label: "D", color: colors.rankD },
  { label: "C", color: colors.rankC },
  { label: "B", color: colors.rankB },
  { label: "A", color: colors.rankA },
  { label: "S", color: colors.rankS },
  { label: "SS", color: colors.rankSS },
];

const PHASES = [
  { label: "Foundation", range: "Weeks 1\u20134", active: true },
  { label: "Building", range: "Weeks 5\u20138", active: false },
  { label: "Intensify", range: "Weeks 9\u201312", active: false },
  { label: "Sustain", range: "Week 13+", active: false },
];

export function WalkthroughProgression({ onNext, onBack }: Props) {
  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onNext();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.kicker}>PROGRESSION</Text>
        <Text style={styles.subtitle}>
          Every action counts. Nothing is wasted.
        </Text>

        {/* Section 1: XP & Levels */}
        <Animated.View
          entering={FadeInDown.delay(0).duration(400)}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>XP & LEVELS</Text>
          <Text style={styles.sectionDesc}>
            Every task, habit, and session earns XP.
          </Text>
          <View style={styles.xpGrid}>
            {XP_REFERENCE.map((item) => (
              <View key={item.label} style={styles.xpRow}>
                <Text style={styles.xpLabel}>{item.label}</Text>
                <Text style={styles.xpValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Section 2: Streaks & Ranks */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(400)}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>STREAKS & RANKS</Text>
          <Text style={styles.sectionDesc}>
            Consistency raises your rank. Break a streak and you reset.
          </Text>
          <View style={styles.rankRow}>
            {RANKS.map((rank, i) => (
              <View key={rank.label} style={styles.rankItem}>
                <View
                  style={[
                    styles.rankBadge,
                    { borderColor: rank.color },
                  ]}
                >
                  <Text style={[styles.rankLetter, { color: rank.color }]}>
                    {rank.label}
                  </Text>
                </View>
                {i < RANKS.length - 1 && (
                  <Text style={styles.rankArrow}>{"\u2192"}</Text>
                )}
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Section 3: Phases */}
        <Animated.View
          entering={FadeInDown.delay(240).duration(400)}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>PHASES</Text>
          <Text style={styles.sectionDesc}>
            The protocol evolves as you do.
          </Text>
          <View style={styles.phaseTimeline}>
            {PHASES.map((phase, i) => (
              <View key={phase.label} style={styles.phaseItem}>
                <View style={styles.phaseNodeCol}>
                  <View
                    style={[
                      styles.phaseNode,
                      i === 0 && { borderColor: colors.accent, backgroundColor: colors.accentDim },
                    ]}
                  />
                  {i < PHASES.length - 1 && <View style={styles.phaseLine} />}
                </View>
                <View style={styles.phaseContent}>
                  <Text
                    style={[
                      styles.phaseName,
                      i === 0 && { color: colors.accent },
                    ]}
                  >
                    {phase.label}
                  </Text>
                  <Text style={styles.phaseRange}>{phase.range}</Text>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Next button */}
      <Pressable onPress={handleNext} style={styles.button}>
        <Text style={styles.buttonText}>Next</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing["2xl"],
    paddingBottom: spacing["3xl"],
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  kicker: {
    ...fonts.kicker,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 23,
    marginBottom: spacing["2xl"],
  },
  section: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...fonts.kicker,
    marginBottom: spacing.xs,
  },
  sectionDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  xpGrid: {
    gap: spacing.sm,
  },
  xpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  xpLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  xpValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accent,
    fontVariant: ["tabular-nums"],
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  rankItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  rankLetter: {
    fontSize: 13,
    fontWeight: "800",
  },
  rankArrow: {
    fontSize: 10,
    color: colors.textMuted,
  },
  phaseTimeline: {
    gap: 0,
  },
  phaseItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  phaseNodeCol: {
    alignItems: "center",
    width: 24,
    marginRight: spacing.md,
  },
  phaseNode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: "transparent",
  },
  phaseLine: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  phaseContent: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  phaseName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 1,
  },
  phaseRange: {
    fontSize: 11,
    color: colors.textMuted,
  },
  button: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },
});
