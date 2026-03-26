import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius } from "../../theme";

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
    gap: spacing.xs,
    alignSelf: "center",
  },
  fire: {},
  count: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.warning,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.warning,
    letterSpacing: 1,
  },
});
