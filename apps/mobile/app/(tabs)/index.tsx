import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet, RefreshControl, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, fonts, shadows, radius } from "../../src/theme";
import { PowerRing } from "../../src/components/ui/PowerRing";
import { XPBar } from "../../src/components/ui/XPBar";
import { StreakBadge } from "../../src/components/ui/StreakBadge";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { PageHeader } from "../../src/components/ui/PageHeader";
import { Panel } from "../../src/components/ui/Panel";
import { RadarChart } from "../../src/components/ui/RadarChart";
import { SparklineChart } from "../../src/components/ui/SparklineChart";
import { HeatmapGrid } from "../../src/components/ui/HeatmapGrid";
import { WeekComparison } from "../../src/components/ui/WeekComparison";
import { WeeklySummary } from "../../src/components/ui/WeeklySummary";
import { PulsingGlow } from "../../src/components/ui/PulsingGlow";
import { TitanProgress } from "../../src/components/ui/TitanProgress";
import { useAnalyticsData } from "../../src/hooks/useAnalyticsData";
import { useEngineStore, selectAllTasksForDate, ENGINES, type TaskWithStatus } from "../../src/stores/useEngineStore";
import { useProfileStore, XP_REWARDS } from "../../src/stores/useProfileStore";
import type { EngineKey } from "../../src/db/schema";

const ENGINE_LABELS: Record<EngineKey, string> = {
  body: "BODY",
  mind: "MIND",
  money: "MONEY",
  general: "GENERAL",
};
const ENGINE_COLORS: Record<EngineKey, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  general: colors.general,
};

