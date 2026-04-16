import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
  AppState,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { MetricValue } from "../../src/components/ui/MetricValue";
import { type DeepWorkCategory } from "../../src/lib/deep-work-helpers";
import {
  useDeepWorkSessions,
  useCreateDeepWorkSession,
  useDeleteDeepWorkSession,
  useDeepWorkTasks,
  useCreateDeepWorkTask,
  useDeleteDeepWorkTask,
  useDeepWorkLogs,
  useUpsertDeepWorkLog,
} from "../../src/hooks/queries/useDeepWork";
import type { DeepWorkSession } from "../../src/services/deep-work";

// UI-facing task shape (cloud rows are adapted to this).
type DeepWorkTask = {
  id: string;
  taskName: string;
  category: DeepWorkCategory;
  createdAt: string;
};

type DeepWorkLog = {
  id: string;
  taskId: string;
  dateKey: string;
  completed: boolean;
  earningsToday: number;
};
import { getTodayKey, toLocalDateKey, addDays } from "../../src/lib/date";
import { formatCurrency } from "../../src/lib/format";

const CATEGORIES: DeepWorkCategory[] = [
  "Main Job / College",
  "Side Hustle",
  "Freelance",
  "Investments",
  "Other",
];

const CATEGORY_SHORT: Record<DeepWorkCategory, string> = {
  "Main Job / College": "Main Job",
  "Side Hustle": "Side Hustle",
  Freelance: "Freelance",
  Investments: "Investments",
  Other: "Other",
};

const CATEGORY_COLORS: Record<DeepWorkCategory, string> = {
  "Main Job / College": colors.mind,
  "Side Hustle": colors.body,
  Freelance: colors.charisma,
  Investments: colors.money,
  Other: colors.textSecondary,
};

const CATEGORY_DIM_COLORS: Record<DeepWorkCategory, string> = {
  "Main Job / College": colors.mindDim,
  "Side Hustle": colors.bodyDim,
  Freelance: colors.charismaDim,
  Investments: colors.moneyDim,
  Other: "rgba(255, 255, 255, 0.06)",
};

// ─── Task Row ───────────────────────────────────────────────────────────────

type TaskRowProps = {
  task: DeepWorkTask;
  completed: boolean;
  earnings: number;
  onToggle: (completed: boolean) => void;
  onEarningsChange: (earnings: number) => void;
  onDelete: () => void;
};

