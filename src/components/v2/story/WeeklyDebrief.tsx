import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  FadeIn,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, shadows } from "../../../theme";

/* ─── Types ───────────────────────────────────────────────────────── */

type Assessment = "EXCEPTIONAL" | "SOLID" | "NEEDS_WORK" | "CRITICAL";

type EngineScore = {
  current: number;
  previous: number;
};

type WeekData = {
  weekNumber: number;
  avgScore: number;
  prevAvgScore: number;
  engineScores: Record<string, EngineScore>;
  streakDays: number;
  xpEarned: number;
  tasksCompleted: number;
  questsCompleted: number;
  assessment: Assessment;
};

type Props = {
  weekData: WeekData;
  onDismiss: () => void;
};

/* ─── Constants ───────────────────────────────────────────────────── */

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

const SECTION_DELAY = 400; // ms between each section reveal

const ENGINE_COLORS: Record<string, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  charisma: colors.charisma,
};

const ENGINE_LABELS: Record<string, string> = {
  body: "BODY",
  mind: "MIND",
  money: "MONEY",
  charisma: "CHARISMA",
};

const ASSESSMENT_COLORS: Record<Assessment, string> = {
  EXCEPTIONAL: "#FFD700",
  SOLID: colors.success,
  NEEDS_WORK: colors.warning,
  CRITICAL: colors.danger,
};

const ASSESSMENT_LABELS: Record<Assessment, string> = {
  EXCEPTIONAL: "EXCEPTIONAL",
  SOLID: "SOLID",
  NEEDS_WORK: "NEEDS WORK",
  CRITICAL: "CRITICAL",
};

/* ─── Utility ─────────────────────────────────────────────────────── */

function getDelta(current: number, previous: number): { arrow: string; color: string; text: string } {
  const diff = current - previous;
  if (diff > 0) return { arrow: "\u25B2", color: colors.success, text: `+${diff}` };
  if (diff < 0) return { arrow: "\u25BC", color: colors.danger, text: `${diff}` };
  return { arrow: "\u2500", color: colors.textMuted, text: "0" };
}

/* ─── Animated Section Wrapper ────────────────────────────────────── */

