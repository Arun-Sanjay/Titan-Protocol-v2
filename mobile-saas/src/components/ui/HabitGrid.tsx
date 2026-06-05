import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, fonts } from "../../theme";

type HabitGridCell = {
  dateKey: string;
  completed: boolean;
};

/** Aggregate-activity cell: how many of `max` were logged on `dateKey`. */
type IntensityCell = {
  dateKey: string;
  count: number;
  max: number;
};

type Props = {
  /** Boolean mode — single habit's per-day completion. */
  logs?: HabitGridCell[];
  /** Intensity mode — aggregate activity, colored by count/max. */
  cells?: IntensityCell[];
  weeks?: number;
  color?: string;
};

const CELL_SIZE = 14;
const CELL_GAP = 2;
const DAYS = ["M", "", "W", "", "F", "", "S"];

function toAlphaHex(alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  return Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0");
}

export const HabitGrid = React.memo(function HabitGrid({
  logs,
  cells,
  weeks = 12,
  color = "#34d399",
}: Props) {
  // Build a date → fill-alpha lookup (0 = empty). Supports both the boolean
  // (single-habit) mode and the intensity (aggregate) mode.
  const logMap = useMemo(() => {
    const map = new Map<string, number>();
    if (cells) {
      for (const c of cells) {
        const ratio = c.max > 0 ? c.count / c.max : 0;
        map.set(c.dateKey, ratio === 0 ? 0 : 0.2 + 0.75 * Math.min(1, ratio));
      }
    } else if (logs) {
      for (const log of logs) {
        map.set(log.dateKey, log.completed ? 0.6 : 0);
      }
    }
    return map;
  }, [logs, cells]);

  // Generate date grid: weeks × 7 days, ending today
  const grid = useMemo(() => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const dayOfWeek = today.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // Start from the Monday (weeks-1) weeks ago
    const totalDays = weeks * 7;
    const startOffset = mondayOffset + (weeks - 1) * 7;

    const columns: { dateKey: string; alpha: number; isFuture: boolean }[][] = [];
    let currentWeek: { dateKey: string; alpha: number; isFuture: boolean }[] = [];

    for (let i = startOffset; i >= -6 + mondayOffset; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const isFuture = dk > todayKey;

      currentWeek.push({
        dateKey: dk,
        alpha: logMap.get(dk) ?? 0,
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
                      : day.alpha > 0
                      ? color + toAlphaHex(day.alpha)
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
