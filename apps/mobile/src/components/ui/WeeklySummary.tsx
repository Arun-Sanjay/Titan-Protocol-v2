import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Panel } from "./Panel";
import { SectionHeader } from "./SectionHeader";
import { colors, spacing, fonts } from "../../theme";
import { formatDateShort } from "../../lib/date";

type Props = {
  avgScore: number;
  tasksCompleted: number;
  bestDayScore: number;
  bestDayDate: string;
};

export const WeeklySummary = React.memo(function WeeklySummary({
  avgScore,
  tasksCompleted,
  bestDayScore,
  bestDayDate,
}: Props) {
  return (
    <>
      <SectionHeader title="THIS WEEK" />
      <View style={styles.row}>
        <Panel style={styles.card}>
          <Text style={styles.label}>AVG TITAN SCORE</Text>
          <Text style={styles.value}>{avgScore}%</Text>
        </Panel>
        <Panel style={styles.card}>
          <Text style={styles.label}>TASKS COMPLETED</Text>
          <Text style={styles.value}>{tasksCompleted}</Text>
        </Panel>
        <Panel style={styles.card}>
          <Text style={styles.label}>BEST DAY</Text>
          <Text style={styles.value}>{bestDayScore}%</Text>
          <Text style={styles.subLabel}>{formatDateShort(bestDayDate)}</Text>
        </Panel>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  card: {
    flex: 1,
  },
  label: {
    ...fonts.kicker,
    fontSize: 8,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  value: {
    ...fonts.monoValue,
    fontSize: 22,
  },
  subLabel: {
    ...fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
});