function RevealSection({
  delay,
  children,
}: {
  delay: number;
  children: React.ReactNode;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={animStyle}>{children}</Animated.View>;
}

/* ─── Main Component ──────────────────────────────────────────────── */

export const WeeklyDebrief = React.memo(function WeeklyDebrief({
  weekData,
  onDismiss,
}: Props) {
  const {
    weekNumber,
    avgScore,
    prevAvgScore,
    engineScores,
    streakDays,
    xpEarned,
    tasksCompleted,
    questsCompleted,
    assessment,
  } = weekData;

  const overallDelta = useMemo(() => getDelta(avgScore, prevAvgScore), [avgScore, prevAvgScore]);
  const assessmentColor = ASSESSMENT_COLORS[assessment];

  const engineKeys = useMemo(
    () => Object.keys(engineScores).filter((k) => ENGINE_LABELS[k]),
    [engineScores],
  );

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDismiss();
  };

  // Section timing offsets
  const t0 = 200;            // header
  const t1 = t0 + SECTION_DELAY;  // overall score
  const t2 = t1 + SECTION_DELAY;  // engine breakdown
  const t3 = t2 + SECTION_DELAY;  // stats grid
  const t4 = t3 + SECTION_DELAY;  // assessment
  const t5 = t4 + SECTION_DELAY;  // dismiss button

  return (
    <View style={styles.container}>
      {/* Scanline decoration */}
      <View style={styles.scanlines} pointerEvents="none" />

      {/* ─── Header ─────────────────────────────────────────────── */}
      <RevealSection delay={t0}>
        <View style={styles.headerBlock}>
          <Text style={styles.headerLabel}>WEEKLY DEBRIEF</Text>
          <View style={styles.headerDivider} />
          <Text style={styles.headerWeek}>WEEK {weekNumber}</Text>
        </View>
        <View style={styles.headerLine} />
      </RevealSection>

      {/* ─── Section 1: Overall Score ───────────────────────────── */}
      <RevealSection delay={t1}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>OVERALL PERFORMANCE</Text>
          <View style={styles.overallRow}>
            <Text style={styles.overallScore}>{avgScore}</Text>
            <View style={styles.overallDeltaRow}>
              <Text style={[styles.deltaArrow, { color: overallDelta.color }]}>
                {overallDelta.arrow}
              </Text>
              <Text style={[styles.deltaText, { color: overallDelta.color }]}>
                {overallDelta.text}
              </Text>
            </View>
            <Text style={styles.overallPrev}>
              prev: {prevAvgScore}
            </Text>
          </View>
        </View>
      </RevealSection>

      {/* ─── Section 2: Engine Breakdown ────────────────────────── */}
      <RevealSection delay={t2}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ENGINE BREAKDOWN</Text>
          {engineKeys.map((key) => {
            const score = engineScores[key];
            const delta = getDelta(score.current, score.previous);
            const engineColor = ENGINE_COLORS[key] ?? colors.textSecondary;
            return (
              <View key={key} style={styles.engineRow}>
                <View style={[styles.engineDot, { backgroundColor: engineColor }]} />
                <Text style={[styles.engineName, { color: engineColor }]}>
                  {ENGINE_LABELS[key] ?? key.toUpperCase()}
                </Text>
                <Text style={styles.engineScore}>{score.current}</Text>
                <Text style={[styles.engineDelta, { color: delta.color }]}>
                  {delta.arrow} {delta.text}
                </Text>
              </View>
            );
          })}
        </View>
      </RevealSection>

      {/* ─── Section 3: Stats Grid ──────────────────────────────── */}
      <RevealSection delay={t3}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>OPERATIONAL STATS</Text>
          <View style={styles.statsGrid}>
            <StatCell label="STREAK" value={`${streakDays}d`} />
            <StatCell label="XP EARNED" value={`+${xpEarned.toLocaleString()}`} />
            <StatCell label="TASKS" value={`${tasksCompleted}`} />
            <StatCell label="QUESTS" value={`${questsCompleted}`} />
          </View>
        </View>
      </RevealSection>

      {/* ─── Section 4: Assessment Banner ───────────────────────── */}
      <RevealSection delay={t4}>
        <View style={[styles.assessmentBanner, { borderColor: assessmentColor + "40" }]}>
          <Text style={styles.assessmentPrefix}>PROTOCOL ASSESSMENT:</Text>
          <Text style={[styles.assessmentValue, { color: assessmentColor }]}>
            {ASSESSMENT_LABELS[assessment]}
          </Text>
        </View>
      </RevealSection>

      {/* ─── Dismiss Button ─────────────────────────────────────── */}
      <RevealSection delay={t5}>
        <Pressable
          onPress={handleDismiss}
          style={({ pressed }) => [
            styles.dismissButton,
            pressed && styles.dismissButtonPressed,
          ]}
        >
          <Text style={styles.dismissText}>ACKNOWLEDGED</Text>
        </Pressable>
      </RevealSection>
    </View>
  );
});

/* ─── Stat Cell ───────────────────────────────────────────────────── */

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing["3xl"],
    justifyContent: "center",
    gap: spacing.xl,
  },

  // Scanline decoration (subtle)
  scanlines: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.03,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.5)",
  },

  // Header
  headerBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerLabel: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 3,
  },
  headerDivider: {
    fontFamily: MONO,
    width: 2,
    height: 14,
    backgroundColor: colors.surfaceBorder,
  },
  headerWeek: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 2,
  },
  headerLine: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
    marginTop: spacing.md,
  },

  // Sections
  section: {
    gap: spacing.md,
  },
  sectionLabel: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 2.5,
  },

  // Overall score
  overallRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.lg,
  },
  overallScore: {
    fontFamily: MONO,
    fontSize: 48,
    fontWeight: "300",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  overallDeltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  deltaArrow: {
    fontFamily: MONO,
    fontSize: 16,
    fontWeight: "700",
  },
  deltaText: {
    fontFamily: MONO,
    fontSize: 16,
    fontWeight: "700",
  },
  overallPrev: {
    fontFamily: MONO,
    fontSize: 12,
    color: colors.textMuted,
  },

  // Engine breakdown
  engineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
    gap: spacing.sm,
  },
  engineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  engineName: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    flex: 1,
  },
  engineScore: {
    fontFamily: MONO,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    minWidth: 36,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  engineDelta: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: "600",
    minWidth: 48,
    textAlign: "right",
  },

  // Stats grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  statCell: {
    width: "47%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  statValue: {
    fontFamily: MONO,
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 2,
  },

  // Assessment banner
  assessmentBanner: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  assessmentPrefix: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 2.5,
  },
  assessmentValue: {
    fontFamily: MONO,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 4,
  },

  // Dismiss button
  dismissButton: {
    alignSelf: "center",
    borderWidth: 1,
    borderColor: colors.surfaceBorderStrong,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["3xl"],
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    marginTop: spacing.md,
  },
  dismissButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.10)",
  },
  dismissText: {
    fontFamily: MONO,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 3,
  },
});