export default function HQScreen() {
  const router = useRouter();
  const analytics = useAnalyticsData();

  const storeTasks = useEngineStore((s) => s.tasks);
  const storeCompletions = useEngineStore((s) => s.completions);
  const toggleTask = useEngineStore((s) => s.toggleTask);
  const loadAllEngines = useEngineStore((s) => s.loadAllEngines);

  const profileXp = useProfileStore((s) => s.profile.xp);
  const profileLevel = useProfileStore((s) => s.profile.level);
  const profileStreak = useProfileStore((s) => s.profile.streak);
  const loadProfile = useProfileStore((s) => s.load);
  const awardXP = useProfileStore((s) => s.awardXP);
  const updateStreak = useProfileStore((s) => s.updateStreak);

  const tasks = useMemo(
    () => selectAllTasksForDate(storeTasks, storeCompletions, analytics.today),
    [storeTasks, storeCompletions, analytics.today]
  );
  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAllEngines(analytics.today);
    loadProfile();
    setRefreshing(false);
  }, [analytics.today]);

  const handleToggle = useCallback((task: TaskWithStatus) => {
    const completed = toggleTask(task.engine, task.id!, analytics.today);
    if (completed) {
      const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
      awardXP(analytics.today, "task_complete", xp);
      updateStreak(analytics.today);
    }
  }, [analytics.today]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.text]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Header */}
        <PageHeader kicker="TITAN PROTOCOL" title="TITAN OS" subtitle="Your performance operating system — four engines, one view." />

        {/* XP Bar */}
        <View style={styles.xpWrap}>
          <XPBar xp={profileXp} level={profileLevel} />
        </View>
        <StreakBadge streak={profileStreak} />

        {/* Titan Score panel */}
        <Panel hero style={styles.titanScorePanel}>
          <View style={styles.titanScoreRow}>
            <View style={styles.titanScoreLeft}>
              <Text style={styles.titanScoreLabel}>TITAN SCORE</Text>
              <Text style={styles.titanScoreValue}>{analytics.titanScore.toFixed(1)}%</Text>
              <Text style={styles.titanScoreSub}>
                {analytics.activeEngines}/4 engines active today
              </Text>
            </View>
          </View>
          {/* Engine progress bars */}
          <View style={styles.engineBars}>
            {ENGINES.map((engine) => (
              <Pressable
                key={engine}
                style={styles.engineBarRow}
                onPress={() => router.push(`/engine/${engine}`)}
              >
                <Text style={[styles.engineBarLabel, { color: ENGINE_COLORS[engine] }]}>
                  {ENGINE_LABELS[engine]}
                </Text>
                <View style={styles.engineBarTrack}>
                  <View
                    style={[
                      styles.engineBarFill,
                      {
                        width: `${analytics.engineScores[engine]}%`,
                        backgroundColor: ENGINE_COLORS[engine],
                      },
                    ]}
                  />
                </View>
                <Text style={styles.engineBarValue}>
                  {analytics.engineScores[engine].toFixed(1)}%
                </Text>
              </Pressable>
            ))}
          </View>
        </Panel>

        {/* Engine Overview radar — full width */}
        <Panel style={styles.radarPanel}>
          <Text style={styles.radarLabel}>ENGINE OVERVIEW</Text>
          <RadarChart scores={analytics.engineScores} size={240} />
        </Panel>

        {/* VS Last Week */}
        <WeekComparison thisWeek={analytics.thisWeekEngines} lastWeek={analytics.lastWeek} />

        {/* Engine Sparkline Cards */}
        <SectionHeader title="ENGINES" />
        <View style={styles.sparkGrid}>
          {ENGINES.map((engine) => (
            <Panel
              key={engine}
              onPress={() => router.push(`/engine/${engine}`)}
              style={styles.sparkCard}
            >
              <View style={styles.sparkHeader}>
                <Text style={[styles.sparkLabel, { color: ENGINE_COLORS[engine] }]}>
                  {ENGINE_LABELS[engine]}
                </Text>
                <Text style={styles.sparkValue}>{analytics.engineScores[engine]}%</Text>
              </View>
              <SparklineChart data={analytics.sparklineData[engine]} width={140} height={36} />
              <Text style={styles.sparkSub}>
                Today: {analytics.engineScores[engine]}%
              </Text>
            </Panel>
          ))}
        </View>

        {/* Weekly Summary */}
        <WeeklySummary
          avgScore={analytics.thisWeek.avgScore}
          tasksCompleted={analytics.thisWeek.tasksCompleted}
          bestDayScore={analytics.thisWeek.bestDayScore}
          bestDayDate={analytics.thisWeek.bestDayDate}
        />

        {/* Heatmap */}
        <SectionHeader title="ACTIVITY" />
        <Panel>
          <HeatmapGrid data={analytics.heatmapData} />
        </Panel>

        {/* Today's Missions */}
        <SectionHeader title="TODAY'S MISSIONS" right={`${completedCount}/${tasks.length}`} />

        {tasks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyText}>No missions yet</Text>
            <Text style={styles.emptyHint}>Go to an engine and add your first mission</Text>
          </View>
        ) : (
          tasks.map((task) => (
            <MissionRow
              key={task.id}
              title={task.title}
              xp={task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST}
              completed={task.completed}
              kind={task.kind}
              onToggle={() => handleToggle(task)}
            />
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  xpWrap: { marginTop: spacing.lg, marginBottom: spacing.md },

  // Titan Score panel
  titanScorePanel: { marginTop: spacing.md },
  titanScoreRow: { flexDirection: "row", alignItems: "center" },
  titanScoreLeft: { flex: 1 },
  titanScoreLabel: { ...fonts.kicker, fontSize: 9, color: colors.textMuted },
  titanScoreValue: { ...fonts.monoValue, fontSize: 38, marginTop: spacing.xs },
  titanScoreSub: { ...fonts.small, fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // Radar panel
  radarPanel: { marginTop: spacing.sm, alignItems: "center" },

  // Engine progress bars inside titan score panel
  engineBars: { marginTop: spacing.md, gap: spacing.sm },
  engineBarRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  engineBarLabel: { ...fonts.kicker, fontSize: 9, width: 55 },
  engineBarTrack: {
    flex: 1,
    height: 5,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: radius.full,
    overflow: "hidden",
  },
  engineBarFill: { height: "100%", borderRadius: radius.full },
  engineBarValue: { ...fonts.mono, fontSize: 11, color: colors.textSecondary, width: 42, textAlign: "right" },

  radarLabel: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.sm },

  // Sparkline grid
  sparkGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sparkCard: { flex: 1, minWidth: "47%" },
  sparkHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  sparkLabel: { ...fonts.kicker, fontSize: 9 },
  sparkValue: { ...fonts.mono, fontSize: 16, fontWeight: "800", color: colors.text },
  sparkSub: { ...fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: spacing.xs },

  // Empty state
  empty: { alignItems: "center", paddingVertical: spacing["4xl"] },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 18, fontWeight: "600", color: colors.text },
  emptyHint: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
});
