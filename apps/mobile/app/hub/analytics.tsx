import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, AppState, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Rect } from "react-native-svg";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { Panel } from "../../src/components/ui/Panel";
import { MetricValue } from "../../src/components/ui/MetricValue";
import { HeatmapGrid } from "../../src/components/ui/HeatmapGrid";
import { useEngineStore } from "../../src/stores/useEngineStore";
import type { EngineKey } from "../../src/db/schema";
import { getTodayKey, addDays } from "../../src/lib/date";

const ENGINES: EngineKey[] = ["body", "mind", "money", "general"];
const ENGINE_COLORS: Record<EngineKey, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  general: colors.general,
};

type Range = 7 | 30 | 90;

function getDateKeys(range: Range, today?: string): string[] {
  const todayKey = today ?? getTodayKey();
  const keys: string[] = [];
  for (let i = range - 1; i >= 0; i--) {
    keys.push(addDays(todayKey, -i));
  }
  return keys;
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [range, setRange] = useState<Range>(30);
  const loadAllEngines = useEngineStore((s) => s.loadAllEngines);
  const loadDateRange = useEngineStore((s) => s.loadDateRange);
  const scores = useEngineStore((s) => s.scores);

  // AppState refresh for midnight crossing
  const [appActive, setAppActive] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setAppActive((c) => c + 1);
    });
    return () => sub.remove();
  }, []);
  const todayKey = useMemo(() => getTodayKey(), [appActive]);

  const dateKeys = useMemo(() => getDateKeys(range, todayKey), [range, todayKey]);

  // Always load 90 days so heatmap has data regardless of selected range
  const allDateKeys = useMemo(() => getDateKeys(90, todayKey), [todayKey]);

  useEffect(() => {
    loadAllEngines(todayKey);
    if (allDateKeys.length > 0) {
      loadDateRange(allDateKeys[0], allDateKeys[allDateKeys.length - 1]);
    }
  }, [todayKey, loadAllEngines, loadDateRange, allDateKeys]);

  const dailyScores = useMemo(() => {
    return dateKeys.map((dk) => {
      const vals = ENGINES.map((e) => scores[`${e}:${dk}`] ?? 0);
      const active = vals.filter((v) => v > 0);
      const avg = active.length === 0 ? 0 : Math.round(active.reduce((a, b) => a + b, 0) / active.length);
      return { dateKey: dk, score: avg };
    });
  }, [dateKeys, scores]);

  const avgScore = useMemo(() => {
    const nonZero = dailyScores.filter((d) => d.score > 0);
    if (nonZero.length === 0) return 0;
    return Math.round(nonZero.reduce((a, b) => a + b.score, 0) / nonZero.length);
  }, [dailyScores]);

  // Streak calculation — give today benefit of the doubt if no data yet
  const { currentStreak, bestStreak } = useMemo(() => {
    let current = 0;
    let startIdx = dailyScores.length - 1;
    // If today has no score yet, don't break the streak — start from yesterday
    if (startIdx >= 0 && dailyScores[startIdx].score === 0) startIdx--;
    for (let i = startIdx; i >= 0; i--) {
      if (dailyScores[i].score > 0) current++;
      else break;
    }
    let best = 0;
    let running = 0;
    for (const d of dailyScores) {
      if (d.score > 0) {
        running++;
        if (running > best) best = running;
      } else {
        running = 0;
      }
    }
    return { currentStreak: current, bestStreak: best };
  }, [dailyScores]);

  const bestDay = useMemo(() => {
    return dailyScores.reduce((b, d) => d.score > b.score ? d : b, { dateKey: "", score: 0 });
  }, [dailyScores]);

  // Consistent days (60%+ threshold)
  const consistentDays = useMemo(() => {
    return dailyScores.filter((d) => d.score >= 60).length;
  }, [dailyScores]);

  // Heatmap data (90 days for grid — needs { dateKey, score } shape)
  const heatmapData = useMemo(() => {
    return allDateKeys.map((dk) => {
      const vals = ENGINES.map((e) => scores[`${e}:${dk}`] ?? 0);
      const active = vals.filter((v) => v > 0);
      const score = active.length === 0 ? 0 : Math.round(active.reduce((a, b) => a + b, 0) / active.length);
      return { dateKey: dk, score };
    });
  }, [allDateKeys, scores]);

  // Bar chart config — compute bar width to actually fit the container
  const CHART_WIDTH = screenWidth - 2 * spacing.lg - 40; // screen padding + panel padding
  const BAR_GAP = 1;
  const barWidth = Math.max(1, (CHART_WIDTH / dailyScores.length) - BAR_GAP);
  const chartHeight = 160;

  const engineBreakdown = useMemo(() => {
    return ENGINES.map((engine) => {
      const engineScores = dateKeys.map((dk) => scores[`${engine}:${dk}`] ?? 0);
      const nonZero = engineScores.filter((s) => s > 0);
      const avg = nonZero.length === 0 ? 0 : Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length);
      return { engine, avg };
    });
  }, [dateKeys, scores]);

  // Task reliability per engine
  const taskReliability = useMemo(() => {
    return ENGINES.map((engine) => {
      const totalDays = dateKeys.length;
      const activeDays = dateKeys.filter((dk) => (scores[`${engine}:${dk}`] ?? 0) > 0).length;
      const perfectDays = dateKeys.filter((dk) => (scores[`${engine}:${dk}`] ?? 0) === 100).length;
      return { engine, activeDays, perfectDays, totalDays };
    });
  }, [dateKeys, scores]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Range picker */}
        <View style={styles.rangePicker}>
          {([7, 30, 90] as Range[]).map((r) => (
            <Pressable
              key={r}
              onPress={() => { Haptics.selectionAsync(); setRange(r); }}
              style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
            >
              <Text style={[styles.rangeBtnText, range === r && styles.rangeBtnTextActive]}>
                {r}D
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <Panel style={styles.statCard} delay={0}>
            <Ionicons name="analytics-outline" size={18} color={colors.body} />
            <MetricValue label="Avg Score" value={avgScore} size="sm" color={colors.body} animated suffix="%" />
          </Panel>
          <Panel style={styles.statCard} delay={50}>
            <Ionicons name="flame-outline" size={18} color={colors.warning} />
            <MetricValue label="Streak" value={currentStreak} size="sm" color={colors.warning} animated />
          </Panel>
          <Panel style={styles.statCard} delay={100}>
            <Ionicons name="trophy-outline" size={18} color={colors.mind} />
            <MetricValue label="Best Day" value={bestDay.score} size="sm" color={colors.mind} animated suffix="%" />
          </Panel>
        </View>

        {/* Titan Score Trend (bar chart) */}
        <SectionHeader title="Titan Score Trend" />
        <Panel style={styles.chartCard} delay={150}>
          <Svg width="100%" height={chartHeight}>
            {dailyScores.map((d, i) => {
              const barH = (d.score / 100) * (chartHeight - 20);
              const x = i * (barWidth + BAR_GAP);
              return (
                <Rect
                  key={d.dateKey}
                  x={x}
                  y={chartHeight - 10 - barH}
                  width={barWidth}
                  height={Math.max(barH, 2)}
                  rx={2}
                  fill={colors.primary}
                  opacity={d.score > 0 ? 0.8 : 0.15}
                />
              );
            })}
          </Svg>
        </Panel>

        {/* Engine Performance */}
        <SectionHeader title="Engine Performance" />
        <Panel delay={200}>
          {engineBreakdown.map((eb, idx) => (
            <View key={eb.engine} style={[styles.engineRow, idx < engineBreakdown.length - 1 && styles.engineRowBorder]}>
              <Text style={[styles.engineLabel, { color: ENGINE_COLORS[eb.engine] }]}>
                {eb.engine.charAt(0).toUpperCase() + eb.engine.slice(1)}
              </Text>
              <View style={styles.engineBar}>
                <View style={[styles.engineFill, { width: `${eb.avg}%`, backgroundColor: ENGINE_COLORS[eb.engine] }]} />
              </View>
              <Text style={styles.engineScore}>{eb.avg}%</Text>
            </View>
          ))}
        </Panel>

        {/* Consistency Heatmap */}
        <SectionHeader title="Consistency Heatmap" />
        <Panel delay={250}>
          <HeatmapGrid data={heatmapData} />
        </Panel>

        {/* Streak Stats */}
        <SectionHeader title="Streak Stats" />
        <View style={styles.streakRow}>
          <Panel style={styles.streakCard} delay={300}>
            <Ionicons name="flame" size={18} color={colors.warning} />
            <MetricValue label="Current" value={currentStreak} size="sm" color={colors.warning} animated />
          </Panel>
          <Panel style={styles.streakCard} delay={350}>
            <Ionicons name="ribbon" size={18} color={colors.body} />
            <MetricValue label="Best" value={bestStreak} size="sm" color={colors.body} animated />
          </Panel>
          <Panel style={styles.streakCard} delay={400}>
            <Ionicons name="checkmark-done" size={18} color={colors.general} />
            <MetricValue label="60%+ Days" value={consistentDays} size="sm" color={colors.general} animated />
          </Panel>
        </View>

        {/* Task Reliability */}
        <SectionHeader title="Task Reliability" />
        <Panel delay={450}>
          {taskReliability.map((tr, idx) => (
            <View key={tr.engine} style={[styles.reliabilityRow, idx < taskReliability.length - 1 && styles.reliabilityBorder]}>
              <View style={[styles.reliabilityDot, { backgroundColor: ENGINE_COLORS[tr.engine] }]} />
              <Text style={styles.reliabilityEngine}>
                {tr.engine.charAt(0).toUpperCase() + tr.engine.slice(1)}
              </Text>
              <View style={styles.reliabilityStats}>
                <Text style={styles.reliabilityValue}>{tr.activeDays}/{tr.totalDays}</Text>
                <Text style={styles.reliabilitySub}>active</Text>
              </View>
              <View style={styles.reliabilityStats}>
                <Text style={styles.reliabilityValue}>{tr.perfectDays}</Text>
                <Text style={styles.reliabilitySub}>perfect</Text>
              </View>
            </View>
          ))}
        </Panel>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  backBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  rangePicker: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.panelBorder },
  rangeBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: "center" },
  rangeBtnActive: { backgroundColor: colors.primaryDim },
  rangeBtnText: { fontSize: 14, fontWeight: "700", color: colors.textMuted, letterSpacing: 1 },
  rangeBtnTextActive: { color: colors.text },
  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  statCard: { flex: 1, alignItems: "center", gap: spacing.xs },
  chartCard: { overflow: "hidden", paddingVertical: spacing.md },
  engineRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  engineRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.panelBorder },
  engineLabel: { width: 70, fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
  engineBar: { flex: 1, height: 8, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.full, overflow: "hidden" },
  engineFill: { height: "100%", borderRadius: radius.full },
  engineScore: { width: 40, ...fonts.mono, fontSize: 13, color: colors.textSecondary, textAlign: "right" },
  streakRow: { flexDirection: "row", gap: spacing.md },
  streakCard: { flex: 1, alignItems: "center", gap: spacing.xs },
  reliabilityRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, gap: spacing.md },
  reliabilityBorder: { borderBottomWidth: 1, borderBottomColor: colors.panelBorder },
  reliabilityDot: { width: 8, height: 8, borderRadius: 4 },
  reliabilityEngine: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text, textTransform: "capitalize" },
  reliabilityStats: { alignItems: "center", width: 55 },
  reliabilityValue: { ...fonts.mono, fontSize: 14, color: colors.text },
  reliabilitySub: { fontSize: 9, color: colors.textMuted, marginTop: 2, textTransform: "uppercase", letterSpacing: 1 },
});
