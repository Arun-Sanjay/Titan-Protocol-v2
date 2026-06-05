import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts, spacing, radius } from "../../theme";

type Props = {
  label: string;
  change: number;
  thisWeekAvg: number;
  lastWeekAvg: number;
};

/** A single "vs Last Week" card — mirrors web's .tx-comparison-card. */
export const ComparisonCard = React.memo(function ComparisonCard({
  label,
  change,
  thisWeekAvg,
  lastWeekAvg,
}: Props) {
  const improved = change >= 0;
  return (
    <View style={styles.card}>
      <Text style={styles.kicker} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.value, { color: improved ? colors.success : colors.danger }]}>
        {improved ? "↑" : "↓"} {Math.abs(change)}%
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {thisWeekAvg}% vs {lastWeekAvg}%
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "rgba(0,0,0,0.84)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: spacing.xs,
  },
  kicker: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
  },
  value: {
    ...fonts.mono,
    fontSize: 17,
    fontWeight: "700",
  },
  meta: {
    ...fonts.small,
    fontSize: 10,
    color: colors.textMuted,
  },
});
