import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fonts } from "../../../theme";
import { Panel } from "../../ui/Panel";
import type { Quest } from "../../../stores/useQuestStore";

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  engine: { icon: "speedometer-outline", color: colors.body },
  cross_engine: { icon: "git-merge-outline", color: colors.general },
  wildcard: { icon: "star-outline", color: colors.warning },
};

type Props = {
  quest: Quest;
  delay?: number;
};

export function QuestCard({ quest, delay = 0 }: Props) {
  const progress = quest.targetValue > 0
    ? Math.min(100, Math.round((quest.currentValue / quest.targetValue) * 100))
    : 0;
  const isComplete = quest.status === "completed";
  const config = TYPE_ICONS[quest.type] ?? TYPE_ICONS.wildcard;

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)}>
      <Panel style={[styles.card, isComplete && styles.cardComplete]}>
        <View style={styles.topRow}>
          <Ionicons
            name={config.icon as keyof typeof Ionicons.glyphMap}
            size={20}
            color={isComplete ? colors.success : config.color}
          />
          <View style={styles.titleArea}>
            <Text style={[styles.title, isComplete && styles.titleComplete]}>
              {quest.title}
            </Text>
            <Text style={styles.description} numberOfLines={2}>
              {quest.description}
            </Text>
          </View>
          <View style={styles.xpBadge}>
            <Text style={styles.xpText}>+{quest.xpReward}</Text>
            <Text style={styles.xpLabel}>XP</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress}%`,
                  backgroundColor: isComplete ? colors.success : config.color,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {isComplete ? "Complete" : `${quest.currentValue}/${quest.targetValue}`}
          </Text>
        </View>
      </Panel>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  cardComplete: {
    opacity: 0.7,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  titleArea: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  titleComplete: {
    textDecorationLine: "line-through",
    color: colors.success,
  },
  description: {
    fontSize: 12,
    fontWeight: "400",
    color: colors.textMuted,
    lineHeight: 18,
  },
  xpBadge: {
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  xpText: {
    ...fonts.mono,
    fontSize: 13,
    fontWeight: "700",
    color: colors.warning,
  },
  xpLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 1,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    ...fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    width: 60,
    textAlign: "right",
  },
});
