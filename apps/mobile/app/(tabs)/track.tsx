import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, TOUCH_MIN, fonts, shadows } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { PageHeader } from "../../src/components/ui/PageHeader";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { HabitGrid } from "../../src/components/ui/HabitGrid";
import { ProgressRing } from "../../src/components/ui/ProgressRing";
import { getTodayKey } from "../../src/lib/date";
import { useHabitStore } from "../../src/stores/useHabitStore";
import { useJournalStore } from "../../src/stores/useJournalStore";
import { useGoalStore } from "../../src/stores/useGoalStore";
import { useProfileStore, XP_REWARDS } from "../../src/stores/useProfileStore";
import type { Habit, Goal } from "../../src/db/schema";
import { getJSON } from "../../src/db/storage";

type Tab = "habits" | "journal" | "goals";

export default function TrackScreen() {
  const [tab, setTab] = useState<Tab>("habits");
  const dateKey = getTodayKey();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HUDBackground />
      <View style={styles.header}>
        <PageHeader kicker="TRACK" title="Track" />
        <View style={styles.tabs}>
          {(["habits", "journal", "goals"] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => { Haptics.selectionAsync(); setTab(t); }}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === "habits" && <HabitsTab dateKey={dateKey} />}
      {tab === "journal" && <JournalTab dateKey={dateKey} />}
      {tab === "goals" && <GoalsTab dateKey={dateKey} />}
    </SafeAreaView>
  );
}

// ─── Habits Tab ────────────────────────────────────────────────────────────

function HabitsTab({ dateKey }: { dateKey: string }) {
  const habits = useHabitStore((s) => s.habits);
  const completedIds = useHabitStore((s) => s.completedIds[dateKey] ?? []);
  const load = useHabitStore((s) => s.load);
  const toggle = useHabitStore((s) => s.toggleHabit);
  const add = useHabitStore((s) => s.addHabit);
  const remove = useHabitStore((s) => s.deleteHabit);
  const awardXP = useProfileStore((s) => s.awardXP);

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => { load(dateKey); }, [dateKey]);

  const completedSet = useMemo(() => new Set(completedIds), [completedIds]);

  // Compute streaks per habit
  const habitStreaks = useMemo(() => {
    const streaks: Record<number, number> = {};
    for (const h of habits) {
      let streak = 0;
      for (let i = 0; i < 90; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const logs = getJSON<number[]>(`habit_logs:${dk}`, []);
        if (logs.includes(h.id!)) {
          streak++;
        } else if (i > 0) {
          break;
        }
      }
      streaks[h.id!] = streak;
    }
    return streaks;
  }, [habits, completedIds]);

  // Build 12-week grid for each habit
  const habitGrids = useMemo(() => {
    const grids: Record<number, { dateKey: string; completed: boolean }[]> = {};
    for (const h of habits) {
      const cells: { dateKey: string; completed: boolean }[] = [];
      for (let i = 83; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const logs = getJSON<number[]>(`habit_logs:${dk}`, []);
        cells.push({ dateKey: dk, completed: logs.includes(h.id!) });
      }
      grids[h.id!] = cells;
    }
    return grids;
  }, [habits, completedIds]);

  // Quick stats
  const todayCount = completedSet.size;
  const totalHabits = habits.length;
  const bestStreak = useMemo(() => Math.max(0, ...Object.values(habitStreaks)), [habitStreaks]);

  const handleToggle = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const completed = toggle(id, dateKey);
    if (completed) awardXP(dateKey, "habit_complete", XP_REWARDS.HABIT_COMPLETE);
  };

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    add(newTitle.trim(), "✓");
    setNewTitle("");
    setShowAdd(false);
  };

  const handleDelete = (id: number) => {
    Alert.alert("Delete Habit", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove(id) },
    ]);
  };

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Quick stats */}
      <View style={styles.statsRow}>
        <Panel style={styles.statCard}>
          <Text style={styles.statValue}>{todayCount}/{totalHabits}</Text>
          <Text style={styles.statLabel}>TODAY</Text>
        </Panel>
        <Panel style={styles.statCard}>
          <Text style={styles.statValue}>{totalHabits > 0 ? Math.round((todayCount / totalHabits) * 100) : 0}%</Text>
          <Text style={styles.statLabel}>RATE</Text>
        </Panel>
        <Panel style={styles.statCard}>
          <Text style={styles.statValue}>{bestStreak}</Text>
          <Text style={styles.statLabel}>BEST STREAK</Text>
        </Panel>
      </View>

      {/* Habit cards */}
      {habits.map((h) => {
        const done = completedSet.has(h.id!);
        const streak = habitStreaks[h.id!] ?? 0;
        return (
          <Panel key={h.id} style={styles.habitCard}>
            <Pressable
              onPress={() => handleToggle(h.id!)}
              onLongPress={() => handleDelete(h.id!)}
              style={styles.habitHeader}
            >
              <View style={[styles.habitCheck, done && styles.habitCheckDone]}>
                {done && <Text style={styles.habitCheckmark}>✓</Text>}
              </View>
              <View style={styles.habitInfo}>
                <Text style={[styles.habitTitle, done && styles.habitTitleDone]}>
                  {h.icon} {h.title}
                </Text>
                <View style={styles.habitMeta}>
                  <Text style={styles.habitEngine}>{h.engine.toUpperCase()}</Text>
                  {streak > 0 && <Text style={styles.habitStreak}>🔥 {streak}</Text>}
                </View>
              </View>
            </Pressable>
            {/* 12-week grid */}
            <View style={styles.habitGridWrap}>
              <HabitGrid logs={habitGrids[h.id!] ?? []} weeks={12} />
            </View>
          </Panel>
        );
      })}

      {/* Add habit */}
      {showAdd ? (
        <View style={styles.addRow}>
          <TextInput
            value={newTitle} onChangeText={setNewTitle} placeholder="Habit name..."
            placeholderTextColor={colors.textMuted} style={styles.addInput}
            autoFocus onSubmitEditing={handleAdd}
          />
          <Pressable onPress={handleAdd} style={styles.addBtn}>
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setShowAdd(true)} style={styles.newBtn}>
          <Text style={styles.newBtnText}>+ New Habit</Text>
        </Pressable>
      )}

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

