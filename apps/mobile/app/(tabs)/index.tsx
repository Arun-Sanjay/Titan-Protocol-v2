import React, { useEffect, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { colors, spacing, fonts, shadows } from "../../src/theme";
import { PowerRing } from "../../src/components/ui/PowerRing";
import { XPBar } from "../../src/components/ui/XPBar";
import { StreakBadge } from "../../src/components/ui/StreakBadge";
import { EngineCard } from "../../src/components/ui/EngineCard";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { PageHeader } from "../../src/components/ui/PageHeader";
import { getTodayKey, getGreeting } from "../../src/lib/date";
import { useEngineStore, selectTotalScore, selectAllTasksForDate, ENGINES, type TaskWithStatus } from "../../src/stores/useEngineStore";
import { useProfileStore, XP_REWARDS } from "../../src/stores/useProfileStore";
import type { EngineKey } from "../../src/db/schema";

export default function HQScreen() {
  const router = useRouter();
  const dateKey = getTodayKey();

  const loadAllEngines = useEngineStore((s) => s.loadAllEngines);
  const toggleTask = useEngineStore((s) => s.toggleTask);
  const storeTasks = useEngineStore((s) => s.tasks);
  const storeCompletions = useEngineStore((s) => s.completions);
  const scores = useEngineStore((s) => s.scores);

  const tasks = useMemo(() => selectAllTasksForDate(storeTasks, storeCompletions, dateKey), [storeTasks, storeCompletions, dateKey]);
  const totalScore = useMemo(() => selectTotalScore(scores, dateKey), [scores, dateKey]);

  const profileXp = useProfileStore((s) => s.profile.xp);
  const profileLevel = useProfileStore((s) => s.profile.level);
  const profileStreak = useProfileStore((s) => s.profile.streak);
  const loadProfile = useProfileStore((s) => s.load);
  const awardXP = useProfileStore((s) => s.awardXP);
  const updateStreak = useProfileStore((s) => s.updateStreak);

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    loadAllEngines(dateKey);
    loadProfile();
  }, [dateKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAllEngines(dateKey);
    loadProfile();
    setRefreshing(false);
  }, [dateKey]);

  const handleToggle = useCallback((task: TaskWithStatus) => {
    const completed = toggleTask(task.engine, task.id!, dateKey);
    if (completed) {
      const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
      awardXP(dateKey, "task_complete", xp);
      updateStreak(dateKey);
    }
  }, [dateKey]);

  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);

  const engineCounts = useCallback((engine: EngineKey) => {
    const et = tasks.filter((t) => t.engine === engine);
    return { completed: et.filter((t) => t.completed).length, total: et.length };
  }, [tasks]);

  const renderMission = useCallback(({ item }: { item: TaskWithStatus }) => (
    <MissionRow
      title={item.title}
      xp={item.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST}
      completed={item.completed}
      kind={item.kind}
      onToggle={() => handleToggle(item)}
    />
  ), [handleToggle]);

  const ListHeader = useMemo(() => (
    <>
      <PageHeader kicker="COMMAND // HQ" title={getGreeting()} />

      <View style={styles.xpWrap}>
        <XPBar xp={profileXp} level={profileLevel} />
      </View>

      <View style={styles.ringWrap}>
        <PowerRing score={totalScore} size={200} />
      </View>

      <StreakBadge streak={profileStreak} />

      <SectionHeader title="ENGINES" />
      <View style={styles.engineGrid}>
        {ENGINES.map((engine) => {
          const counts = engineCounts(engine);
          return (
            <EngineCard
              key={engine}
              engine={engine}
              score={scores[`${engine}:${dateKey}`] ?? 0}
              completedCount={counts.completed}
              totalCount={counts.total}
              onPress={() => router.push(`/engine/${engine}`)}
            />
          );
        })}
      </View>

      <SectionHeader title="TODAY'S MISSIONS" right={`${completedCount}/${tasks.length}`} />

      {tasks.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyText}>No missions yet</Text>
          <Text style={styles.emptyHint}>Go to an engine and add your first mission</Text>
        </View>
      )}
    </>
  ), [profileXp, profileLevel, profileStreak, totalScore, scores, dateKey, tasks.length, completedCount, engineCounts]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlashList
        data={tasks}
        renderItem={renderMission}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={<View style={{ height: 100 }} />}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  xpWrap: { marginTop: spacing.xl },
  ringWrap: { alignItems: "center", marginTop: spacing["2xl"], marginBottom: spacing.lg },
  engineGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  empty: { alignItems: "center", paddingVertical: spacing["4xl"] },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 18, fontWeight: "600", color: colors.text },
  emptyHint: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
});
