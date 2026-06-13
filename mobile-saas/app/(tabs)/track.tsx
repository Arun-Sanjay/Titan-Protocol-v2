import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { PageHeader } from "../../src/components/ui/PageHeader";
import { Panel } from "../../src/components/ui/Panel";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { FAB } from "../../src/components/ui/FAB";
import {
  EngineFilterTabs,
  type EngineFilter,
} from "../../src/components/ui/EngineFilterTabs";
import { AddTaskSheet } from "../../src/components/ui/AddTaskSheet";

import {
  useAllTasks,
  useAllCompletionsForDate,
  useToggleCompletion,
  useDeleteTask,
} from "../../src/hooks/queries/useTasks";
import type { EngineKey } from "../../src/db/schema";
import { getTodayKey } from "../../src/lib/date";

import { colors, fonts, spacing } from "../../src/theme";

export default function TrackScreen() {
  const router = useRouter();
  const today = getTodayKey();

  const [filter, setFilter] = useState<EngineFilter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: tasks } = useAllTasks();
  const { data: completions } = useAllCompletionsForDate(today);
  const toggleCompletion = useToggleCompletion();
  const deleteTask = useDeleteTask();

  const completedSet = useMemo(
    () => new Set((completions ?? []).map((c) => c.task_id)),
    [completions],
  );

  const visibleTasks = useMemo(() => {
    const base = (tasks ?? []).filter((t) => t.is_active);
    if (filter === "all") return base;
    return base.filter((t) => t.engine === filter);
  }, [tasks, filter]);

  const handleToggle = useCallback(
    (taskId: string) => {
      const task = visibleTasks.find((t) => t.id === taskId);
      if (!task) return;
      toggleCompletion.mutate({
        task: { id: task.id, engine: task.engine as EngineKey },
        dateKey: today,
      });
    },
    [visibleTasks, toggleCompletion, today],
  );

  const handleDelete = useCallback(
    (taskId: string) => {
      const task = (tasks ?? []).find((t) => t.id === taskId);
      Alert.alert(
        "Delete mission?",
        task ? `"${task.title}" will be removed.` : undefined,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              deleteTask.mutate({
                taskId,
                engine: task?.engine as EngineKey | undefined,
              });
            },
          },
        ],
      );
    },
    [tasks, deleteTask],
  );

  const handleHabits = useCallback(() => {
    router.push("/habits");
  }, [router]);

  const completedCount = visibleTasks.filter((t) =>
    completedSet.has(t.id),
  ).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerWrap}>
        <PageHeader
          kicker="DAILY EXECUTION"
          title="Track"
        />
        <EngineFilterTabs value={filter} onChange={setFilter} />
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>MISSIONS</Text>
          <Text style={styles.statsValue}>
            {completedCount}/{visibleTasks.length}
          </Text>
        </View>
      </View>

      {visibleTasks.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Panel>
            <Text style={styles.emptyText}>
              {filter === "all"
                ? "No missions yet. Tap + to add your first."
                : `No ${filter} missions yet. Tap + to add one.`}
            </Text>
          </Panel>
        </View>
      ) : (
        <FlashList
          data={visibleTasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <MissionRow
                taskId={item.id}
                title={item.title}
                xp={item.kind === "main" ? 20 : 10}
                completed={completedSet.has(item.id)}
                kind={item.kind}
                engine={item.engine as EngineKey}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Pressable
        onPress={handleHabits}
        style={({ pressed }) => [
          styles.habitsLink,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="repeat-outline"
          size={16}
          color={colors.textMuted}
          style={{ marginRight: spacing.xs }}
        />
        <Text style={styles.habitsLinkText}>Open habits →</Text>
      </Pressable>

      <FAB
        onPress={() => {
          setSheetOpen(true);
        }}
      />

      <AddTaskSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        defaultEngine={
          filter !== "all" ? (filter as EngineKey) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerWrap: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  statsLabel: {
    ...fonts.kicker,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  statsValue: {
    ...fonts.kicker,
    color: colors.text,
    fontSize: 12,
    letterSpacing: 2,
  },
  emptyWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  emptyText: {
    ...fonts.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingVertical: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  rowWrap: { paddingVertical: spacing.xs },
  habitsLink: {
    position: "absolute",
    bottom: spacing.lg,
    left: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  habitsLinkText: {
    ...fonts.body,
    color: colors.textMuted,
    fontSize: 13,
  },
  pressed: { opacity: 0.6 },
});
