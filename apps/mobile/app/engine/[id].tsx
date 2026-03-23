import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { colors, spacing, radius, TOUCH_MIN } from "../../src/theme";
import { PowerRing } from "../../src/components/ui/PowerRing";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { DateNavigator } from "../../src/components/ui/DateNavigator";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { FAB } from "../../src/components/ui/FAB";
import { getTodayKey } from "../../src/lib/date";
import {
  listTasks,
  getCompletedIds,
  toggleTask,
  computeScore,
  addTask,
  deleteTask,
  updateTaskKind,
} from "../../src/db/engine";
import { awardXP, updateStreak, XP_REWARDS } from "../../src/db/gamification";
import { getDailyRank } from "../../src/db/gamification";
import type { EngineKey, Task } from "../../src/db/schema";

const ENGINE_META: Record<EngineKey, { icon: string; label: string; color: string }> = {
  body: { icon: "⚡", label: "Body Engine", color: colors.body },
  mind: { icon: "🧠", label: "Mind Engine", color: colors.mind },
  money: { icon: "💰", label: "Money Engine", color: colors.money },
  general: { icon: "⚙️", label: "General Engine", color: colors.general },
};

export default function EngineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const engine = id as EngineKey;
  const meta = ENGINE_META[engine] ?? ENGINE_META.general;
  const router = useRouter();

  const [dateKey, setDateKey] = useState(getTodayKey());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const [score, setScore] = useState(0);

  // Add task state
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<"main" | "secondary">("main");
  const bottomSheetRef = useRef<BottomSheet>(null);

  const loadData = useCallback(async () => {
    const [t, c] = await Promise.all([
      listTasks(engine),
      getCompletedIds(engine, dateKey),
    ]);
    setTasks(t);
    setCompletedIds(c);
    setScore(computeScore(t, c));
  }, [engine, dateKey]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const mainTasks = tasks.filter((t) => t.kind === "main");
  const sideTasks = tasks.filter((t) => t.kind === "secondary");
  const mainCompleted = mainTasks.filter((t) => completedIds.has(t.id!)).length;
  const sideCompleted = sideTasks.filter((t) => completedIds.has(t.id!)).length;

  const handleToggle = async (task: Task) => {
    const completed = await toggleTask(engine, task.id!, dateKey);
    if (completed) {
      const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
      await awardXP(dateKey, "task_complete", xp);
      await updateStreak(dateKey);
    }
    await loadData();
  };

  const handleDelete = (task: Task) => {
    Alert.alert("Delete Mission", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTask(task.id!);
          await loadData();
        },
      },
    ]);
  };

  const handleMoveKind = async (task: Task) => {
    const newKind = task.kind === "main" ? "secondary" : "main";
    await updateTaskKind(task.id!, newKind);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadData();
  };

  const openAddSheet = (kind: "main" | "secondary") => {
    setNewKind(kind);
    setNewTitle("");
    bottomSheetRef.current?.expand();
  };

  const handleAddTask = async () => {
    if (!newTitle.trim()) return;
    await addTask(engine, newTitle.trim(), newKind);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewTitle("");
    bottomSheetRef.current?.close();
    await loadData();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: meta.color }]}>
            {meta.icon} {meta.label}
          </Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Date Nav */}
          <DateNavigator dateKey={dateKey} onChange={setDateKey} />

          {/* Power Ring */}
          <View style={styles.ringWrap}>
            <PowerRing score={score} size={160} strokeWidth={8} />
          </View>

          {/* Main Missions */}
          <SectionHeader
            title="Missions"
            right={`${mainCompleted}/${mainTasks.length}`}
          />

          {mainTasks.length === 0 ? (
            <Pressable onPress={() => openAddSheet("main")} style={styles.emptyAdd}>
              <Text style={styles.emptyAddText}>+ Add your first mission</Text>
            </Pressable>
          ) : (
            mainTasks.map((task) => (
              <MissionRow
                key={task.id}
                title={task.title}
                xp={XP_REWARDS.MAIN_TASK}
                completed={completedIds.has(task.id!)}
                kind="main"
                onToggle={() => handleToggle(task)}
                onDelete={() => handleDelete(task)}
              />
            ))
          )}

          {mainTasks.length > 0 && (
            <Pressable onPress={() => openAddSheet("main")} style={styles.inlineAdd}>
              <Text style={styles.inlineAddText}>+ Add Mission</Text>
            </Pressable>
          )}

          {/* Side Quests */}
          <SectionHeader
            title="Side Quests"
            right={`${sideCompleted}/${sideTasks.length}`}
          />

          {sideTasks.length === 0 ? (
            <Pressable onPress={() => openAddSheet("secondary")} style={styles.emptyAdd}>
              <Text style={styles.emptyAddText}>+ Add a side quest</Text>
            </Pressable>
          ) : (
            sideTasks.map((task) => (
              <MissionRow
                key={task.id}
                title={task.title}
                xp={XP_REWARDS.SIDE_QUEST}
                completed={completedIds.has(task.id!)}
                kind="secondary"
                onToggle={() => handleToggle(task)}
                onDelete={() => handleDelete(task)}
              />
            ))
          )}

          {sideTasks.length > 0 && (
            <Pressable onPress={() => openAddSheet("secondary")} style={styles.inlineAdd}>
              <Text style={styles.inlineAddText}>+ Add Side Quest</Text>
            </Pressable>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* FAB */}
        <FAB onPress={() => openAddSheet("main")} />

        {/* Add Task Bottom Sheet */}
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={[280]}
          enablePanDownToClose
          backgroundStyle={styles.sheetBg}
          handleIndicatorStyle={styles.sheetHandle}
        >
          <BottomSheetView style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {newKind === "main" ? "New Mission" : "New Side Quest"}
            </Text>

            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder={newKind === "main" ? "e.g. Workout" : "e.g. Walk 10k steps"}
              placeholderTextColor={colors.textSecondary}
              style={styles.sheetInput}
              autoFocus
              onSubmitEditing={handleAddTask}
            />

            {/* Kind toggle */}
            <View style={styles.kindToggle}>
              <Pressable
                onPress={() => setNewKind("main")}
                style={[styles.kindBtn, newKind === "main" && styles.kindBtnActive]}
              >
                <Text style={[styles.kindBtnText, newKind === "main" && styles.kindBtnTextActive]}>
                  Mission (+{XP_REWARDS.MAIN_TASK} XP)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setNewKind("secondary")}
                style={[styles.kindBtn, newKind === "secondary" && styles.kindBtnActive]}
              >
                <Text style={[styles.kindBtnText, newKind === "secondary" && styles.kindBtnTextActive]}>
                  Side Quest (+{XP_REWARDS.SIDE_QUEST} XP)
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={handleAddTask} style={styles.sheetSubmit}>
              <Text style={styles.sheetSubmitText}>Add</Text>
            </Pressable>
          </BottomSheetView>
        </BottomSheet>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 24,
    color: colors.text,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  ringWrap: {
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  emptyAdd: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderStyle: "dashed",
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  emptyAddText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: "600",
  },
  inlineAdd: {
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  inlineAddText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },

  // Bottom Sheet
  sheetBg: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetHandle: {
    backgroundColor: colors.textMuted,
    width: 40,
  },
  sheet: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  sheetInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  kindToggle: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  kindBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  kindBtnActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary + "50",
  },
  kindBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  kindBtnTextActive: {
    color: colors.primary,
  },
  sheetSubmit: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  sheetSubmitText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 16,
  },
});
