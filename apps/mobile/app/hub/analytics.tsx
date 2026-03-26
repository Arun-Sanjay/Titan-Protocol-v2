import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Rect } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { Card } from "../../src/components/ui/Card";
import { useEngineStore } from "../../src/stores/useEngineStore";
import type { EngineKey } from "../../src/db/schema";

const ENGINES: EngineKey[] = ["body", "mind", "money", "general"];
const ENGINE_COLORS: Record<EngineKey, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  general: colors.general,
};

type Range = 7 | 30 | 90;

function getDateKeys(range: Range): string[] {
  const keys: string[] = [];
  const today = new Date();
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return keys;
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const [range, setRange] = useState<Range>(7);
  const loadAllEngines = useEngineStore((s) => s.loadAllEngines);
  const scores = useEngineStore((s) => s.scores);

  const dateKeys = useMemo(() => getDateKeys(range), [range]);

  useEffect(() => {
    for (const dk of dateKeys) {
      loadAllEngines(dk);
    }
  }, [dateKeys]);

  const dailyScores = useMemo(() => {
    return dateKeys.map((dk) => {
      const vals = ENGINES.map((e) => scores[`${e}:${dk}`] ?? 0);
      const avg = vals.every((v) => v === 0) ? 0 : Math.round(vals.reduce((a, b) => a + b, 0) / 4);
      return { dateKey: dk, score: avg };
    });
  }, [dateKeys, scores]);

  const avgScore = useMemo(() => {
    const nonZero = dailyScores.filter((d) => d.score > 0);
    if (nonZero.length === 0) return 0;
    return Math.round(nonZero.reduce((a, b) => a + b.score, 0) / nonZero.length);
  }, [dailyScores]);

  const streak = useMemo(() => {
    let count = 0;
    for (let i = dailyScores.length - 1; i >= 0; i--) {
      if (dailyScores[i].score > 0) count++;
      else break;
    }
    return count;
  }, [dailyScores]);

  const bestDay = useMemo(() => {
    return dailyScores.reduce((best, d) => d.score > best.score ? d : best, { dateKey: "", score: 0 });
  }, [dailyScores]);

  // Simple bar chart
  const barWidth = range <= 7 ? 28 : range <= 30 ? 8 : 3;
  const chartHeight = 160;
  const maxScore = 100;

  const engineBreakdown = useMemo(() => {
    return ENGINES.map((engine) => {
      const engineScores = dateKeys.map((dk) => scores[`${engine}:${dk}`] ?? 0);
      const nonZero = engineScores.filter((s) => s > 0);
      const avg = nonZero.length === 0 ? 0 : Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length);
      return { engine, avg };
    });
  }, [dateKeys, scores]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
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

        {/* Stats */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{avgScore}%</Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{bestDay.score}%</Text>
            <Text style={styles.statLabel}>Best Day</Text>
          </Card>
        </View>

        {/* Bar chart */}
        <SectionHeader title="Daily Titan Score" />
        <Card style={styles.chartCard}>
          <Svg width="100%" height={chartHeight}>
            {dailyScores.map((d, i) => {
              const barH = (d.score / maxScore) * (chartHeight - 20);
              const x = i * (barWidth + 2) + 2;
              const barColor = colors.primary;
              return (
                <Rect
                  key={d.dateKey}
                  x={x}
                  y={chartHeight - 10 - barH}
                  width={barWidth}
                  height={Math.max(barH, 2)}
                  rx={2}
                  fill={barColor}
                  opacity={0.8}
                />
              );
            })}
          </Svg>
        </Card>

        {/* Engine breakdown */}
        <SectionHeader title="Engine Breakdown" />
        {engineBreakdown.map((eb) => (
          <View key={eb.engine} style={styles.engineRow}>
            <Text style={[styles.engineLabel, { color: ENGINE_COLORS[eb.engine] }]}>
              {eb.engine.charAt(0).toUpperCase() + eb.engine.slice(1)}
            </Text>
            <View style={styles.engineBar}>
              <View style={[styles.engineFill, { width: `${eb.avg}%`, backgroundColor: ENGINE_COLORS[eb.engine] }]} />
            </View>
            <Text style={styles.engineScore}>{eb.avg}%</Text>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  backBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 24, color: colors.text },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  rangePicker: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, padding: 4 },
  rangeBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: "center" },
  rangeBtnActive: { backgroundColor: colors.primaryDim },
  rangeBtnText: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
  rangeBtnTextActive: { color: colors.primary },
  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  statCard: { flex: 1, alignItems: "center" },
  statValue: { ...fonts.monoValue },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  chartCard: { overflow: "hidden" },
  engineRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md, gap: spacing.md },
  engineLabel: { width: 70, fontSize: 13, fontWeight: "700" },
  engineBar: { flex: 1, height: 8, backgroundColor: colors.surfaceBorder, borderRadius: radius.full, overflow: "hidden" },
  engineFill: { height: "100%", borderRadius: radius.full },
  engineScore: { width: 40, fontSize: 13, fontWeight: "600", color: colors.textSecondary, textAlign: "right" },
});
