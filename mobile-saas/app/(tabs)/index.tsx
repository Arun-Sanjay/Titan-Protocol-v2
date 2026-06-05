import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "../../src/components/ui/PageHeader";
import { Panel } from "../../src/components/ui/Panel";
import { TitanProgress } from "../../src/components/ui/TitanProgress";
import { RadarChart } from "../../src/components/ui/RadarChart";
import { ComparisonCard } from "../../src/components/ui/ComparisonCard";
import { EngineStatCard } from "../../src/components/ui/EngineStatCard";
import { PlanningList, type PlanningRow } from "../../src/components/ui/PlanningList";
import { MetricValue } from "../../src/components/ui/MetricValue";

import { useDashboardWeek, useDailyPlanning } from "../../src/hooks/queries/useDashboard";
import { ENGINES, type EngineKey } from "../../src/lib/scoring";
import { ENGINE_META } from "../../src/lib/dashboard-stats";
import { formatDateShort } from "../../src/lib/date";
import { colors, fonts, spacing, radius } from "../../src/theme";

const ENGINE_COLORS: Record<EngineKey, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  charisma: colors.charisma,
};

const RADAR_SIZE = Math.min(280, Dimensions.get("window").width - 120);

export default function HQScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const planning = useDailyPlanning();
  const week = useDashboardWeek();
  const titan = planning.titan;

  const radarData = useMemo(
    () =>
      ENGINES.map((engine) => ({
        subject: ENGINE_META[engine].label,
        score: titan.perEngine[engine].percent,
      })),
    [titan],
  );

  const thisWeekAvg = useMemo(() => {
    const active = week.comparison.filter((c) => c.thisWeekAvg > 0 || c.lastWeekAvg > 0);
    if (active.length === 0) return 0;
    return Math.round(active.reduce((sum, c) => sum + c.thisWeekAvg, 0) / active.length);
  }, [week.comparison]);

  const onRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["dailyPlanning"] });
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    void queryClient.invalidateQueries({ queryKey: ["completions"] });
  }, [queryClient]);

  const go = useCallback((href: string) => router.push(href as never), [router]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.textMuted} />
        }
      >
        <PageHeader
          kicker="Titan Protocol"
          title="Titan OS"
          subtitle="Your performance operating system — four engines, one view."
        />

        {/* ── Hero: Titan Score ── */}
        <Panel tone="hero" style={styles.heroPanel}>
          <Text style={styles.kicker}>Titan Score</Text>
          <Text style={styles.scoreMain}>{titan.percent.toFixed(1)}%</Text>
          <Text style={styles.muted}>{titan.enginesActiveCount}/4 engines active today</Text>

          <View style={styles.scoreRows}>
            {ENGINES.map((engine) => {
              const s = titan.perEngine[engine];
              return (
                <View key={engine} style={styles.scoreRow}>
                  <View style={styles.scoreRowHead}>
                    <Text style={styles.scoreRowLabel}>{ENGINE_META[engine].label}</Text>
                    <Text style={styles.scoreRowValue}>{s.percent.toFixed(1)}%</Text>
                  </View>
                  <TitanProgress value={s.percent} />
                </View>
              );
            })}
          </View>
        </Panel>

        {/* ── vs Last Week ── */}
        {week.comparison.length > 0 && (
          <Panel>
            <Text style={styles.panelKicker}>vs Last Week</Text>
            <View style={styles.comparisonRow}>
              {week.comparison.map((c) => (
                <ComparisonCard
                  key={c.engine}
                  label={ENGINE_META[c.engine].label}
                  change={c.change}
                  thisWeekAvg={c.thisWeekAvg}
                  lastWeekAvg={c.lastWeekAvg}
                />
              ))}
            </View>
          </Panel>
        )}

        {/* ── Engine Overview (radar) ── */}
        <Panel>
          <Text style={styles.panelKicker}>Engine Overview</Text>
          <View style={styles.radarWrap}>
            <RadarChart data={radarData} size={RADAR_SIZE} />
          </View>
        </Panel>

        {/* ── Engine cards ── */}
        <View style={styles.engineCards}>
          {ENGINES.map((engine) => {
            const s = titan.perEngine[engine];
            return (
              <EngineStatCard
                key={engine}
                label={ENGINE_META[engine].label}
                scorePct={s.percent}
                sparkData={week.sparklines[engine].map((e) => e.percent)}
                color={ENGINE_COLORS[engine]}
                planLabel={s.pointsTotal > 0 ? `Today: ${s.percent}%` : "Plan not set"}
                dayLabel={`${s.pointsDone}/${s.pointsTotal} pts`}
                onPress={() => go(ENGINE_META[engine].route)}
              />
            );
          })}
        </View>

        {/* ── This Week ── */}
        <Panel>
          <Text style={styles.panelKicker}>This Week</Text>
          <View style={styles.summaryRow}>
            <MetricValue label="Avg Titan Score" value={`${thisWeekAvg}%`} size="md" />
            <MetricValue label="Tasks Completed" value={week.taskStats.totalCompleted} size="md" />
            <View>
              <MetricValue label="Best Day" value={`${week.taskStats.bestDay.percent}%`} size="md" />
              <Text style={styles.metricMeta}>{formatDateShort(week.taskStats.bestDay.dateKey)}</Text>
            </View>
          </View>
        </Panel>

        {/* ── Today Planner ── */}
        <Panel tone="hero" style={styles.plannerPanel}>
          <View>
            <Text style={styles.kicker}>Today Planner</Text>
            <Text style={styles.plannerTitle}>Personal Command Layer</Text>
            <Text style={styles.muted}>Planning date · {planning.dateKey}</Text>
          </View>

          <View style={styles.plannerBlock}>
            <Text style={styles.panelKicker}>Titan Score Summary</Text>
            <Text style={styles.plannerPercent}>{titan.percent.toFixed(1)}%</Text>
            <Text style={styles.muted}>
              {planning.summary.completedPoints}/{planning.summary.totalPoints} points ·{" "}
              {titan.enginesActiveCount}/4 engines active
            </Text>
          </View>

          <View style={styles.plannerBlock}>
            <Text style={styles.panelKicker}>Engines At Risk</Text>
            <PlanningList
              rows={planning.enginesAtRisk.map<PlanningRow>((r) => ({
                id: r.engine,
                title: `${r.label} · ${r.scorePct}%`,
                sub: r.reason,
                actionLabel: "Open",
                onAction: () => go(r.route),
              }))}
              emptyText="All engines are above threshold."
            />
          </View>

          <View style={styles.plannerBlock}>
            <Text style={styles.panelKicker}>Top Incomplete Main Tasks</Text>
            <PlanningList
              rows={planning.topIncompleteMainTasks.map<PlanningRow>((t) => ({
                id: t.id,
                title: t.title,
                sub: t.engineLabel,
                actionLabel: "Enter",
                onAction: () => go(t.route),
              }))}
              emptyText="No incomplete main tasks detected."
            />
          </View>

          <View style={styles.plannerBlock}>
            <Text style={styles.panelKicker}>Next Best Action</Text>
            <Text style={styles.nextTitle}>{planning.nextBestAction.title}</Text>
            <Text style={styles.muted}>{planning.nextBestAction.detail}</Text>
            <Pressable
              onPress={() => go(planning.nextBestAction.href)}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            >
              <Text style={styles.ctaText}>{planning.nextBestAction.cta}</Text>
            </Pressable>
          </View>

          <View style={styles.plannerBlock}>
            <Text style={styles.panelKicker}>Quick Actions</Text>
            <View style={styles.quickActions}>
              {planning.quickActions.map((a) => (
                <Pressable
                  key={a.href}
                  onPress={() => go(a.href)}
                  style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                >
                  <Text style={styles.chipText}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Panel>

        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },

  kicker: { ...fonts.kicker, color: colors.textMuted },
  muted: { ...fonts.small, fontSize: 12, color: colors.textMuted },
  panelKicker: { ...fonts.kicker, color: colors.textMuted, marginBottom: spacing.md },

  // Hero
  heroPanel: { gap: spacing.xs },
  scoreMain: {
    ...fonts.monoLarge,
    fontSize: 52,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  scoreRows: { gap: spacing.md, marginTop: spacing.lg },
  scoreRow: { gap: spacing.xs },
  scoreRowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreRowLabel: { ...fonts.kicker, fontSize: 10, color: colors.textSecondary },
  scoreRowValue: { ...fonts.mono, fontSize: 12, color: colors.text },

  // vs Last Week
  comparisonRow: { flexDirection: "row", gap: spacing.sm },

  // Radar
  radarWrap: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.sm },

  // Engine cards
  engineCards: { gap: spacing.lg },

  // This Week
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  metricMeta: { ...fonts.small, fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // Planner
  plannerPanel: { gap: spacing.lg },
  plannerTitle: {
    ...fonts.title,
    fontSize: 20,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  plannerBlock: { gap: spacing.xs },
  plannerPercent: { ...fonts.monoLarge, fontSize: 36, fontWeight: "700" },
  nextTitle: { ...fonts.subheading, fontSize: 15 },
  cta: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceBorderStrong,
    borderWidth: 1,
    borderColor: colors.cardBorderActive,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  ctaText: { ...fonts.kicker, fontSize: 11, color: colors.text },
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipText: { ...fonts.kicker, fontSize: 10, color: colors.textSecondary },
  pressed: { opacity: 0.65 },
});
