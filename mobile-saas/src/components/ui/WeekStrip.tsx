import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts, spacing } from "../../theme";
import { getTodayKey, addDays } from "../../lib/date";

type Cell = {
  dateKey: string;
  label: string;
  isToday: boolean;
  score: number | null;
};

type Props = {
  /**
   * Optional map from dateKey → daily Titan Score (0-100). Cells without
   * a score render greyed; today's cell is always highlighted regardless
   * of score presence.
   */
  scoreMap?: Record<string, number>;
};

/**
 * 7-day strip showing the current week (Mon → Sun) with each day's
 * Titan Score as a fill. Today is highlighted with an accent border;
 * past days fill proportionally with their score; future days stay empty.
 *
 * Compact, dense — designed for the Dashboard hero block.
 */
export const WeekStrip = React.memo(function WeekStrip({ scoreMap }: Props) {
  const today = getTodayKey();
  const todayDate = new Date(today + "T00:00:00");
  const dayOfWeek = todayDate.getDay(); // 0=Sun, 1=Mon, …
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const cells: Cell[] = Array.from({ length: 7 }).map((_, i) => {
    const dateKey = addDays(today, mondayOffset + i);
    const label = ["M", "T", "W", "T", "F", "S", "S"][i];
    return {
      dateKey,
      label,
      isToday: dateKey === today,
      score: scoreMap?.[dateKey] ?? null,
    };
  });

  return (
    <View style={styles.row}>
      {cells.map((cell, idx) => {
        const fillHeight = cell.score != null ? Math.max(2, (cell.score / 100) * 32) : 2;
        return (
          <View key={`${cell.dateKey}-${idx}`} style={styles.cell}>
            <View
              style={[
                styles.barTrack,
                cell.isToday && styles.barTrackToday,
              ]}
            >
              <View
                style={[
                  styles.barFill,
                  { height: fillHeight },
                  cell.isToday && styles.barFillToday,
                ]}
              />
            </View>
            <Text
              style={[
                styles.label,
                cell.isToday && styles.labelToday,
              ]}
            >
              {cell.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  barTrack: {
    width: "100%",
    height: 32,
    justifyContent: "flex-end",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 2,
    overflow: "hidden",
  },
  barTrackToday: {
    borderWidth: 1,
    borderColor: colors.cardBorderActive,
  },
  barFill: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.20)",
    borderRadius: 2,
  },
  barFillToday: {
    backgroundColor: colors.accent,
  },
  label: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  labelToday: {
    color: colors.text,
  },
});
