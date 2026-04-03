import React, { useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  FadeInDown,
  Easing,
} from "react-native-reanimated";
import { colors, spacing, radius, fonts, shadows } from "../../theme";

/* ─── Types ───────────────────────────────────────────────────────── */

type QuestStatus = "active" | "completed" | "failed";

type Quest = {
  id: string;
  title: string;
  description: string;
  status: QuestStatus;
  targetType: string;
  targetValue: number;
  currentValue: number;
  xpReward: number;
};

type BossChallenge = {
  name: string;
  description: string;
  daysRequired: number;
  daysCompleted: number;
  active: boolean;
};

type WeekStats = {
  missionsCleared: number;
  totalMissions: number;
  xpEarned: number;
};

type Props = {
  quests: Quest[];
  bossChallenge?: BossChallenge | null;
  weekStats?: WeekStats;
};

/* ─── Constants ───────────────────────────────────────────────────── */

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

const ENGINE_COLORS: Record<string, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  charisma: colors.charisma,
};

const STATUS_CONFIG: Record<QuestStatus, { label: string; color: string; icon: string }> = {
  active: { label: "IN PROGRESS", color: colors.text, icon: "\u25B6" },
  completed: { label: "CLEARED", color: colors.success, icon: "\u2713" },
  failed: { label: "FAILED", color: colors.danger, icon: "\u2717" },
};

function getGrade(current: number, target: number): string {
  const ratio = target > 0 ? current / target : 0;
  if (ratio >= 1.5) return "S";
  if (ratio >= 1.2) return "A";
  if (ratio >= 1.0) return "B";
  if (ratio >= 0.7) return "C";
  return "D";
}

/* ─── Mission Card ────────────────────────────────────────────────── */

