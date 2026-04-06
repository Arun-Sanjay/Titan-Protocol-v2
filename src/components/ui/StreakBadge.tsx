import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, fonts, shadows } from "../../theme";

type Props = {
  streak: number;
};

export const StreakBadge = React.memo(function StreakBadge({ streak }: Props) {
  if (streak === 0) return null;

  const fireSize = streak >= 30 ? 28 : streak >= 14 ? 24 : streak >= 7 ? 20 : 16;

  return (
    <View style={styles.container}>
      <Text style={[styles.fire, { fontSize: fireSize }]}>🔥</Text>
      <Text style={styles.count}>{streak}</Text>
      <Text style={styles.label}>DAY STREAK</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warningDim,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.15)",
    gap: spacing.xs,
    alignSelf: "center",
    ...shadows.glow,
    shadowColor: colors.warning,
    shadowOpacity: 0.1,
  },
  fire: {},
  count: {
    ...fonts.mono,
    fontSize: 16,
    fontWeight: "800",
    color: colors.warning,
  },
  label: {
    ...fonts.kicker,
    fontSize: 10,
    color: colors.warning,
  },
});
