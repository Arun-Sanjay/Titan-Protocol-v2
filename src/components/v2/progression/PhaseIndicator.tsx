import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, fonts } from "../../../theme";
import { useProgressionStore, selectPhaseLabel, selectPhaseProgress } from "../../../stores/useProgressionStore";
import { useModeStore, checkFeatureVisible } from "../../../stores/useModeStore";

export function PhaseIndicator() {
  const piMode = useModeStore((s) => s.mode);
  const visible = checkFeatureVisible(piMode, "phases");
  const currentPhase = useProgressionStore((s) => s.currentPhase);
  const weekNumber = useProgressionStore((s) => s.weekNumber);
  const phaseInfo = useMemo(
    () => useProgressionStore.getState().getPhaseInfo(),
    [currentPhase, weekNumber],
  );
  const progress = selectPhaseProgress(phaseInfo);
  const label = selectPhaseLabel(phaseInfo);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(2, progress)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 32,
    justifyContent: "center",
    gap: 4,
    marginBottom: spacing.sm,
  },
  label: {
    ...fonts.kicker,
    fontSize: 9,
    letterSpacing: 2.5,
    color: colors.textMuted,
    textAlign: "center",
  },
  track: {
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 1,
    overflow: "hidden",
    marginHorizontal: spacing["3xl"],
  },
  fill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
});
