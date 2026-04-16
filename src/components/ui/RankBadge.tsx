import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { RANK_ABBREVIATIONS, RANK_COLORS, RANK_NAMES } from "../../lib/ranks-v2";
import type { Rank } from "../../lib/ranks-v2";

// ─── Types ───────────────────────────────────────────────────────────────────

type RankBadgeProps = {
  rank: Rank;
  size?: "sm" | "md" | "lg";
};

// ─── Size config ─────────────────────────────────────────────────────────────

const SIZE_MAP = {
  sm: { container: 28, fontSize: 9 },
  md: { container: 40, fontSize: 12 },
  lg: { container: 52, fontSize: 15 },
} as const;

// ─── Component ───────────────────────────────────────────────────────────────

export function RankBadge({ rank, size = "md" }: RankBadgeProps) {
  const color = RANK_COLORS[rank] ?? "#6B7280";
  const abbr = RANK_ABBREVIATIONS[rank] ?? rank.slice(0, 3).toUpperCase();
  const dim = SIZE_MAP[size];

  return (
    <View style={size === "lg" ? styles.lgWrapper : undefined}>
      <View
        style={[
          styles.container,
          {
            width: dim.container,
            height: dim.container,
            borderRadius: dim.container / 2,
            borderColor: color,
            backgroundColor: color + "26", // ~15% opacity
          },
        ]}
      >
        <Text
          style={[
            styles.letter,
            { fontSize: dim.fontSize, color },
          ]}
        >
          {abbr}
        </Text>
      </View>
      {size === "lg" && (
        <Text style={[styles.rankName, { color }]}>
          {RANK_NAMES[rank] ?? rank}
        </Text>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  letter: {
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 1,
  },
  lgWrapper: {
    alignItems: "center",
  },
  rankName: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 4,
  },
});
