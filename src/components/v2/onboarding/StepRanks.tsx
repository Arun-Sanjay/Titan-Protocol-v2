import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import {
  RANK_ORDER,
  RANK_NAMES,
  RANK_ABBREVIATIONS,
  RANK_COLORS,
  RANK_REQUIREMENTS,
  type Rank,
} from "../../../lib/ranks-v2";

type Props = { onNext: () => void; onBack: () => void };

/** Reversed so Titan is at top, Initiate at bottom. */
const RANKS_TOP_DOWN = [...RANK_ORDER].reverse();

export function StepRanks({ onNext, onBack }: Props) {
  return (
    <View style={styles.container}>
      {/* Back link */}
      <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
        <Text style={styles.backText}>{"\u2190"} BACK</Text>
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.kicker}>THE RANKS</Text>
        <Text style={styles.heading}>Climb from Initiate to Titan.</Text>
        <Text style={styles.body}>
          Your daily performance determines your rank. Maintain high scores to
          advance. Drop too low and you'll be demoted.
        </Text>
      </View>

      {/* Rank ladder */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {RANKS_TOP_DOWN.map((rank, idx) => {
          const isTitan = rank === "titan";
          const color = RANK_COLORS[rank];
          const req = RANK_REQUIREMENTS[rank];

          return (
            <Animated.View
              key={rank}
              entering={FadeInUp.delay(idx * 50).duration(400)}
              style={[styles.row, isTitan && styles.rowTitan]}
            >
              {/* Colored dot */}
              <View
                style={[
                  styles.dot,
                  { backgroundColor: color },
                  isTitan && styles.dotTitan,
                ]}
              />

              {/* Abbreviation badge */}
              <View style={[styles.badge, { borderColor: color }]}>
                <Text style={[styles.badgeText, { color }]}>
                  {RANK_ABBREVIATIONS[rank]}
                </Text>
              </View>

              {/* Name + requirement */}
              <View style={styles.info}>
                <Text
                  style={[
                    styles.rankName,
                    { color },
                    isTitan && styles.rankNameTitan,
                  ]}
                >
                  {RANK_NAMES[rank]}
                </Text>
                <Text style={styles.requirement}>
                  {req.avgScore === 0
                    ? "Starting rank"
                    : `${req.avgScore}+ avg \u00B7 ${req.consecutiveDays}d`}
                </Text>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Continue button */}
      <Pressable
        style={styles.btn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onNext();
        }}
      >
        <Text style={styles.btnText}>CONTINUE</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["3xl"],
  },

  /* Back */
  backBtn: {
    position: "absolute",
    top: spacing.xl,
    left: spacing.xl,
    zIndex: 10,
  },
  backText: {
    ...fonts.kicker,
    fontSize: 10,
    color: colors.textMuted,
  },

  /* Header */
  header: {
    marginTop: spacing["3xl"],
    marginBottom: spacing.lg,
  },
  kicker: {
    ...fonts.kicker,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 4,
    marginBottom: spacing.xs,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },

  /* Row */
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  rowTitan: {
    backgroundColor: "rgba(255,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,68,68,0.25)",
  },

  /* Dot */
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotTitan: {
    width: 14,
    height: 14,
    borderRadius: 7,
    shadowColor: "#FF4444",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },

  /* Badge */
  badge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 40,
    alignItems: "center",
  },
  badgeText: {
    ...fonts.kicker,
    fontSize: 10,
    letterSpacing: 1,
  },

  /* Info */
  info: { flex: 1, gap: 2 },
  rankName: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1,
  },
  rankNameTitan: {
    fontSize: 17,
    textShadowColor: "rgba(255,68,68,0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  requirement: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },

  /* Button */
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.md,
  },
  btnText: {
    ...fonts.kicker,
    fontSize: 13,
    color: "#000",
    letterSpacing: 2,
  },
});
