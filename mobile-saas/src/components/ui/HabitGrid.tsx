import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, fonts } from "../../theme";

type HabitGridCell = {
  dateKey: string;
  completed: boolean;
};

type Props = {
  logs: HabitGridCell[];
  weeks?: number;
  color?: string;
};

const CELL_SIZE = 14;
const CELL_GAP = 2;
const DAYS = ["M", "", "W", "", "F", "", "S"];

export const HabitGrid = React.memo(function HabitGrid({
  logs,
  weeks = 12,
  color = "#34d399",
}: Props) {
  // Build a lookup map for fast access
  const logMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const log of logs) {
      map.set(log.dateKey, log.completed);
    }
    return map;
  }, [logs]);

  // Generate date grid: weeks × 7 days, ending today
  const grid = useMemo(() => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const dayOfWeek = today.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // Start from the Monday (weeks-1) weeks ago
    const totalDays = weeks * 7;
    const startOffset = mondayOffset + (weeks - 1) * 7;

    const columns: { dateKey: string; completed: boolean; isFuture: boolean }[][] = [];
    let currentWeek: { dateKey: string; completed: boolean; isFuture: boolean }[] = [];

    for (let i = startOffset; i >= -6 + mondayOffset; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const isFuture = dk > todayKey;

      currentWeek.push({
        dateKey: dk,
        completed: logMap.get(dk) ?? false,
        isFuture,
      });

      if (currentWeek.length === 7) {
        columns.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) columns.push(currentWeek);

    return columns;
  }, [logMap, weeks]);

  return (
    <View style={styles.container}>
      {/* Day labels */}
      <View style={styles.dayLabels}>
        {DAYS.map((label, i) => (
          <View key={i} style={[styles.dayLabelWrap, { height: CELL_SIZE + CELL_GAP }]}>
            <Text style={styles.dayLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {grid.map((week, wi) => (
          <View key={wi} style={styles.column}>
            {week.map((day, di) => (
              <View
                key={di}
                style={[
                  styles.cell,
                  {
                    backgroundColor: day.isFuture
                      ? "rgba(255, 255, 255, 0.015)"
                      : day.completed
                      ? color + "99" // ~60% opacity
                      : "rgba(255, 255, 255, 0.03)",
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 4,
  },
  dayLabels: {
    gap: CELL_GAP,
  },
  dayLabelWrap: {
    justifyContent: "center",
    width: 12,
  },
  dayLabel: {
    fontSize: 8,
    fontWeight: "600",
    color: colors.textMuted,
  },
  grid: {
    flexDirection: "row",
    gap: CELL_GAP,
    flex: 1,
  },
  column: {
    gap: CELL_GAP,
    flex: 1,
  },
  cell: {
    height: CELL_SIZE,
    borderRadius: 3,
  },
});
