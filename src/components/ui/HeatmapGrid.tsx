import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, fonts } from "../../theme";

type Props = {
  data: { dateKey: string; score: number }[]; // 84 items, oldest first
};

function getIntensityColor(score: number): string {
  if (score === 0) return "rgba(255, 255, 255, 0.04)";
  if (score < 25) return "rgba(255, 255, 255, 0.12)";
  if (score < 50) return "rgba(255, 255, 255, 0.25)";
  if (score < 75) return "rgba(255, 255, 255, 0.45)";
  return "rgba(255, 255, 255, 0.75)";
}

const DAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
const CELL_SIZE = 11;
const CELL_GAP = 3;

export const HeatmapGrid = React.memo(function HeatmapGrid({ data }: Props) {
  // Organize data into weeks (columns) × days (rows)
  // data[0] is oldest, data[83] is today
  // We need to align to weekdays: row 0=Mon, row 6=Sun
  const weeks: { dateKey: string; score: number }[][] = [];
  let currentWeek: { dateKey: string; score: number }[] = [];

  for (const item of data) {
    const d = new Date(item.dateKey + "T00:00:00");
    const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon
    const row = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Mon=0, Sun=6

    // Fill gaps at start of week
    while (currentWeek.length < row) {
      currentWeek.push({ dateKey: "", score: -1 });
    }

    currentWeek.push(item);

    if (row === 6 || item === data[data.length - 1]) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  return (
    <View style={styles.container}>
      {/* Day labels */}
      <View style={styles.dayLabels}>
        {DAYS.map((label, i) => (
          <Text key={i} style={[styles.dayLabel, { height: CELL_SIZE + CELL_GAP }]}>
            {label}
          </Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.column}>
            {week.map((day, di) => (
              <View
                key={di}
                style={[
                  styles.cell,
                  {
                    backgroundColor: day.score < 0 ? "transparent" : getIntensityColor(day.score),
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendLabel}>Less</Text>
        {[0, 15, 40, 65, 85].map((score, i) => (
          <View
            key={i}
            style={[styles.legendCell, { backgroundColor: getIntensityColor(score) }]}
          />
        ))}
        <Text style={styles.legendLabel}>More</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    gap: spacing.sm,
  },
  dayLabels: {
    position: "absolute",
    left: 0,
    top: 0,
    gap: 0,
  },
  dayLabel: {
    ...fonts.kicker,
    fontSize: 8,
    color: colors.textMuted,
    width: 22,
    lineHeight: CELL_SIZE + CELL_GAP,
  },
  grid: {
    flexDirection: "row",
    gap: CELL_GAP,
    marginLeft: 26,
    flexWrap: "nowrap",
  },
  column: {
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginTop: spacing.xs,
  },
  legendLabel: {
    ...fonts.kicker,
    fontSize: 8,
    color: colors.textMuted,
  },
  legendCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
  },
});
