import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScoreGauge } from "../../src/components/ui/ScoreGauge";
import { EngineCard } from "../../src/components/ui/EngineCard";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { XPBar } from "../../src/components/ui/XPBar";
import { WeekStrip } from "../../src/components/ui/WeekStrip";
import { Panel } from "../../src/components/ui/Panel";
import { Skeleton } from "../../src/components/ui/Skeleton";

import { useProfile } from "../../src/hooks/queries/useProfile";
import {
  useAllTasks,
  useAllCompletionsForDate,
  useToggleCompletion,
} from "../../src/hooks/queries/useTasks";
import { computeEngineScore } from "../../src/services/tasks";
import type { EngineKey } from "../../src/db/schema";
import { calculateWeightedTitanScore } from "../../src/lib/scoring-v2";
import { getTodayKey, getGreeting } from "../../src/lib/date";

import { colors, fonts, spacing } from "../../src/theme";

const ENGINES: readonly EngineKey[] = ["body", "mind", "money", "charisma"];

export default function HQScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = getTodayKey();

  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: tasks } = useAllTasks();
  const { data: completions } = useAllCompletionsForDate(today);
  const toggleCompletion = useToggleCompletion();

  const activeTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.is_active),
    [tasks],
  );

  const completedSet = useMemo(
    () => new Set((completions ?? []).map((c) => c.task_id)),
    [completions],
  );

  const engineScores = useMemo<Record<EngineKey, number>>(() => {
    const map = {} as Record<EngineKey, number>;
    for (const engine of ENGINES) {
      map[engine] = computeEngineScore(activeTasks, completedSet, engine);
    }
    return map;
  }, [activeTasks, completedSet]);

  const engineCounts = useMemo<Record<EngineKey, { completed: number; total: number }>>(() => {
    const map = {} as Record<EngineKey, { completed: number; total: number }>;
    for (const engine of ENGINES) {
      const engineTasks = activeTasks.filter((t) => t.engine === engine);
      const completed = engineTasks.filter((t) => completedSet.has(t.id)).length;
      map[engine] = { completed, total: engineTasks.length };
    }
    return map;
  }, [activeTasks, completedSet]);

  const titanScore = useMemo(
    () =>
      calculateWeightedTitanScore(
        engineScores as unknown as Record<string, number>,
        null,
        false,
      ),
    [engineScores],
  );

  const todayMissions = useMemo(
    () =>
      activeTasks
        .slice()
        .sort((a, b) => {
          // main tasks first, then by created order
          if (a.kind !== b.kind) return a.kind === "main" ? -1 : 1;
          return (a.created_at ?? "").localeCompare(b.created_at ?? "");
        })
        .slice(0, 6),
    [activeTasks],
  );

  const completedCount = todayMissions.filter((t) =>
    completedSet.has(t.id),
  ).length;

  const onRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
    void queryClient.invalidateQueries({ queryKey: ["completions"] });
  }, [queryClient]);

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

  const handleEngineTap = useCallback(
    (engine: EngineKey) => {
      router.push(`/engine/${engine}`);
    },
    [router],
  );

  const handleProfileTap = useCallback(() => {
    router.navigate("/(tabs)/profile");
  }, [router]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={onRefresh}
            tintColor={colors.textMuted}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>{getGreeting().toUpperCase()}</Text>
            <Text style={styles.title}>HQ</Text>
          </View>
          <Pressable
            onPress={handleProfileTap}
            style={({ pressed }) => [
              styles.profileButton,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Open profile"
          >
            <Ionicons name="person-outline" size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* Hero — score gauge + week strip */}
        <Panel style={styles.heroPanel}>
          <View style={styles.heroInner}>
            {profileLoading ? (
              <Skeleton variant="card" height={180} />
            ) : (
              <ScoreGauge
                score={titanScore}
                size={180}
                label="TITAN SCORE"
              />
            )}
            <View style={styles.heroMeta}>
              <Text style={styles.heroMetaValue}>
                {profile?.streak_current ?? 0}
              </Text>
              <Text style={styles.heroMetaLabel}>DAY STREAK</Text>
            </View>
          </View>
          <View style={styles.weekStripWrap}>
            <WeekStrip />
          </View>
        </Panel>

        {/* Engines */}
        <Text style={styles.sectionKicker}>ENGINES</Text>
        <View style={styles.engineGrid}>
          {ENGINES.map((engine) => (
            <View key={engine} style={styles.engineCell}>
              <EngineCard
                engine={engine}
                score={engineScores[engine]}
                completedCount={engineCounts[engine].completed}
                totalCount={engineCounts[engine].total}
                onPress={() => handleEngineTap(engine)}
              />
            </View>
          ))}
        </View>

        {/* Today's missions */}
        <View style={styles.missionsHeader}>
          <Text style={styles.sectionKicker}>TODAY&apos;S MISSIONS</Text>
          <Text style={styles.sectionMeta}>
            {completedCount}/{todayMissions.length}
          </Text>
        </View>
        {todayMissions.length === 0 ? (
          <Panel>
            <Text style={styles.emptyText}>
              No missions yet. Head to the Track tab to add one.
            </Text>
          </Panel>
        ) : (
          <View style={styles.missionList}>
            {todayMissions.map((task) => (
              <MissionRow
                key={task.id}
                taskId={task.id}
                title={task.title}
                xp={task.kind === "main" ? 2 : 1}
                completed={completedSet.has(task.id)}
                kind={task.kind}
                engine={task.engine as EngineKey}
                onToggle={handleToggle}
              />
            ))}
          </View>
        )}

        {/* XP bar */}
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
    justifyContent: "space-between",
  },
  headerText: { gap: spacing.xs },
  kicker: {
    ...fonts.kicker,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  title: {
    ...fonts.title,
    fontSize: 32,
    letterSpacing: -0.5,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  heroPanel: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  heroInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
  },
  heroMeta: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  heroMetaValue: {
    ...fonts.title,
    fontSize: 36,
    color: colors.text,
  },
  heroMetaLabel: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  weekStripWrap: { marginTop: spacing.xs },
  sectionKicker: {
    ...fonts.kicker,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  sectionMeta: {
    ...fonts.kicker,
    color: colors.text,
    letterSpacing: 2,
  },
  engineGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
  },
  engineCell: {
    width: "50%",
    padding: spacing.xs,
  },
  missionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  missionList: { gap: spacing.sm },
  emptyText: {
    ...fonts.body,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  xpBlock: { marginTop: spacing.sm },
});
