import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { colors, spacing, fonts } from "../../../theme";
import { useNarrativeStore } from "../../../stores/useNarrativeStore";
import { NarrativeEntryCard } from "./NarrativeEntry";

type Props = {
  limit?: number;
};

export function NarrativeTimeline({ limit }: Props) {
  const entries = useNarrativeStore((s) => s.entries);

  // Sort newest first
  const sorted = [...entries].sort((a, b) => b.dayNumber - a.dayNumber);
  const display = limit ? sorted.slice(0, limit) : sorted;

  if (display.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Your story hasn't started yet.</Text>
        <Text style={styles.emptyHint}>Complete your first protocol to begin.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {display.map((entry, idx) => (
        <Animated.View key={entry.id} entering={FadeInUp.delay(idx * 60).duration(400)}>
          <NarrativeEntryCard entry={entry} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing["4xl"],
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  emptyHint: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
