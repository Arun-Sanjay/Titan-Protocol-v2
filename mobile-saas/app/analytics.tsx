import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { ScreenHeader } from "../src/components/ui/ScreenHeader";
import { Panel } from "../src/components/ui/Panel";
import { SparklineChart } from "../src/components/ui/SparklineChart";
import { TitanProgress } from "../src/components/ui/TitanProgress";
import { MetricValue } from "../src/components/ui/MetricValue";

import { useAnalyticsSnapshot } from "../src/hooks/queries/useDashboard";
import type { EngineKey } from "../src/lib/scoring";
import { addDaysISO, listDateRangeISO, todayISO } from "../src/lib/date";

import { colors, fonts, radius, spacing } from "../src/theme";

const ENGINES: { key: EngineKey; label: string; color: string }[] = [
  { key: "body", label: "BODY", color: colors.body },
  { key: "mind", label: "MIND", color: colors.mind },
  { key: "money", label: "MONEY", color: colors.money },
  { key: "charisma", label: "GENERAL", color: colors.charisma },
];

const RANGES = [7, 30, 90] as const;

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/** Average over active (non-zero) days — a fairer headline than diluting by rest days. */
function activeAvg(arr: number[]): number {
  return Math.round(mean(arr.filter((v) => v > 0)));
}

/** A sparkline that measures its own available width. */
function MeasuredSparkline({
  data,
  color,
  height = 40,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width));
  return (
    <View style={[styles.chart, { height }]} onLayout={onLayout}>
      {w > 0 && data.length > 0 ? (
        <SparklineChart data={data} width={w} height={height} color={color} />
      ) : null}
    </View>
  );
}

