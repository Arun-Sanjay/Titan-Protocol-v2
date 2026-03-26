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
  const rank = getRankForLevel(level);
  const currentLevelXP = xp - (level - 1) * 500;
  const needed = 500;
  const fraction = Math.min(1, currentLevelXP / needed);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.rank, { color: rank.color }]}>
          Level {level} — {rank.name.toUpperCase()}
        </Text>
        <Text style={styles.xpText}>{xp.toLocaleString()} XP</Text>
      </View>
      <TitanProgress value={fraction} color={colors.text} />
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