const MissionCard = React.memo(function MissionCard({
  quest,
  index,
}: {
  quest: Quest;
  index: number;
}) {
  const borderColor = ENGINE_COLORS[quest.targetType] ?? colors.surfaceBorder;
  const status = STATUS_CONFIG[quest.status];
  const progress = quest.targetValue > 0
    ? Math.min(quest.currentValue / quest.targetValue, 1)
    : 0;
  const isComplete = quest.status === "completed";

  return (
    <Animated.View
      entering={FadeInDown.delay(100 + index * 80).duration(400).easing(Easing.out(Easing.cubic))}
      style={[
        styles.missionCard,
        { borderLeftColor: borderColor, borderLeftWidth: 3 },
      ]}
    >
      {/* Header row */}
      <View style={styles.missionHeader}>
        <View style={styles.missionTitleRow}>
          <Text style={styles.statusIcon}>{status.icon}</Text>
          <Text
            style={[
              styles.missionTitle,
              isComplete && styles.missionTitleComplete,
            ]}
            numberOfLines={1}
          >
            {quest.title}
          </Text>
        </View>
        <View style={[styles.statusBadge, { borderColor: status.color + "40" }]}>
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.missionDesc} numberOfLines={2}>
        {quest.description}
      </Text>

      {/* Progress bar */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: isComplete ? colors.success : borderColor,
              },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {quest.currentValue}/{quest.targetValue}
        </Text>
      </View>

      {/* Footer: XP + Grade */}
      <View style={styles.missionFooter}>
        <Text style={styles.xpReward}>
          {isComplete ? "" : "+"}{quest.xpReward} XP
        </Text>
        {isComplete && (
          <View style={styles.gradeBadge}>
            <Text style={styles.gradeText}>
              RANK {getGrade(quest.currentValue, quest.targetValue)}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
});

/* ─── Boss Challenge Card ─────────────────────────────────────────── */

const BossChallengeCard = React.memo(function BossChallengeCard({
  boss,
}: {
  boss: BossChallenge;
}) {
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (boss.active) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.6, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
  }, [boss.active]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const progress = boss.daysRequired > 0
    ? boss.daysCompleted / boss.daysRequired
    : 0;

  return (
    <Animated.View
      entering={FadeInDown.delay(60).duration(500).easing(Easing.out(Easing.cubic))}
      style={styles.bossCard}
    >
      {/* Pulsing border glow */}
      <Animated.View style={[styles.bossGlow, pulseStyle]} pointerEvents="none" />

      {/* Classification header */}
      <View style={styles.bossClassification}>
        <Text style={styles.bossClassLabel}>HIGH VALUE TARGET</Text>
        <View style={styles.bossThreatBadge}>
          <Text style={styles.bossThreatText}>
            {boss.active ? "ACTIVE" : "INACTIVE"}
          </Text>
        </View>
      </View>

      {/* Name */}
      <Text style={styles.bossName}>{boss.name}</Text>
      <Text style={styles.bossDesc}>{boss.description}</Text>

      {/* Multi-day progress */}
      <View style={styles.bossDaysRow}>
        {Array.from({ length: boss.daysRequired }, (_, i) => {
          const filled = i < boss.daysCompleted;
          return (
            <View
              key={i}
              style={[
                styles.bossDayBlock,
                filled && styles.bossDayBlockFilled,
              ]}
            >
              <Text style={[styles.bossDayText, filled && styles.bossDayTextFilled]}>
                {filled ? "\u2713" : i + 1}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Progress summary */}
      <Text style={styles.bossProgress}>
        DAY {boss.daysCompleted} / {boss.daysRequired} COMPLETE
      </Text>
    </Animated.View>
  );
});

/* ─── Weekly Summary Bar ──────────────────────────────────────────── */

const WeeklySummaryBar = React.memo(function WeeklySummaryBar({
  stats,
}: {
  stats: WeekStats;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(400).duration(400).easing(Easing.out(Easing.cubic))}
      style={styles.summaryBar}
    >
      <Text style={styles.summaryText}>
        MISSIONS: {stats.missionsCleared}/{stats.totalMissions}
      </Text>
      <View style={styles.summaryDivider} />
      <Text style={styles.summaryText}>
        XP: +{stats.xpEarned.toLocaleString()}
      </Text>
    </Animated.View>
  );
});

/* ─── Main Component ──────────────────────────────────────────────── */

export const MissionBoard = React.memo(function MissionBoard({
  quests,
  bossChallenge,
  weekStats,
}: Props) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(0).duration(400).easing(Easing.out(Easing.cubic))}
        style={styles.headerRow}
      >
        <Text style={styles.headerTitle}>WAR ROOM // MISSION BOARD</Text>
        <View style={styles.headerLine} />
      </Animated.View>

      {/* Boss Challenge */}
      {bossChallenge && bossChallenge.active && (
        <BossChallengeCard boss={bossChallenge} />
      )}

      {/* Quest list */}
      {quests.map((quest, index) => (
        <MissionCard key={quest.id} quest={quest} index={index} />
      ))}

      {/* Empty state */}
      {quests.length === 0 && (
        <Animated.View
          entering={FadeInDown.delay(120).duration(400)}
          style={styles.emptyState}
        >
          <Text style={styles.emptyText}>NO ACTIVE MISSIONS</Text>
          <Text style={styles.emptySubtext}>
            Awaiting new directives...
          </Text>
        </Animated.View>
      )}

      {/* Weekly summary */}
      {weekStats && <WeeklySummaryBar stats={weekStats} />}
    </View>
  );
});

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },

  // Header
  headerRow: {
    gap: spacing.sm,
  },
  headerTitle: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  headerLine: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
  },

  // Mission Card
  missionCard: {
    backgroundColor: "rgba(0, 0, 0, 0.84)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  missionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  missionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  statusIcon: {
    fontFamily: MONO,
    fontSize: 12,
    color: colors.textMuted,
  },
  missionTitle: {
    fontFamily: MONO,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flex: 1,
  },
  missionTitleComplete: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  missionDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },

  // Progress bar
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressLabel: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    minWidth: 44,
    textAlign: "right",
  },

  // Footer
  missionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  xpReward: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  gradeBadge: {
    backgroundColor: colors.successDim,
    borderWidth: 1,
    borderColor: colors.success + "30",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  gradeText: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: "700",
    color: colors.success,
    letterSpacing: 1,
  },

  // Boss Challenge
  bossCard: {
    backgroundColor: "rgba(248, 113, 113, 0.04)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.25)",
    padding: spacing.lg,
    gap: spacing.sm,
    overflow: "hidden",
    ...shadows.card,
  },
  bossGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.35)",
  },
  bossClassification: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bossClassLabel: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: "700",
    color: colors.danger,
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  bossThreatBadge: {
    backgroundColor: "rgba(248, 113, 113, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.30)",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  bossThreatText: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: "700",
    color: colors.danger,
    letterSpacing: 1.5,
  },
  bossName: {
    fontFamily: MONO,
    fontSize: 18,
    fontWeight: "800",
    color: colors.warning,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  bossDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Boss day blocks
  bossDaysRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm,
    flexWrap: "wrap",
  },
  bossDayBlock: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  bossDayBlockFilled: {
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderColor: "rgba(251, 191, 36, 0.40)",
  },
  bossDayText: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
  },
  bossDayTextFilled: {
    color: colors.warning,
  },
  bossProgress: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },

  // Weekly summary
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  summaryDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.surfaceBorder,
  },
  summaryText: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 1.5,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
    gap: spacing.sm,
  },
  emptyText: {
    fontFamily: MONO,
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 2,
  },
  emptySubtext: {
    fontFamily: MONO,
    fontSize: 12,
    color: colors.textMuted,
  },
});
