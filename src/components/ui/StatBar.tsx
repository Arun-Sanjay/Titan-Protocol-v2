import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { colors, spacing } from "../../theme";

// ─── Types ───────────────────────────────────────────────────────────────────

type StatBarProps = {
  engine: string; // "body" | "mind" | "money" | "charisma"
  label: string; // "BODY", "MIND", etc.
  value: number; // cumulative stat (e.g. 47.5)
  gain?: number; // today's gain (e.g. +1.5), shown in green if > 0
  color: string; // engine color
  maxValue?: number; // for bar scaling, default 100
};

// ─── Component ───────────────────────────────────────────────────────────────

const monoFont = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

export function StatBar({
  label,
  value,
  gain,
  color,
  maxValue = 100,
}: StatBarProps) {
  const fillPercent = Math.min(100, (value / maxValue) * 100);

  return (
    <View style={styles.row}>
      {/* Engine label */}
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${fillPercent}%`, backgroundColor: color },
          ]}
        />
      </View>

      {/* Stat value + gain */}
      <View style={styles.valueContainer}>
        <Text style={styles.value}>{Math.floor(value)}</Text>
        {gain != null && gain > 0 && (
          <Text style={styles.gain}>+{gain % 1 === 0 ? gain : gain.toFixed(1)}</Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  labelContainer: {
    width: 72,
  },
  label: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  valueContainer: {
    width: 48,
    alignItems: "flex-end",
  },
  value: {
    fontFamily: monoFont,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  gain: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: "600",
    color: colors.success,
    marginTop: 1,
  },
});
