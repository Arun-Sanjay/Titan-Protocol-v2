import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { RANK_COLORS } from "../../lib/ranks-v2";
import type { Rank } from "../../lib/ranks-v2";

// ─── Types ───────────────────────────────────────────────────────────────────

type RankBadgeProps = {
  rank: Rank;
  size?: "sm" | "md" | "lg";
};

// ─── Size config ─────────────────────────────────────────────────────────────

const SIZE_MAP = {
  sm: { container: 24, fontSize: 12 },
  md: { container: 36, fontSize: 18 },
  lg: { container: 48, fontSize: 24 },
} as const;

// ─── Component ───────────────────────────────────────────────────────────────

export function RankBadge({ rank, size = "md" }: RankBadgeProps) {
  const color = RANK_COLORS[rank] ?? "#6B7280";
  const dim = SIZE_MAP[size];

  return (
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
        {rank}
      </Text>
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
  },
});