// ─── Journal Tab ───────────────────────────────────────────────────────────

function JournalTab({ dateKey }: { dateKey: string }) {
  const entry = useJournalStore((s) => s.entries[dateKey]);
  const loadEntry = useJournalStore((s) => s.loadEntry);
  const saveEntry = useJournalStore((s) => s.saveEntry);
  const awardXP = useProfileStore((s) => s.awardXP);

  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadEntry(dateKey); }, [dateKey]);
  useEffect(() => { setContent(entry?.content ?? ""); }, [entry]);

  const handleSave = () => {
    saveEntry(dateKey, content);
    awardXP(dateKey, "journal_entry", XP_REWARDS.JOURNAL_ENTRY);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <SectionHeader title="TODAY'S JOURNAL" />
      <Panel>
        <TextInput
          value={content} onChangeText={setContent} placeholder="Write your thoughts..."
          placeholderTextColor={colors.textMuted} style={styles.journalInput}
          multiline textAlignVertical="top"
        />
      </Panel>
      <Pressable onPress={handleSave} style={styles.saveBtn}>
        <Text style={styles.saveBtnText}>{saved ? "✓ Saved" : "Save Entry"}</Text>
      </Pressable>
      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

// ─── Goals Tab ─────────────────────────────────────────────────────────────

function GoalsTab({ dateKey }: { dateKey: string }) {
  const goals = useGoalStore((s) => s.goals);
  const goalTasks = useGoalStore((s) => s.goalTasks);
  const load = useGoalStore((s) => s.load);
  const loadGoalTasks = useGoalStore((s) => s.loadGoalTasks);
  const addGoal = useGoalStore((s) => s.addGoal);
  const deleteGoal = useGoalStore((s) => s.deleteGoal);
  const addGoalTask = useGoalStore((s) => s.addGoalTask);
  const toggleGoalTask = useGoalStore((s) => s.toggleGoalTask);

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [addingTaskFor, setAddingTaskFor] = useState<number | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    for (const g of goals) {
      loadGoalTasks(g.id!);
    }
  }, [goals]);

  const handleAddGoal = () => {
    if (!newTitle.trim()) return;
    addGoal({
      title: newTitle.trim(),
      engine: "general",
      type: "count",
      target: 1,
      unit: "tasks",
      deadline: newDeadline || (() => { const dd = new Date(Date.now() + 30 * 86400000); return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`; })(),
    });
    setNewTitle("");
    setNewDeadline("");
    setShowAdd(false);
  };

  const handleAddTask = (goalId: number) => {
    if (!newTaskTitle.trim()) return;
    addGoalTask(goalId, newTaskTitle.trim());
    setNewTaskTitle("");
    setAddingTaskFor(null);
  };

  const handleDeleteGoal = (id: number) => {
    Alert.alert("Delete Goal", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteGoal(id) },
    ]);
  };

  const getDaysRemaining = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now();
    const days = Math.ceil(diff / 86400000);
    if (days < 0) return "Expired";
    if (days === 0) return "Today";
    return `${days}d left`;
  };

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <SectionHeader title="ACTIVE GOALS" right={`${goals.length}`} />

      {goals.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyText}>No goals yet</Text>
          <Text style={styles.emptyHint}>Set your first goal to start tracking</Text>
        </View>
      ) : (
        goals.map((g) => {
          const tasks = goalTasks[g.id!] ?? [];
          const completedCount = tasks.filter((t) => t.completed === 1).length;
          const progress = tasks.length > 0 ? completedCount / tasks.length : 0;
          const daysLeft = getDaysRemaining(g.deadline);

          return (
            <Panel key={g.id} style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <ProgressRing
                  progress={progress}
                  label={tasks.length > 0 ? `${completedCount}/${tasks.length}` : "0"}
                  size={56}
                  strokeWidth={4}
                />
                <View style={styles.goalInfo}>
                  <Text style={styles.goalTitle}>{g.title}</Text>
                  <View style={styles.goalMeta}>
                    <Text style={styles.goalEngine}>{g.engine.toUpperCase()}</Text>
                    <Text style={[
                      styles.goalDeadline,
                      daysLeft === "Expired" && { color: colors.danger },
                    ]}>
                      {daysLeft}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => handleDeleteGoal(g.id!)} hitSlop={12}>
                  <Text style={styles.deleteBtn}>×</Text>
                </Pressable>
              </View>

              {/* Sub-tasks */}
              {tasks.length > 0 && (
                <View style={styles.goalTasks}>
                  {tasks.map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toggleGoalTask(t.id!, g.id!);
                      }}
                      style={styles.goalTaskRow}
                    >
                      <View style={[styles.goalTaskCheck, t.completed === 1 && styles.goalTaskCheckDone]}>
                        {t.completed === 1 && <Text style={styles.goalTaskCheckmark}>✓</Text>}
                      </View>
                      <Text style={[styles.goalTaskTitle, t.completed === 1 && styles.goalTaskTitleDone]}>
                        {t.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Add task inline */}
              {addingTaskFor === g.id ? (
                <View style={styles.addRow}>
                  <TextInput
                    value={newTaskTitle} onChangeText={setNewTaskTitle}
                    placeholder="Task name..." placeholderTextColor={colors.textMuted}
                    style={styles.addInput} autoFocus
                    onSubmitEditing={() => handleAddTask(g.id!)}
                  />
                  <Pressable onPress={() => handleAddTask(g.id!)} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>Add</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setAddingTaskFor(g.id!)} style={styles.inlineAdd}>
                  <Text style={styles.inlineAddText}>+ Add Task</Text>
                </Pressable>
              )}
            </Panel>
          );
        })
      )}

      {/* Add goal */}
      {showAdd ? (
        <Panel style={styles.addGoalPanel}>
          <Text style={styles.addGoalTitle}>New Goal</Text>
          <TextInput
            value={newTitle} onChangeText={setNewTitle}
            placeholder="Goal title..." placeholderTextColor={colors.textMuted}
            style={styles.addInput} autoFocus
          />
          <TextInput
            value={newDeadline} onChangeText={setNewDeadline}
            placeholder="Deadline (YYYY-MM-DD)" placeholderTextColor={colors.textMuted}
            style={styles.addInput}
          />
          <View style={styles.addGoalActions}>
            <Pressable onPress={() => setShowAdd(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleAddGoal} style={styles.addBtn}>
              <Text style={styles.addBtnText}>Create</Text>
            </Pressable>
          </View>
        </Panel>
      ) : (
        <Pressable onPress={() => setShowAdd(true)} style={styles.newBtn}>
          <Text style={styles.newBtnText}>+ New Goal</Text>
        </Pressable>
      )}

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg },
  tabs: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: "center" },
  tabActive: { backgroundColor: "rgba(255, 255, 255, 0.08)" },
  tabText: { ...fonts.kicker, fontSize: 11, color: colors.textMuted },
  tabTextActive: { color: colors.text },
  tabContent: { flex: 1, paddingHorizontal: spacing.lg },

  // Stats row
  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  statCard: { flex: 1, alignItems: "center", paddingVertical: spacing.md },
  statValue: { ...fonts.monoValue, fontSize: 20 },
  statLabel: { ...fonts.kicker, fontSize: 8, color: colors.textMuted, marginTop: 2 },

  // Habit card
  habitCard: { marginTop: spacing.md },
  habitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  habitCheck: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center", justifyContent: "center",
  },
  habitCheckDone: { borderColor: colors.success, backgroundColor: colors.successDim },
  habitCheckmark: { fontSize: 13, fontWeight: "700", color: colors.success },
  habitInfo: { flex: 1 },
  habitTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  habitTitleDone: { color: colors.textMuted, textDecorationLine: "line-through" },
  habitMeta: { flexDirection: "row", gap: spacing.sm, marginTop: 2 },
  habitEngine: { ...fonts.kicker, fontSize: 8, color: colors.textMuted },
  habitStreak: { ...fonts.mono, fontSize: 10, color: colors.warning },
  habitGridWrap: { marginTop: spacing.md },

  // Journal
  journalInput: { color: colors.text, fontSize: 16, lineHeight: 26, minHeight: 200 },
  saveBtn: {
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  saveBtnText: { color: "#000", fontWeight: "700", fontSize: 16 },

  // Goals
  goalCard: { marginTop: spacing.md },
  goalHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  goalInfo: { flex: 1 },
  goalTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  goalMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  goalEngine: { ...fonts.kicker, fontSize: 9, color: colors.textMuted },
  goalDeadline: { ...fonts.mono, fontSize: 11, color: colors.textSecondary },
  deleteBtn: { fontSize: 24, color: colors.textMuted, fontWeight: "300" },

  // Goal sub-tasks
  goalTasks: { marginTop: spacing.md, gap: spacing.sm },
  goalTaskRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  goalTaskCheck: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: "rgba(255, 255, 255, 0.20)",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center", justifyContent: "center",
  },
  goalTaskCheckDone: { borderColor: colors.success, backgroundColor: colors.success },
  goalTaskCheckmark: { fontSize: 11, fontWeight: "700", color: "#fff" },
  goalTaskTitle: { fontSize: 14, color: colors.text },
  goalTaskTitleDone: { color: colors.textMuted, textDecorationLine: "line-through" },

  // Shared form elements
  addRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  addInput: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.panelBorder,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, fontSize: 14,
  },
  addBtn: { backgroundColor: colors.text, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: "center" },
  addBtnText: { color: "#000", fontWeight: "700", fontSize: 13 },
  newBtn: {
    alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.04)", borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.panelBorder,
  },
  newBtnText: { color: colors.textSecondary, fontWeight: "600", fontSize: 14 },
  inlineAdd: { paddingVertical: spacing.sm, alignItems: "center", marginTop: spacing.sm },
  inlineAddText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },

  // Add goal form
  addGoalPanel: { marginTop: spacing.md, gap: spacing.md },
  addGoalTitle: { ...fonts.kicker, color: colors.textSecondary },
  addGoalActions: { flexDirection: "row", gap: spacing.sm },
  cancelBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: "center", borderWidth: 1, borderColor: colors.panelBorder },
  cancelBtnText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: spacing["4xl"] },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 18, fontWeight: "600", color: colors.text },
  emptyHint: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
});
