import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, fonts } from "../../theme";
import { TitanProgress } from "./TitanProgress";
import { getRankForLevel } from "../../db/gamification";

type Props = {
  xp: number;
  level: number;
};

export const XPBar = React.memo(function XPBar({ xp, level }: Props) {
  const safeLevel = Math.max(1, Number.isFinite(level) ? level : 1);
  const safeXP = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  const rank = getRankForLevel(safeLevel);
  const currentLevelXP = safeXP - (safeLevel - 1) * 500;
  const needed = 500;
  const fraction = Math.min(1, Math.max(0, currentLevelXP / needed));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.rank, { color: rank.color }]}>
          Level {level} — {rank.name.toUpperCase()}
        </Text>
        <Text style={styles.xpText}>{xp.toLocaleString()} XP</Text>
      </View>
      <TitanProgress value={fraction * 100} color={rank.color} height={6} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  rank: {
    ...fonts.kicker,
  },
  xpText: {
    ...fonts.xpValue,
  },
});
