import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../theme";

type FieldOpDef = {
  id: string;
  name: string;
  description: string;
  type: string;
  minRank: string;
  durationDays: number;
  xpReward: number;
  statBonus: number;
  titleReward: string | null;
};

type OpsCardProps = {
  fieldOp: FieldOpDef;
  isLocked: boolean;
  isOnCooldown: boolean;
  onStart: () => void;
};

export function OpsCard({
  fieldOp,
  isLocked,
  isOnCooldown,
  onStart,
}: OpsCardProps) {
  const disabled = isLocked || isOnCooldown;

  const handleStart = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStart();
  };

  const buttonLabel = isLocked
    ? `RANK ${fieldOp.minRank} REQUIRED`
    : isOnCooldown
      ? "ON COOLDOWN"
      : "START";

  const typeLabel = fieldOp.type.toUpperCase();

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.name}>{fieldOp.name}</Text>
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>{fieldOp.minRank}</Text>
            </View>
          </View>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{typeLabel}</Text>
          </View>
        </View>

        {/* Description */}
        <Text style={styles.description}>{fieldOp.description}</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <Text style={styles.stat}>
            {"\u23F1"} {fieldOp.durationDays} days
          </Text>
          <Text style={styles.statSep}>{"\u00B7"}</Text>
          <Text style={styles.stat}>
            {"\u26A1"} +{fieldOp.xpReward} XP
          </Text>
          <Text style={styles.statSep}>{"\u00B7"}</Text>
          <Text style={styles.stat}>+{fieldOp.statBonus} stats</Text>
        </View>

        {/* Title reward */}
        {fieldOp.titleReward && (
          <Text style={styles.titleReward}>
            {"\uD83C\uDFC6"} Title: {fieldOp.titleReward}
          </Text>
        )}

        {/* Start button */}
        <Pressable
          onPress={handleStart}
          disabled={disabled}
          style={({ pressed }) => [
            styles.button,
            disabled && styles.buttonDisabled,
            pressed && !disabled && styles.buttonPressed,
          ]}
        >
          <Text
            style={[styles.buttonText, disabled && styles.buttonTextDisabled]}
          >
            {buttonLabel}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  rankBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rankBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  typeBadge: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textSecondary,
    letterSpacing: 1.2,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stat: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
  },
  statSep: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  titleReward: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: "#fbbf24",
  },
  button: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  buttonPressed: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  buttonTextDisabled: {
    color: colors.textMuted,
  },
});
