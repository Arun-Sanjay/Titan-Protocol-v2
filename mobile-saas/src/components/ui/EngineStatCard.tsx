import React, { useState } from "react";
import { View, Text, StyleSheet, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Panel } from "./Panel";
import { SparklineChart } from "./SparklineChart";
import { colors, fonts, spacing, radius } from "../../theme";

type Props = {
  label: string;
  scorePct: number;
  sparkData: number[];
  color: string;
  planLabel: string;
  dayLabel: string;
  onPress: () => void;
};

/** Dashboard engine card — title + score + 7-day sparkline + Enter. Mirrors
 *  web's .tx-engine-card. The whole card is tappable on mobile. */
export const EngineStatCard = React.memo(function EngineStatCard({
  label,
  scorePct,
  sparkData,
  color,
  planLabel,
  dayLabel,
  onPress,
}: Props) {
  const [chartW, setChartW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setChartW(Math.floor(e.nativeEvent.layout.width));

  return (
    <Panel tone="subtle" onPress={onPress} style={styles.panel}>
      <View style={styles.top}>
        <Text style={styles.title} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.score}>{Math.round(scorePct)}%</Text>
      </View>

      <View style={styles.chart} onLayout={onLayout}>
        {chartW > 0 && sparkData.length > 0 ? (
          <SparklineChart data={sparkData} width={chartW} height={40} color={color} />
        ) : null}
      </View>

      <Text style={styles.line} numberOfLines={1}>
        {planLabel}
      </Text>
      <Text style={styles.line} numberOfLines={1}>
        {dayLabel}
      </Text>

      <View style={styles.enterRow}>
        <Text style={[styles.enter, { color }]}>ENTER</Text>
        <Ionicons name="chevron-forward" size={13} color={color} />
      </View>
    </Panel>
  );
});

const styles = StyleSheet.create({
  panel: { gap: spacing.sm },
  top: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  title: {
    ...fonts.caption,
    fontSize: 13,
    color: colors.text,
    letterSpacing: 1,
  },
  score: {
    ...fonts.monoValue,
    fontSize: 20,
  },
  chart: {
    height: 44,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.86)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    overflow: "hidden",
  },
  line: {
    ...fonts.small,
    fontSize: 12,
    color: colors.textMuted,
  },
  enterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: spacing.xs,
  },
  enter: {
    ...fonts.kicker,
    fontSize: 10,
  },
});
