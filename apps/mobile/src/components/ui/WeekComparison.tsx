import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Panel } from "./Panel";
import { SectionHeader } from "./SectionHeader";
import { colors, spacing, fonts } from "../../theme";
import { ENGINES } from "../../stores/useEngineStore";
import type { EngineKey } from "../../db/schema";

const ENGINE_LABELS: Record<EngineKey, string> = {
  body: "BODY",
  mind: "MIND",
  money: "MONEY",
  general: "GENERAL",
};

type Props = {
  thisWeek: Record<EngineKey, number>;
  lastWeek: Record<EngineKey, number>;
};

export const WeekComparison = React.memo(function WeekComparison({ thisWeek, lastWeek }: Props) {
  return (
    <>
      <SectionHeader title="VS LAST WEEK" />
      <Panel>
        <View style={styles.row}>
          {ENGINES.map((engine) => {
            const current = thisWeek[engine];
            const prev = lastWeek[engine];
            const diff = current - prev;
            const isUp = diff >= 0;
            return (
              <View key={engine} style={styles.col}>
                <Text style={styles.engineLabel}>{ENGINE_LABELS[engine]}</Text>
                <Text style={[styles.value, { color: isUp ? colors.success : colors.danger }]}>
                  {isUp ? "↑" : "↓"} {Math.abs(current)}%
                </Text>
                <Text style={styles.comparison}>
                  {current}% vs {prev}%
                </Text>
              </View>
            );
          })}
        </View>
      </Panel>
    </>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  col: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  engineLabel: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
  },
  value: {
    ...fonts.mono,
    fontSize: 16,
    fontWeight: "700",
  },
  comparison: {
    ...fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
  },
});