const TaskRow = React.memo(function TaskRow({
  task,
  completed,
  earnings,
  onToggle,
  onEarningsChange,
  onDelete,
}: TaskRowProps) {
  const [earningsStr, setEarningsStr] = useState(
    earnings > 0 ? earnings.toString() : ""
  );
  const isFocusedRef = useRef(false);
  const catColor = CATEGORY_COLORS[task.category];
  const catDimColor = CATEGORY_DIM_COLORS[task.category];

  const handleEarningsBlur = useCallback(() => {
    isFocusedRef.current = false;
    const val = Math.max(0, parseFloat(earningsStr) || 0); // clamp negative to 0
    onEarningsChange(val);
  }, [earningsStr, onEarningsChange]);

  // Sync external earnings changes (skip while input is focused to avoid flicker)
  useEffect(() => {
    if (!isFocusedRef.current) setEarningsStr(earnings > 0 ? earnings.toString() : "");
  }, [earnings]);

  return (
    <Panel style={styles.taskCard}>
      <View style={styles.taskTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.taskName}>{task.taskName}</Text>
          <View style={[styles.categoryBadge, { backgroundColor: catDimColor }]}>
            <Text style={[styles.categoryBadgeText, { color: catColor }]}>
              {CATEGORY_SHORT[task.category]}
            </Text>
          </View>
        </View>
        <View style={styles.taskActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onDelete();
            }}
            hitSlop={8}
            style={styles.taskDeleteBtn}
          >
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
          </Pressable>
        </View>
      </View>

      <View style={styles.taskBottomRow}>
        <View style={styles.toggleRow}>
          <Switch
            value={completed}
            onValueChange={(val) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggle(val);
            }}
            trackColor={{ false: colors.inputBg, true: colors.bodyDim }}
            thumbColor={completed ? colors.body : colors.textMuted}
            ios_backgroundColor={colors.inputBg}
          />
          <Text
            style={[
              styles.toggleLabel,
              completed && { color: colors.body },
            ]}
          >
            {completed ? "Done" : "Pending"}
          </Text>
        </View>

        <View style={styles.earningsInputWrap}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            style={styles.earningsInput}
            value={earningsStr}
            onChangeText={setEarningsStr}
            onFocus={() => { isFocusedRef.current = true; }}
            onBlur={handleEarningsBlur}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            selectTextOnFocus
          />
        </View>
      </View>
    </Panel>
  );
});

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function DeepWorkScreen() {
  const router = useRouter();

  const { data: cloudTasks = [] } = useDeepWorkTasks();
  const { data: cloudLogs = [] } = useDeepWorkLogs();
  const createTaskMutation = useCreateDeepWorkTask();
  const deleteTaskMutation = useDeleteDeepWorkTask();
  const upsertLogMutation = useUpsertDeepWorkLog();

  const tasks: DeepWorkTask[] = useMemo(
    () =>
      cloudTasks.map((t) => ({
        id: t.id,
        taskName: t.task_name,
        category: t.category as DeepWorkCategory,
        createdAt: t.created_at,
      })),
    [cloudTasks],
  );
  const logs: DeepWorkLog[] = useMemo(
    () =>
      cloudLogs.map((l) => ({
        id: l.id,
        taskId: l.task_id,
        dateKey: l.date_key,
        completed: l.completed,
        earningsToday: l.earnings_today,
      })),
    [cloudLogs],
  );

  const addTask = useCallback(
    (taskName: string, category: DeepWorkCategory) => {
      createTaskMutation.mutate({ task_name: taskName, category });
    },
    [createTaskMutation],
  );
  const deleteTask = useCallback(
    (id: string) => {
      deleteTaskMutation.mutate(id);
    },
    [deleteTaskMutation],
  );
  const logWork = useCallback(
    (taskId: string, dateKey: string, completed: boolean, earnings: number) => {
      const safeEarnings = Number.isFinite(earnings) ? Math.max(0, earnings) : 0;
      upsertLogMutation.mutate({
        task_id: taskId,
        date_key: dateKey,
        completed,
        earnings_today: safeEarnings,
      });
    },
    [upsertLogMutation],
  );
  const getLogsByDate = useCallback((dk: string) => logs.filter((l) => l.dateKey === dk), [logs]);
  const getWeeklyEarnings = useCallback(
    (endDate: string) => {
      const end = new Date(endDate + "T00:00:00");
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return logs
        .filter((l) => {
          const d = new Date(l.dateKey + "T00:00:00");
          return d >= start && d <= end;
        })
        .reduce((sum, l) => sum + l.earningsToday, 0);
    },
    [logs],
  );

  // Cloud hooks for sessions
  const { data: cloudSessions = [] } = useDeepWorkSessions();
  const createSessionMut = useCreateDeepWorkSession();

  // AppState listener to refresh todayKey past midnight
  const [appActive, setAppActive] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setAppActive((c) => c + 1);
    });
    return () => sub.remove();
  }, []);
  const todayKey = useMemo(() => getTodayKey(), [appActive]);

  // Add task form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newCategory, setNewCategory] = useState<DeepWorkCategory>("Main Job / College");

  // Phase 4.1: no load() needed — useState initializer reads MMKV.

  // Today's logs (local MMKV)
  const todayLogs = useMemo(() => getLogsByDate(todayKey), [logs, todayKey, getLogsByDate]);

  // Today's total earnings
  const todayEarnings = useMemo(
    () => todayLogs.reduce((sum, l) => sum + l.earningsToday, 0),
    [todayLogs]
  );

  // Category breakdown for today
  const categoryBreakdown = useMemo(() => {
    const map: Partial<Record<DeepWorkCategory, number>> = {};
    for (const log of todayLogs) {
      const task = tasks.find((t) => t.id === log.taskId);
      if (task) {
        map[task.category] = (map[task.category] ?? 0) + log.earningsToday;
      }
    }
    return map;
  }, [todayLogs, tasks]);

  // Weekly stats
  const weeklyEarnings = useMemo(
    () => getWeeklyEarnings(todayKey),
    [logs, todayKey, getWeeklyEarnings]
  );

  // Count days with ANY log entry (earnings > 0 OR completed), not just completed
  const weeklyDaysWorked = useMemo(() => {
    const startKey = addDays(todayKey, -6);
    const daysSet = new Set(
      logs
        .filter((l) => l.dateKey >= startKey && l.dateKey <= todayKey && (l.completed || l.earningsToday > 0))
        .map((l) => l.dateKey)
    );
    return daysSet.size;
  }, [logs, todayKey]);

  const weeklyAvg = weeklyDaysWorked > 0 ? weeklyEarnings / weeklyDaysWorked : 0;

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleAddTask = useCallback(() => {
    const name = newTaskName.trim();
    if (!name) {
      Alert.alert("Error", "Enter a task name.");
      return;
    }
    addTask(name, newCategory);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewTaskName("");
    setNewCategory("Main Job / College");
    setShowAddForm(false);
  }, [newTaskName, newCategory, addTask]);

  const handleDeleteTask = useCallback(
    (id: string) => {
      Alert.alert("Delete Task", "This will also remove all logs for this task.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteTask(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]);
    },
    [deleteTask]
  );

  const handleToggle = useCallback(
    (taskId: string, completed: boolean, currentEarnings: number) => {
      logWork(taskId, todayKey, completed, currentEarnings);
      // Also create a cloud session when marking as completed
      if (completed) {
        const task = tasks.find((t) => t.id === taskId);
        if (task) {
          createSessionMut.mutate({
            date_key: todayKey,
            task_name: task.taskName,
            category: task.category,
            minutes: 0, // duration not tracked in legacy model
          });
        }
      }
    },
    [logWork, todayKey, tasks, createSessionMut]
  );

  const handleEarningsChange = useCallback(
    (taskId: string, earnings: number, currentCompleted: boolean) => {
      logWork(taskId, todayKey, currentCompleted, earnings);
    },
    [logWork, todayKey]
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Deep Work</Text>
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Today's Earnings Hero ──────────────────────────────── */}
          <Panel style={styles.heroPanel} glowColor={colors.money} tone="hero" delay={0}>
            <Text style={styles.heroKicker}>TODAY'S EARNINGS</Text>
            <Text style={styles.heroValue}>{formatCurrency(todayEarnings)}</Text>

            {/* Category breakdown with stacked bar */}
            {Object.keys(categoryBreakdown).length > 0 && todayEarnings > 0 && (
              <>
                <View style={styles.stackedBarTrack}>
                  {(Object.entries(categoryBreakdown) as [DeepWorkCategory, number][]).map(
                    ([cat, amount]) => {
                      const pct = (amount / todayEarnings) * 100;
                      return (
                        <View
                          key={cat}
                          style={[
                            styles.stackedBarSegment,
                            {
                              width: `${pct}%`,
                              backgroundColor: CATEGORY_COLORS[cat],
                            },
                          ]}
                        />
                      );
                    }
                  )}
                </View>
                <View style={styles.breakdownRow}>
                  {(Object.entries(categoryBreakdown) as [DeepWorkCategory, number][]).map(
                    ([cat, amount]) => (
                      <View key={cat} style={styles.breakdownItem}>
                        <View
                          style={[
                            styles.breakdownDot,
                            { backgroundColor: CATEGORY_COLORS[cat] },
                          ]}
                        />
                        <Text style={styles.breakdownLabel}>
                          {CATEGORY_SHORT[cat]}
                        </Text>
                        <Text style={styles.breakdownAmount}>
                          {formatCurrency(amount)}
                        </Text>
                      </View>
                    )
                  )}
                </View>
              </>
            )}
          </Panel>

          {/* ── Task List ──────────────────────────────────────────── */}
          <SectionHeader
            title="Tasks"
            right={`${tasks.length} total`}
          />

          {tasks.length === 0 && !showAddForm && (
            <Panel style={styles.emptyPanel}>
              <Ionicons
                name="code-working-outline"
                size={32}
                color={colors.textMuted}
              />
              <Text style={styles.emptyText}>No tasks yet</Text>
              <Text style={styles.emptySubtext}>
                Add deep work tasks to track productivity
              </Text>
            </Panel>
          )}

          {tasks.map((task) => {
            const log = todayLogs.find((l) => l.taskId === task.id);
            const completed = log?.completed ?? false;
            const earnings = log?.earningsToday ?? 0;

            return (
              <TaskRow
                key={task.id}
                task={task}
                completed={completed}
                earnings={earnings}
                onToggle={(val) => handleToggle(task.id, val, earnings)}
                onEarningsChange={(val) =>
                  handleEarningsChange(task.id, val, completed)
                }
                onDelete={() => handleDeleteTask(task.id)}
              />
            );
          })}

          {/* ── Add Task ───────────────────────────────────────────── */}
          {!showAddForm ? (
            <Pressable
              style={styles.addTaskBtn}
              onPress={() => {
                setShowAddForm(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.money} />
              <Text style={styles.addTaskBtnText}>Add Task</Text>
            </Pressable>
          ) : (
            <Panel style={styles.formPanel} delay={50}>
              <Text style={styles.formTitle}>New Task</Text>

              <TextInput
                style={styles.input}
                placeholder="Task name"
                placeholderTextColor={colors.textMuted}
                value={newTaskName}
                onChangeText={setNewTaskName}
                autoFocus
              />

              <Text style={styles.chipLabel}>Category</Text>
              <View style={styles.chipGrid}>
                {CATEGORIES.map((cat) => {
                  const active = newCategory === cat;
                  const catColor = CATEGORY_COLORS[cat];
                  const catDim = CATEGORY_DIM_COLORS[cat];
                  return (
                    <Pressable
                      key={cat}
                      style={[
                        styles.categoryChip,
                        active && { backgroundColor: catDim, borderColor: catColor },
                      ]}
                      onPress={() => {
                        setNewCategory(cat);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          active && { color: catColor },
                        ]}
                      >
                        {CATEGORY_SHORT[cat]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.formActions}>
                <Pressable
                  style={styles.formCancelBtn}
                  onPress={() => {
                    setShowAddForm(false);
                    setNewTaskName("");
                  }}
                >
                  <Text style={styles.formCancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.formSaveBtn} onPress={handleAddTask}>
                  <Text style={styles.formSaveBtnText}>Add Task</Text>
                </Pressable>
              </View>
            </Panel>
          )}

          {/* ── Weekly Summary ─────────────────────────────────────── */}
          <SectionHeader title="This Week" />

          <View style={styles.weeklyStatsRow}>
            <Panel style={styles.weeklyStatCard} delay={100}>
              <Ionicons name="cash-outline" size={18} color={colors.money} />
              <MetricValue
                label="Weekly Total"
                value={formatCurrency(weeklyEarnings)}
                size="sm"
                color={colors.money}
              />
            </Panel>
            <Panel style={styles.weeklyStatCard} delay={150}>
              <Ionicons name="calendar-outline" size={18} color={colors.charisma} />
              <MetricValue
                label="Days Worked"
                value={weeklyDaysWorked}
                size="sm"
                color={colors.charisma}
                animated
              />
            </Panel>
            <Panel style={styles.weeklyStatCard} delay={200}>
              <Ionicons name="trending-up" size={18} color={colors.mind} />
              <MetricValue
                label="Daily Avg"
                value={formatCurrency(weeklyAvg)}
                size="sm"
                color={colors.mind}
              />
            </Panel>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // Header
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
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },

  // Body
  body: { flex: 1, paddingHorizontal: spacing.lg },
  bodyContent: { paddingBottom: spacing["5xl"] },

  // Hero card
  heroPanel: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
    marginTop: spacing.lg,
  },
  heroKicker: {
    ...fonts.kicker,
    color: colors.money,
    marginBottom: spacing.sm,
  },
  heroValue: {
    ...fonts.monoValue,
    fontSize: 40,
    color: colors.money,
  },
  stackedBarTrack: {
    flexDirection: "row",
    height: 8,
    borderRadius: radius.full,
    overflow: "hidden",
    marginTop: spacing.lg,
    width: "100%",
  },
  stackedBarSegment: {
    height: 8,
  },
  breakdownRow: {
    marginTop: spacing.md,
    width: "100%",
  },
  breakdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  breakdownLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  breakdownAmount: {
    ...fonts.mono,
    fontSize: 13,
    color: colors.text,
  },

  // Task cards
  taskCard: { marginBottom: spacing.sm },
  taskTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  taskName: { fontSize: 16, fontWeight: "700", color: colors.text },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  taskActions: { flexDirection: "row", alignItems: "center" },
  taskDeleteBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  taskBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  toggleLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  earningsInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  dollarSign: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.money,
    marginRight: 2,
  },
  earningsInput: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "monospace",
    color: colors.text,
    paddingVertical: 6,
    minWidth: 60,
    textAlign: "right",
  },

  // Empty panel
  emptyPanel: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
    gap: spacing.sm,
  },
  emptyText: { fontSize: 15, fontWeight: "600", color: colors.textSecondary },
  emptySubtext: { fontSize: 13, color: colors.textMuted },

  // Add task button
  addTaskBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
  addTaskBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.money,
  },

  // Form
  formPanel: { marginTop: spacing.sm },
  formTitle: { ...fonts.heading, marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  chipLabel: {
    ...fonts.kicker,
    color: colors.textMuted,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  categoryChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  formActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing["2xl"],
  },
  formCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  formCancelBtnText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  formSaveBtn: {
    flex: 1,
    backgroundColor: colors.money,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  formSaveBtnText: { fontSize: 14, fontWeight: "700", color: "#000" },

  // Weekly summary
  weeklyStatsRow: { flexDirection: "row", gap: spacing.md },
  weeklyStatCard: { flex: 1, alignItems: "center", gap: spacing.xs },
});
