import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Panel } from "../../src/components/ui/Panel";
import { ScoreGauge } from "../../src/components/ui/ScoreGauge";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { XPBar } from "../../src/components/ui/XPBar";
import { Skeleton } from "../../src/components/ui/Skeleton";

import { useProfile } from "../../src/hooks/queries/useProfile";
import {
  useEngineTasks,
  useEngineCompletions,
  useToggleCompletion,
  useRecentCompletionMap,
} from "../../src/hooks/queries/useTasks";
import { computeEngineScore } from "../../src/services/tasks";
import type { EngineKey } from "../../src/db/schema";
import { getTodayKey, addDays } from "../../src/lib/date";

import { colors, fonts, radius, spacing } from "../../src/theme";

const ENGINES: readonly EngineKey[] = ["body", "mind", "money", "charisma"];

const ENGINE_META: Record<
  EngineKey,
  { title: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  body: { title: "BODY", icon: "barbell-outline", color: colors.body },
  mind: { title: "MIND", icon: "library-outline", color: colors.mind },
  money: { title: "MONEY", icon: "trending-up-outline", color: colors.money },
  charisma: {
    title: "GENERAL",
    icon: "people-outline",
    color: colors.charisma,
  },
};

function isEngineKey(value: string | undefined): value is EngineKey {
  return Boolean(value) && (ENGINES as readonly string[]).includes(value!);
}

export default function EngineDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = getTodayKey();

  if (!isEngineKey(id)) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorBlock}>
          <Text style={styles.errorTitle}>Unknown engine</Text>
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const engine: EngineKey = id;
  const meta = ENGINE_META[engine];

  const { data: profile } = useProfile();
  const { data: tasks } = useEngineTasks(engine);
  const { data: completionsToday } = useEngineCompletions(engine, today);
  const { data: recentCompletions } = useRecentCompletionMap();
  const toggleCompletion = useToggleCompletion();

  const activeTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.is_active),
    [tasks],
  );

  const completedSet = useMemo(
    () => new Set((completionsToday ?? []).map((c) => c.task_id)),
    [completionsToday],
  );

  const todayScore = useMemo(
    () => computeEngineScore(activeTasks, completedSet),
    [activeTasks, completedSet],
  );

  /**
   * 30-day strip — derived from useRecentCompletionMap which returns
   * task_id → date_key[] across the last 30 days. For each day we
   * compute the engine's score: completed-engine-tasks / total-engine-tasks
   * (simplification of computeEngineScore that works with the historical
   * shape).
   */
  const strip = useMemo(() => {
    const cells: { dateKey: string; score: number }[] = [];
    const taskIds = new Set(activeTasks.map((t) => t.id));
    const totalEngineTasks = activeTasks.length;

    for (let i = 29; i >= 0; i--) {
      const dateKey = addDays(today, -i);
      if (!recentCompletions || totalEngineTasks === 0) {
        cells.push({ dateKey, score: 0 });
        continue;
      }
      let doneThatDay = 0;
      for (const [taskId, dates] of Object.entries(recentCompletions)) {
        if (taskIds.has(taskId) && dates.includes(dateKey)) doneThatDay++;
      }
      const score = Math.round((doneThatDay / totalEngineTasks) * 100);
      cells.push({ dateKey, score });
    }

    return cells;
  }, [recentCompletions, activeTasks, today]);

  const handleToggle = useCallback(
    (taskId: string) => {
      const task = activeTasks.find((t) => t.id === taskId);
      if (!task) return;
      toggleCompletion.mutate({
        task: { id: task.id, engine: task.engine as EngineKey },
        dateKey: today,
      });
    },
    [activeTasks, toggleCompletion, today],
  );

  const completedCount = activeTasks.filter((t) =>
    completedSet.has(t.id),
  ).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.kicker, { color: meta.color }]}>
              ENGINE · {meta.title}
            </Text>
            <Text style={styles.title}>{meta.title.charAt(0) + meta.title.slice(1).toLowerCase()}</Text>
          </View>
        </View>

        {/* Score gauge */}
        <Panel style={styles.scorePanel}>
          <ScoreGauge
            score={todayScore}
            size={160}
            label="SCORE TODAY"
            color={meta.color}
          />
          <Text style={styles.scoreMeta}>
            {completedCount}/{activeTasks.length} missions complete
          </Text>
        </Panel>

        {/* 30-day strip */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionKicker}>30 DAYS</Text>
          <Text style={styles.sectionMeta}>
            Day 30 → Today
          </Text>
        </View>
        <Panel style={styles.heatPanel}>
          {recentCompletions == null ? (
            <Skeleton variant="card" height={48} />
          ) : (
            <View style={styles.heatRow}>
              {strip.map((cell, i) => {
                const intensity =
                  cell.score === 0
                    ? 0.05
                    : cell.score < 25
                      ? 0.18
                      : cell.score < 50
                        ? 0.34
                        : cell.score < 75
                          ? 0.55
                          : 0.85;
                return (
                  <View
                    key={`${cell.dateKey}-${i}`}
                    style={[
                      styles.heatCell,
                      {
                        backgroundColor: meta.color,
                        opacity: intensity,
                      },
                    ]}
                  />
                );
              })}
            </View>
          )}
        </Panel>

        {/* Tasks */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionKicker}>{meta.title} MISSIONS</Text>
          <Text style={styles.sectionMeta}>
            {completedCount}/{activeTasks.length}
          </Text>
        </View>
        {activeTasks.length === 0 ? (
          <Panel>
            <Text style={styles.emptyText}>
              No {meta.title.toLowerCase()} missions yet. Add one from the Track tab.
            </Text>
          </Panel>
        ) : (
          <View style={styles.missionList}>
            {activeTasks.map((task) => (
              <MissionRow
                key={task.id}
                taskId={task.id}
                title={task.title}
                xp={task.kind === "main" ? 2 : 1}
                completed={completedSet.has(task.id)}
                kind={task.kind}
                engine={engine}
                onToggle={handleToggle}
              />
            ))}
          </View>
        )}

        {/* XP — global level */}
        {profile && (
          <View style={styles.xpBlock}>
            <XPBar xp={profile.xp ?? 0} level={profile.level ?? 1} />
          </View>
        )}

        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerText: { flex: 1, gap: spacing.xs },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7 },
  kicker: {
    ...fonts.kicker,
    letterSpacing: 2,
    fontSize: 11,
  },
  title: {
    ...fonts.title,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  scorePanel: {
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  scoreMeta: {
    ...fonts.body,
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 1,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionKicker: {
    ...fonts.kicker,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  sectionMeta: {
    ...fonts.small,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  heatPanel: { padding: spacing.md },
  heatRow: {
    flexDirection: "row",
    gap: 3,
  },
  heatCell: {
    flex: 1,
    height: 28,
    borderRadius: 2,
  },
  emptyText: {
    ...fonts.body,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  missionList: { gap: spacing.sm },
  xpBlock: { marginTop: spacing.sm },
  errorBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  errorTitle: { ...fonts.title, color: colors.text },
  backLink: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: radius.md,
  },
  backLinkText: { ...fonts.body, color: colors.text },
});
