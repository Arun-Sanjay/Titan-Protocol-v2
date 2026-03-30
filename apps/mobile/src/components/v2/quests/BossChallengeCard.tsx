import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fonts } from "../../../theme";
import type { BossChallenge } from "../../../stores/useQuestStore";

type Props = {
  challenge: BossChallenge;
  onAccept?: () => void;
  delay?: number;
};

export function BossChallengeCard({ challenge, onAccept, delay = 0 }: Props) {
  const isActive = challenge.active;
  const isCompleted = challenge.completed;

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)}>
      <View style={[styles.card, isActive && styles.cardActive, isCompleted && styles.cardCompleted]}>
        {/* Header */}
        <View style={styles.topRow}>
          <Ionicons
            name={isCompleted ? "trophy" : isActive ? "flame" : "lock-closed-outline"}
            size={22}
            color={isCompleted ? colors.warning : isActive ? colors.danger : colors.textMuted}
          />
          <View style={styles.titleArea}>
            <Text style={styles.kicker}>
              {isCompleted ? "COMPLETED" : isActive ? "BOSS CHALLENGE ACTIVE" : "BOSS CHALLENGE"}
            </Text>
            <Text style={styles.title}>{challenge.title}</Text>
            <Text style={styles.description}>{challenge.description}</Text>
          </View>
          <View style={styles.xpBadge}>
            <Text style={styles.xpText}>+{challenge.xpReward}</Text>
            <Text style={styles.xpLabel}>XP</Text>
          </View>
        </View>

        {/* Day progress dots */}
        {(isActive || isCompleted) && (
          <View style={styles.dotsRow}>
            {Array.from({ length: challenge.daysRequired }).map((_, idx) => {
              const hasResult = idx < challenge.dayResults.length;
              const passed = hasResult && challenge.dayResults[idx];
              return (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    passed && styles.dotPassed,
                    hasResult && !passed && styles.dotFailed,
                    !hasResult && idx === challenge.currentDay && styles.dotCurrent,
                  ]}
                />
              );
            })}
            <Text style={styles.dayLabel}>
              Day {challenge.currentDay}/{challenge.daysRequired}
            </Text>
          </View>
        )}

        {/* Accept button (when available but not started) */}
        {!isActive && !isCompleted && !challenge.failed && onAccept && (
          <Pressable style={styles.acceptBtn} onPress={onAccept}>
            <Text style={styles.acceptText}>ACCEPT CHALLENGE</Text>
          </Pressable>
        )}

        {/* Failed — retry available */}
        {challenge.failed && !isActive && !isCompleted && onAccept && (
          <Pressable style={styles.retryBtn} onPress={onAccept}>
            <Text style={styles.retryText}>RETRY</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardActive: {
    borderColor: "rgba(251, 191, 36, 0.30)",
    backgroundColor: "rgba(251, 191, 36, 0.03)",
  },
  cardCompleted: {
    borderColor: "rgba(52, 211, 153, 0.30)",
    backgroundColor: "rgba(52, 211, 153, 0.03)",
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
  kicker: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.warning,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  description: {
    fontSize: 12,
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
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  dotPassed: {
    backgroundColor: colors.success,
  },
  dotFailed: {
    backgroundColor: colors.danger,
  },
  dotCurrent: {
    borderWidth: 2,
    borderColor: colors.warning,
    backgroundColor: "transparent",
  },
  dayLabel: {
    ...fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: "auto",
  },
  acceptBtn: {
    paddingVertical: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.warning,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  acceptText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.bg,
    letterSpacing: 2,
  },
  retryBtn: {
    paddingVertical: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.warning,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  retryText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.warning,
    letterSpacing: 2,
  },
});
