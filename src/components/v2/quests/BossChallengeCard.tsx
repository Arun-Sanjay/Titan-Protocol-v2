import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fonts } from "../../../theme";
import type { BossChallenge } from "../../../types/boss-ui";

type Props = {
  challenge: BossChallenge;
  onAccept?: () => void;
  /** Record today's result. Only meaningful while `challenge.active`. */
  onLogPass?: () => void;
  onLogFail?: () => void;
  /** Abandon an active boss. Only meaningful while `challenge.active`. */
  onAbandon?: () => void;
  /**
   * When true, today's result has already been logged — the log buttons
   * become a "logged" status pill so we don't accept a second tap.
   */
  loggedToday?: boolean;
  delay?: number;
};

export function BossChallengeCard({
  challenge,
  onAccept,
  onLogPass,
  onLogFail,
  onAbandon,
  loggedToday,
  delay = 0,
}: Props) {
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

        {/* Active — log today's result + abandon. Without this row, accepting
            a boss left the user with a card that displayed but had no path
            to actually progress, complete, or fail it. */}
        {isActive && (onLogPass || onLogFail || onAbandon) && (
          <View style={styles.actionRow}>
            {loggedToday ? (
              <View style={styles.loggedPill}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={styles.loggedText}>LOGGED TODAY</Text>
              </View>
            ) : (
              <View style={styles.logRow}>
                {onLogPass && (
                  <Pressable style={styles.logPassBtn} onPress={onLogPass}>
                    <Text style={styles.logPassText}>LOG PASS</Text>
                  </Pressable>
                )}
                {onLogFail && (
                  <Pressable style={styles.logFailBtn} onPress={onLogFail}>
                    <Text style={styles.logFailText}>LOG FAIL</Text>
                  </Pressable>
                )}
              </View>
            )}
            {onAbandon && (
              <Pressable style={styles.abandonBtn} onPress={onAbandon}>
                <Text style={styles.abandonText}>ABANDON</Text>
              </Pressable>
            )}
          </View>
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
  actionRow: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  logRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  logPassBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: "center",
  },
  logPassText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.bg,
    letterSpacing: 2,
  },
  logFailBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: "center",
  },
  logFailText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.danger,
    letterSpacing: 2,
  },
  loggedPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: 10,
    backgroundColor: "rgba(52, 211, 153, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.25)",
  },
  loggedText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.success,
    letterSpacing: 1.5,
  },
  abandonBtn: {
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  abandonText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
});
