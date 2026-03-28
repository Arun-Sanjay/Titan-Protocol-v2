import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform, AppState,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, TOUCH_MIN } from "../../src/theme";
import { PowerRing } from "../../src/components/ui/PowerRing";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { DateNavigator } from "../../src/components/ui/DateNavigator";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { FAB } from "../../src/components/ui/FAB";
import { getTodayKey } from "../../src/lib/date";
import { useEngineStore } from "../../src/stores/useEngineStore";
import { useProfileStore, XP_REWARDS } from "../../src/stores/useProfileStore";
import type { EngineKey, Task } from "../../src/db/schema";

const ENGINE_META: Record<EngineKey, { icon: string; label: string; color: string }> = {
  body: { icon: "⚡", label: "Body Engine", color: colors.body },
  mind: { icon: "🧠", label: "Mind Engine", color: colors.mind },
  money: { icon: "💰", label: "Money Engine", color: colors.money },
  general: { icon: "⚙️", label: "General Engine", color: colors.general },
};

type ListItem =
  | { type: "header"; title: string; right: string }
  | { type: "task"; task: Task; completed: boolean }
  | { type: "add"; kind: "main" | "secondary" }
  | { type: "empty"; kind: "main" | "secondary" };

export default function EngineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const engine = id as EngineKey;
  const meta = ENGINE_META[engine] ?? ENGINE_META.general;
  const router = useRouter();

  // AppState listener for midnight crossing
  const [appActive, setAppActive] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setAppActive((c) => c + 1);
    });
    return () => sub.remove();
  }, []);

  const todayKey = useMemo(() => getTodayKey(), [appActive]);
  const [dateKey, setDateKey] = useState(getTodayKey());
  const lastLoadRef = useRef("");

  // Sync dateKey when todayKey changes (midnight crossing)
  useEffect(() => {
    setDateKey(todayKey);
  }, [todayKey]);

  const loadEngine = useEngineStore((s) => s.loadEngine);
  const toggleTask = useEngineStore((s) => s.toggleTask);
  const deleteTaskAction = useEngineStore((s) => s.deleteTask);
  const tasks = useEngineStore((s) => s.tasks[engine] ?? []);
  const allCompletions = useEngineStore((s) => s.completions);
  const allScores = useEngineStore((s) => s.scores);

  const completionIds = allCompletions[`${engine}:${dateKey}`] ?? [];
  const score = allScores[`${engine}:${dateKey}`] ?? 0;

  const awardXP = useProfileStore((s) => s.awardXP);
  const updateStreak = useProfileStore((s) => s.updateStreak);

  useEffect(() => {
    const key = `${engine}:${dateKey}`;
    if (lastLoadRef.current !== key) {
      lastLoadRef.current = key;
      loadEngine(engine, dateKey);
    }
  }, [engine, dateKey]);

  const completedIds = useMemo(() => new Set(completionIds), [completionIds]);

  const mainTasks = useMemo(() => tasks.filter((t) => t.kind === "main"), [tasks]);
  const sideTasks = useMemo(() => tasks.filter((t) => t.kind === "secondary"), [tasks]);
  const mainCompleted = useMemo(() => mainTasks.filter((t) => completedIds.has(t.id!)).length, [mainTasks, completedIds]);
  const sideCompleted = useMemo(() => sideTasks.filter((t) => completedIds.has(t.id!)).length, [sideTasks, completedIds]);

  const handleToggle = useCallback((task: Task) => {
    const completed = toggleTask(engine, task.id!, dateKey);
    const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
    if (completed) {
      awardXP(dateKey, "task_complete", xp);
      updateStreak(dateKey);
    } else {
      awardXP(dateKey, "task_uncomplete", -xp);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [engine, dateKey, toggleTask, awardXP, updateStreak]);

  const handleDelete = useCallback((task: Task) => {
    Alert.alert("Delete Mission", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => {
          deleteTaskAction(engine, task.id!);
          loadEngine(engine, dateKey);
        },
      },
    ]);
  }, [engine, dateKey]);

  const openAddModal = useCallback((kind: "main" | "secondary") => {
    router.push({
      pathname: "/(modals)/add-task",
      params: { engine, kind, dateKey },
    });
  }, [engine, dateKey]);

  // Build a flat list of items for FlashList
  const listData = useMemo((): ListItem[] => {
    const items: ListItem[] = [];

    items.push({ type: "header", title: "Missions", right: `${mainCompleted}/${mainTasks.length}` });
    if (mainTasks.length === 0) {
      items.push({ type: "empty", kind: "main" });
    } else {
      for (const t of mainTasks) {
        items.push({ type: "task", task: t, completed: completedIds.has(t.id!) });
      }
      items.push({ type: "add", kind: "main" });
    }

    items.push({ type: "header", title: "Side Quests", right: `${sideCompleted}/${sideTasks.length}` });
    if (sideTasks.length === 0) {
      items.push({ type: "empty", kind: "secondary" });
    } else {
      for (const t of sideTasks) {
        items.push({ type: "task", task: t, completed: completedIds.has(t.id!) });
      }
      items.push({ type: "add", kind: "secondary" });
    }

    return items;
  }, [mainTasks, sideTasks, completedIds, mainCompleted, sideCompleted]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    switch (item.type) {
      case "header":
        return <SectionHeader title={item.title} right={item.right} />;
      case "task":
        return (
          <MissionRow
            title={item.task.title}
            xp={item.task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST}
            completed={item.completed}
            kind={item.task.kind}
            onToggle={() => handleToggle(item.task)}
            onDelete={() => handleDelete(item.task)}
          />
        );
      case "empty":
        return (
          <Pressable onPress={() => openAddModal(item.kind)} style={styles.emptyAdd}>
            <Text style={styles.emptyAddText}>
              {item.kind === "main" ? "+ Add your first mission" : "+ Add a side quest"}
            </Text>
          </Pressable>
        );
      case "add":
        return (
          <Pressable onPress={() => openAddModal(item.kind)} style={styles.inlineAdd}>
            <Text style={styles.inlineAddText}>
              {item.kind === "main" ? "+ Add Mission" : "+ Add Side Quest"}
            </Text>
          </Pressable>
        );
    }
  }, [handleToggle, handleDelete, openAddModal]);

  // NOT memoized — DateNavigator needs fresh dateKey on every render
  const ListHeader = (
    <>
      <DateNavigator dateKey={dateKey} onChange={setDateKey} />
      <View style={styles.ringWrap}>
        <PowerRing score={score} size={160} strokeWidth={8} />
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: meta.color }]}>
            {meta.icon} {meta.label}
          </Text>
          <View style={{ width: 48 }} />
        </View>

        <FlashList
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item, index) =>
            item.type === "task" ? `task-${item.task.id}` : `${item.type}-${index}`
          }
          ListHeaderComponent={ListHeader}
          ListFooterComponent={<View style={{ height: 120 }} />}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          showsVerticalScrollIndicator={false}
        />

        <FAB onPress={() => openAddModal("main")} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  backBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  ringWrap: { alignItems: "center", marginVertical: spacing.xl },
  emptyAdd: { borderWidth: 1, borderColor: colors.surfaceBorder, borderStyle: "dashed", borderRadius: radius.md, paddingVertical: spacing.xl, alignItems: "center" },
  emptyAddText: { fontSize: 15, color: colors.primary, fontWeight: "600" },
  inlineAdd: { paddingVertical: spacing.sm, alignItems: "center", marginTop: spacing.xs },
  inlineAddText: { fontSize: 14, color: colors.primary, fontWeight: "600" },
});
