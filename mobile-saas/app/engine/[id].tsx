import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Panel } from "../../src/components/ui/Panel";
import { ScoreGauge } from "../../src/components/ui/ScoreGauge";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { XPBar } from "../../src/components/ui/XPBar";
import { FAB } from "../../src/components/ui/FAB";
import { AddTaskSheet } from "../../src/components/ui/AddTaskSheet";

import { useProfile } from "../../src/hooks/queries/useProfile";
import {
  useEngineTasks,
  useEngineCompletions,
  useToggleCompletion,
  useDeleteTask,
} from "../../src/hooks/queries/useTasks";
import { useDailyPlanning } from "../../src/hooks/queries/useDashboard";
import type { Task } from "../../src/services/tasks";
import type { EngineKey } from "../../src/lib/scoring";
import { getTodayKey, formatDateShort } from "../../src/lib/date";

import { colors, fonts, radius, spacing } from "../../src/theme";

const ENGINES: readonly EngineKey[] = ["body", "mind", "money", "charisma"];

const ENGINE_META: Record<
  EngineKey,
  { title: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  body: { title: "BODY", icon: "barbell-outline", color: colors.body },
  mind: { title: "MIND", icon: "library-outline", color: colors.mind },
  money: { title: "MONEY", icon: "trending-up-outline", color: colors.money },
  charisma: { title: "GENERAL", icon: "people-outline", color: colors.charisma },
};

function isEngineKey(value: string | undefined): value is EngineKey {
  return Boolean(value) && (ENGINES as readonly string[]).includes(value!);
}

/* ── Task bucket (Main / Secondary), mirrors web's task buckets ── */
function TaskBucket({
  label,
  dateLabel,
  tasks,
  completedSet,
  engine,
  onToggle,
  onDelete,
  onAdd,
}: {
  label: string;
  dateLabel: string;
  tasks: Task[];
  completedSet: Set<string>;
  engine: EngineKey;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <Panel tone="subtle" style={styles.bucket}>
      <View style={styles.bucketHead}>
        <Text style={styles.bucketKicker}>{label}</Text>
        <Text style={styles.bucketDate}>{dateLabel}</Text>
      </View>
      {tasks.length === 0 ? (
        <Text style={styles.bucketEmpty}>Nothing here yet.</Text>
      ) : (
        <View style={styles.bucketList}>
          {tasks.map((task) => (
            <MissionRow
              key={task.id}
              taskId={task.id}
              title={task.title}
              xp={task.kind === "main" ? 20 : 10}
              completed={completedSet.has(task.id)}
              kind={task.kind}
              engine={engine}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </View>
      )}
      <Pressable onPress={onAdd} style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}>
        <Ionicons name="add" size={16} color={colors.textSecondary} />
        <Text style={styles.addText}>Add task</Text>
      </Pressable>
    </Panel>
  );
}

export default function EngineDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = getTodayKey();
  const [sheetOpen, setSheetOpen] = useState(false);

  const engine: EngineKey | null = isEngineKey(id) ? id : null;

  const { data: profile } = useProfile();
  const { data: tasks } = useEngineTasks((engine ?? "body") as EngineKey);
  const { data: completionsToday } = useEngineCompletions((engine ?? "body") as EngineKey, today);
  const planning = useDailyPlanning();
  const toggleCompletion = useToggleCompletion();
  const deleteTask = useDeleteTask();

  const activeTasks = useMemo(() => (tasks ?? []).filter((t) => t.is_active), [tasks]);
  const completedSet = useMemo(
    () => new Set((completionsToday ?? []).map((c) => c.task_id)),
    [completionsToday],
  );

  const mainTasks = useMemo(() => activeTasks.filter((t) => t.kind === "main"), [activeTasks]);
  const sideTasks = useMemo(() => activeTasks.filter((t) => t.kind !== "main"), [activeTasks]);

  const handleToggle = useCallback(
    (taskId: string) => {
      if (!engine) return;
      toggleCompletion.mutate({ task: { id: taskId, engine }, dateKey: today });
    },
    [engine, toggleCompletion, today],
  );

  const handleDelete = useCallback(
    (taskId: string) => {
      if (!engine) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      deleteTask.mutate({ taskId, engine });
    },
    [engine, deleteTask],
  );

  if (!engine) {
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

  const meta = ENGINE_META[engine];
  const day = planning.titan.perEngine[engine];
  const displayName = meta.title.charAt(0) + meta.title.slice(1).toLowerCase();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.kicker, { color: meta.color }]}>ENGINE · {meta.title}</Text>
            <Text style={styles.title}>{displayName}</Text>
          </View>
        </View>

        {/* Score gauge */}
        <Panel tone="hero" style={styles.scorePanel}>
          <ScoreGauge score={day.percent} size={160} label="SCORE TODAY" color={meta.color} />
          <Text style={styles.scoreMeta}>
            Main {day.mainDone}/{day.mainTotal} · Secondary {day.secondaryDone}/{day.secondaryTotal}
          </Text>
        </Panel>

        {/* Task buckets */}
        <TaskBucket
          label="MAIN TASKS"
          dateLabel={formatDateShort(today)}
          tasks={mainTasks}
          completedSet={completedSet}
          engine={engine}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onAdd={() => setSheetOpen(true)}
        />
        <TaskBucket
          label="SECONDARY TASKS"
          dateLabel={formatDateShort(today)}
          tasks={sideTasks}
          completedSet={completedSet}
          engine={engine}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onAdd={() => setSheetOpen(true)}
        />

        {/* XP — global level (kept; this is not the dashboard) */}
        {profile && (
          <View style={styles.xpBlock}>
            <XPBar xp={profile.xp ?? 0} level={profile.level ?? 1} />
          </View>
        )}

        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>

      <FAB onPress={() => setSheetOpen(true)} />
      <AddTaskSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} defaultEngine={engine} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
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
  kicker: { ...fonts.kicker, letterSpacing: 2, fontSize: 11 },
  title: { ...fonts.title, fontSize: 28, letterSpacing: -0.5 },
  scorePanel: { padding: spacing.lg, alignItems: "center", gap: spacing.sm },
  scoreMeta: {
    ...fonts.mono,
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  bucket: { gap: spacing.md, padding: spacing.lg },
  bucketHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bucketKicker: { ...fonts.kicker, color: colors.textMuted, letterSpacing: 2 },
  bucketDate: { ...fonts.small, color: colors.textMuted, fontSize: 10, letterSpacing: 1 },
  bucketList: { gap: spacing.sm },
  bucketEmpty: {
    ...fonts.body,
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: spacing.xs,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderStyle: "dashed",
    justifyContent: "center",
  },
  addText: { ...fonts.kicker, fontSize: 11, color: colors.textSecondary },
  xpBlock: { marginTop: spacing.sm },
  errorBlock: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
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