export default function AnalyticsScreen() {
  const [days, setDays] = useState<number>(30);

  const { rangeStart, rangeEnd, dateKeys } = useMemo(() => {
    const end = todayISO();
    const start = addDaysISO(end, -(days - 1));
    return { rangeStart: start, rangeEnd: end, dateKeys: listDateRangeISO(start, end) };
  }, [days]);

  const snapshot = useAnalyticsSnapshot(rangeStart, rangeEnd);

  const titanTrend = useMemo(
    () => dateKeys.map((d) => snapshot.scoresByDate[d] ?? 0),
    [dateKeys, snapshot],
  );
  const titanAvg = useMemo(() => activeAvg(titanTrend), [titanTrend]);

  const engineSeries = useMemo(() => {
    const map = {} as Record<EngineKey, number[]>;
    for (const e of ENGINES) {
      map[e.key] = dateKeys.map((d) => snapshot.engineScoreByDate[e.key][d] ?? 0);
    }
    return map;
  }, [dateKeys, snapshot]);

  const reliability = useMemo(() => {
    const sorted = [...snapshot.taskReliability].sort((a, b) => b.percent - a.percent);
    const most = sorted.slice(0, 5);
    const least = sorted.length > 5 ? sorted.slice(-3).reverse() : [];
    return { most, least };
  }, [snapshot.taskReliability]);

  const engineColor = (engine: EngineKey) =>
    ENGINES.find((e) => e.key === engine)?.color ?? colors.accent;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader kicker="Insights" title="Analytics" subtitle="Trends, engine momentum, and task reliability." />

        {/* Range toggle */}
        <View style={styles.rangeRow}>
          {RANGES.map((r) => {
            const active = days === r;
            return (
              <Pressable
                key={r}
                onPress={() => setDays(r)}
                style={({ pressed }) => [
                  styles.rangePill,
                  active && styles.rangePillActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{r}D</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Titan Score Trend */}
        <Panel>
          <View style={styles.panelHead}>
            <Text style={styles.panelKicker}>Titan Score Trend</Text>
            <MetricValue label="Avg" value={`${titanAvg}%`} size="sm" />
          </View>
          <MeasuredSparkline data={titanTrend} color={colors.primary} height={56} />
        </Panel>

        {/* Engine Trend */}
        <Panel style={styles.trendPanel}>
          <Text style={styles.panelKicker}>Engine Trend</Text>
          {ENGINES.map((e) => {
            const series = engineSeries[e.key];
            const half = Math.floor(series.length / 2);
            const delta = Math.round(mean(series.slice(half)) - mean(series.slice(0, half)));
            return (
              <View key={e.key} style={styles.trendItem}>
                <View style={styles.trendHead}>
                  <Text style={[styles.trendLabel, { color: e.color }]}>{e.label}</Text>
                  <View style={styles.trendStats}>
                    <Text style={styles.trendAvg}>{activeAvg(series)}%</Text>
                    <Text
                      style={[
                        styles.trendDelta,
                        { color: delta >= 0 ? colors.success : colors.danger },
                      ]}
                    >
                      {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}
                    </Text>
                  </View>
                </View>
                <MeasuredSparkline data={series} color={e.color} height={34} />
              </View>
            );
          })}
        </Panel>

        {/* Most reliable */}
        <Panel style={styles.reliabilityPanel}>
          <Text style={styles.panelKicker}>Most Reliable</Text>
          {reliability.most.length === 0 ? (
            <Text style={styles.emptyText}>No active tasks yet. Add some on the Track tab.</Text>
          ) : (
            reliability.most.map((r, i) => (
              <View key={`${r.title}-${i}`} style={[styles.reliabilityRow, i > 0 && styles.rowSpaced]}>
                <View style={styles.reliabilityHead}>
                  <Text style={styles.reliabilityTitle} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text style={styles.reliabilityPct}>{r.percent}%</Text>
                </View>
                <TitanProgress value={r.percent} color={engineColor(r.engine)} />
              </View>
            ))
          )}
        </Panel>

        {/* Least reliable */}
        {reliability.least.length > 0 && (
          <Panel style={styles.reliabilityPanel}>
            <Text style={styles.panelKicker}>Needs Attention</Text>
            {reliability.least.map((r, i) => (
              <View key={`${r.title}-${i}`} style={[styles.reliabilityRow, i > 0 && styles.rowSpaced]}>
                <View style={styles.reliabilityHead}>
                  <Text style={styles.reliabilityTitle} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text style={styles.reliabilityPct}>{r.percent}%</Text>
                </View>
                <TitanProgress value={r.percent} color={engineColor(r.engine)} />
              </View>
            ))}
          </Panel>
        )}

        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },
  pressed: { opacity: 0.7 },

  rangeRow: { flexDirection: "row", gap: spacing.sm },
  rangePill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  rangePillActive: {
    backgroundColor: colors.surfaceBorderStrong,
    borderColor: colors.cardBorderActive,
  },
  rangeText: { ...fonts.kicker, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5 },
  rangeTextActive: { color: colors.text },

  panelHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  panelKicker: { ...fonts.kicker, color: colors.textMuted, letterSpacing: 2, marginBottom: spacing.md },

  chart: { justifyContent: "center" },

  trendPanel: { gap: spacing.sm },
  trendItem: { gap: spacing.xs, marginBottom: spacing.sm },
  trendHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trendLabel: { ...fonts.kicker, fontSize: 11, letterSpacing: 1.5 },
  trendStats: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  trendAvg: { ...fonts.mono, fontSize: 12, color: colors.text },
  trendDelta: { ...fonts.mono, fontSize: 12 },

  reliabilityPanel: {},
  reliabilityRow: { gap: spacing.xs },
  rowSpaced: { marginTop: spacing.md },
  reliabilityHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reliabilityTitle: { ...fonts.body, color: colors.text, fontSize: 13, flex: 1, marginRight: spacing.sm },
  reliabilityPct: { ...fonts.mono, color: colors.textMuted, fontSize: 12 },

  emptyText: {
    ...fonts.body,
    color: colors.textSecondary,
    fontSize: 13,
    paddingVertical: spacing.xs,
  },
});
