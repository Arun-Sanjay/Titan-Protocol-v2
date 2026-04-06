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
import { colors, spacing, radius, fonts, TOUCH_MIN } from "../../src/theme";
import { PowerRing } from "../../src/components/ui/PowerRing";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { DateNavigator } from "../../src/components/ui/DateNavigator";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { TitanProgress } from "../../src/components/ui/TitanProgress";
import { getTodayKey } from "../../src/lib/date";
import { getJSON, setJSON } from "../../src/db/storage";
import { useEngineStore } from "../../src/stores/useEngineStore";
import { useProfileStore, XP_REWARDS } from "../../src/stores/useProfileStore";
import { evaluateAllTrees } from "../../src/lib/skill-tree-evaluator";
import type { EngineKey, Task } from "../../src/db/schema";

// ─── Engine metadata ──────────────────────────────────────────────────────────

const ENGINE_META: Record<EngineKey, { icon: string; label: string; color: string; dimColor: string }> = {
  body:    { icon: "💪", label: "Body Engine",    color: colors.body,    dimColor: colors.bodyDim },
  mind:    { icon: "🧠", label: "Mind Engine",    color: colors.mind,    dimColor: colors.mindDim },
  money:   { icon: "💰", label: "Money Engine",   color: colors.money,   dimColor: colors.moneyDim },
  charisma: { icon: "🗣️", label: "Charisma Engine", color: colors.charisma, dimColor: colors.charismaDim },
};

// ─── Suggestions pool (engine-scoped) ────────────────────────────────────────

type Suggestion = { id: string; title: string; type: "mission" | "side_quest" };

const ALL_SUGGESTIONS: Record<EngineKey, Suggestion[]> = {
  body: [
    { id: "body_workout",  title: "Complete a workout session",  type: "mission" },
    { id: "body_sleep",    title: "Get 8 hours of sleep",        type: "mission" },
    { id: "body_walk",     title: "Walk 10,000 steps today",     type: "side_quest" },
    { id: "body_water",    title: "Drink 2L of water",           type: "side_quest" },
    { id: "body_stretch",  title: "Stretch for 15 minutes",      type: "side_quest" },
  ],
  mind: [
    { id: "mind_focus",    title: "Complete a focus session",    type: "mission" },
    { id: "mind_read",     title: "Read for 30 minutes",         type: "mission" },
    { id: "mind_meditate", title: "Meditate for 10 minutes",     type: "side_quest" },
    { id: "mind_journal",  title: "Write in your journal",       type: "side_quest" },
    { id: "mind_learn",    title: "Watch an educational video",  type: "side_quest" },
  ],
  money: [
    { id: "money_review",    title: "Review expenses and budget",       type: "mission" },
    { id: "money_deepwork",  title: "Complete a deep work session",     type: "mission" },
    { id: "money_save",      title: "Log your savings progress",        type: "side_quest" },
    { id: "money_invoice",   title: "Follow up on an invoice",          type: "side_quest" },
    { id: "money_research",  title: "Research one investment option",   type: "side_quest" },
  ],
  charisma: [
    { id: "charisma_plan",    title: "Start a conversation with someone new",       type: "mission" },
    { id: "charisma_tidy",    title: "Practice your elevator pitch",         type: "side_quest" },
    { id: "charisma_learn",   title: "Give a genuine compliment to a stranger",   type: "side_quest" },
    { id: "charisma_call",    title: "Record yourself speaking for 2 minutes",  type: "side_quest" },
    { id: "charisma_review",  title: "Lead or contribute to a group discussion", type: "mission" },
  ],
};

const DISMISSED_KEY = "dismissed_suggestions";

// ─── List item types ──────────────────────────────────────────────────────────

type ListItem =
  | { type: "date_nav" }
  | { type: "score_ring" }
  | { type: "header"; title: string; right: string }
  | { type: "task"; task: Task; completed: boolean }
  | { type: "add"; kind: "main" | "secondary" }
  | { type: "empty"; kind: "main" | "secondary" }
  | { type: "suggestion_header" }
  | { type: "suggestion"; suggestion: Suggestion };

// ─── SuggestionRow ────────────────────────────────────────────────────────────

const SuggestionRow = React.memo(function SuggestionRow({
  suggestion,
  engineColor,
  onAdd,
  onDismiss,
}: {
  suggestion: Suggestion;
  engineColor: string;
  onAdd: (s: Suggestion) => void;
  onDismiss: (id: string) => void;
}) {
  const xp = suggestion.type === "mission" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
  return (
    <View style={[sStyles.row, { borderLeftColor: engineColor }]}>
      <View style={sStyles.info}>
        <Text style={sStyles.title} numberOfLines={1}>{suggestion.title}</Text>
        <View style={sStyles.meta}>
          <Text style={sStyles.typeLabel}>
            {suggestion.type === "mission" ? "MISSION" : "SIDE QUEST"}
          </Text>
          <View style={sStyles.badge}>
            <Text style={sStyles.badgeText}>+{xp} XP</Text>
          </View>
        </View>
      </View>
      <Pressable style={sStyles.addBtn} onPress={() => onAdd(suggestion)} hitSlop={8}>
        <Text style={sStyles.addBtnText}>ADD</Text>
      </Pressable>
      <Pressable style={sStyles.dismissBtn} onPress={() => onDismiss(suggestion.id)} hitSlop={8}>
        <Text style={sStyles.dismissBtnText}>✕</Text>
      </Pressable>
    </View>
  );
});

const sStyles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.84)", borderRadius: radius.md,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", borderLeftWidth: 3,
    paddingHorizontal: 11, paddingVertical: 9, marginBottom: spacing.sm, gap: spacing.sm,
  },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: "500", color: colors.text },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  typeLabel: { ...fonts.kicker, fontSize: 9, color: colors.textMuted },
  badge: {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.sm,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 5, paddingVertical: 2,
  },
  badgeText: { ...fonts.mono, fontSize: 10, color: colors.textSecondary },
  addBtn: {
    backgroundColor: colors.accent, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    minWidth: 44, alignItems: "center",
  },
  addBtnText: { ...fonts.kicker, fontSize: 11, color: "#000", fontWeight: "700", letterSpacing: 1 },
  dismissBtn: { padding: spacing.xs, alignItems: "center", justifyContent: "center" },
  dismissBtnText: { ...fonts.mono, fontSize: 13, color: colors.textMuted },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function EngineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const engine = id as EngineKey;
  const meta = ENGINE_META[engine] ?? ENGINE_META.charisma;
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

  useEffect(() => { setDateKey(todayKey); }, [todayKey]);

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

  // ── Sorted task groups: incomplete first, completed at bottom ──────────────
  const mainTasks = useMemo(() => {
    const all = tasks.filter((t) => t.kind === "main");
    return [
      ...all.filter((t) => !completedIds.has(t.id!)),
      ...all.filter((t) => completedIds.has(t.id!)),
    ];
  }, [tasks, completedIds]);

  const sideTasks = useMemo(() => {
    const all = tasks.filter((t) => t.kind === "secondary");
    return [
      ...all.filter((t) => !completedIds.has(t.id!)),
      ...all.filter((t) => completedIds.has(t.id!)),
    ];
  }, [tasks, completedIds]);

  const totalTasks = tasks.length;
  const totalCompleted = completionIds.length;
  const mainCompleted = useMemo(
    () => mainTasks.filter((t) => completedIds.has(t.id!)).length,
    [mainTasks, completedIds]
  );
  const sideCompleted = useMemo(
    () => sideTasks.filter((t) => completedIds.has(t.id!)).length,
    [sideTasks, completedIds]
  );

  // ── Suggestions ────────────────────────────────────────────────────────────
  const [dismissed, setDismissed] = useState<Set<string>>(
    () => new Set(getJSON<string[]>(DISMISSED_KEY, []))
  );

  const suggestions = useMemo(() => {
    const existingTitles = new Set(tasks.map((t) => t.title.toLowerCase()));
    return (ALL_SUGGESTIONS[engine] ?? []).filter(
      (s) => !dismissed.has(s.id) && !existingTitles.has(s.title.toLowerCase())
    ).slice(0, 3);
  }, [tasks, dismissed, engine]);

  const handleDismissSuggestion = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set([...prev, id]);
      setJSON(DISMISSED_KEY, [...next]);
      return next;
    });
  }, []);

  const handleAddSuggestion = useCallback((s: Suggestion) => {
    // Phase 2.1B: addTask now recomputes scores for all loaded dates in
    // a single store update, so we don't need to call loadEngine() after.
    // Removing the extra call halves re-renders when accepting suggestions.
    useEngineStore.getState().addTask(
      engine, s.title,
      s.type === "mission" ? "main" : "secondary"
    );
    const xp = s.type === "mission" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
    awardXP(dateKey, "suggestion_accepted", xp);
    setDismissed((prev) => {
      const next = new Set([...prev, s.id]);
      setJSON(DISMISSED_KEY, [...next]);
      return next;
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [engine, dateKey, awardXP]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  // Phase 2.1C: callbacks keyed by taskId (not task object) so they have
  // stable references across re-renders and React.memo on MissionRow works.
  // Task lookup uses getState() to avoid polluting the dep array.
  const handleToggle = useCallback((taskId: number) => {
    const task = useEngineStore.getState().tasks[engine].find((t) => t.id === taskId);
    if (!task) return;
    const completed = toggleTask(engine, taskId, dateKey);
    const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
    if (completed) {
      awardXP(dateKey, "task_complete", xp);
      updateStreak(dateKey);
      evaluateAllTrees();
    } else {
      awardXP(dateKey, "task_uncomplete", -xp);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [engine, dateKey, toggleTask, awardXP, updateStreak]);

  const handleDelete = useCallback((taskId: number) => {
    const task = useEngineStore.getState().tasks[engine].find((t) => t.id === taskId);
    if (!task) return;
    Alert.alert("Delete Mission", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        // Phase 2.1B: deleteTask now updates scores in a single store
        // update — no loadEngine() follow-up needed.
        onPress: () => deleteTaskAction(engine, taskId),
      },
    ]);
  }, [engine]);

  const openAddModal = useCallback((kind: "main" | "secondary") => {
    router.push({
      pathname: "/(modals)/add-task",
      params: { engine, kind, dateKey },
    });
  }, [engine, dateKey]);

  // ── FlashList data ─────────────────────────────────────────────────────────
  const listData = useMemo((): ListItem[] => {
    const items: ListItem[] = [];

    items.push({ type: "date_nav" });
    items.push({ type: "score_ring" });

    // Missions
    items.push({ type: "header", title: "MISSIONS", right: `${mainCompleted}/${mainTasks.length}` });
    if (mainTasks.length === 0) {
      items.push({ type: "empty", kind: "main" });
    } else {
      for (const t of mainTasks) {
        items.push({ type: "task", task: t, completed: completedIds.has(t.id!) });
      }
    }
    items.push({ type: "add", kind: "main" });

    // Side Quests
    items.push({ type: "header", title: "SIDE QUESTS", right: `${sideCompleted}/${sideTasks.length}` });
    if (sideTasks.length === 0) {
      items.push({ type: "empty", kind: "secondary" });
    } else {
      for (const t of sideTasks) {
        items.push({ type: "task", task: t, completed: completedIds.has(t.id!) });
      }
    }
    items.push({ type: "add", kind: "secondary" });

    // Suggestions
    if (suggestions.length > 0) {
      items.push({ type: "suggestion_header" });
      for (const s of suggestions) {
        items.push({ type: "suggestion", suggestion: s });
      }
    }

    return items;
  }, [mainTasks, sideTasks, completedIds, mainCompleted, sideCompleted, suggestions]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    switch (item.type) {
      case "date_nav":
        return <DateNavigator dateKey={dateKey} onChange={setDateKey} />;

      case "score_ring":
        return (
          <View style={styles.ringWrap}>
            <PowerRing score={score} size={160} strokeWidth={8} />
            <Text style={styles.scoreLabel}>{score.toFixed(0)}%</Text>
            <Text style={styles.tasksLabel}>
              {totalCompleted} of {totalTasks} completed today
            </Text>
            <TitanProgress value={score} color={meta.color} height={6} />
          </View>
        );

      case "header":
        return <SectionHeader title={item.title} right={item.right} />;

      case "task":
        return (
          <MissionRow
            taskId={item.task.id!}
            title={item.task.title}
            xp={item.task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST}
            completed={item.completed}
            kind={item.task.kind}
            engine={engine}
            onToggle={handleToggle}
            onDelete={handleDelete}
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
            <Ionicons
              name="add-circle-outline"
              size={16}
              color={meta.color}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.inlineAddText, { color: meta.color }]}>
              {item.kind === "main" ? "Add Mission" : "Add Side Quest"}
            </Text>
          </Pressable>
        );

      case "suggestion_header":
        return <SectionHeader title="SUGGESTED" />;

      case "suggestion":
        return (
          <SuggestionRow
            suggestion={item.suggestion}
            engineColor={meta.color}
            onAdd={handleAddSuggestion}
            onDismiss={handleDismissSuggestion}
          />
        );
    }
  }, [
    dateKey, score, totalCompleted, totalTasks, meta.color, engine,
    handleToggle, handleDelete, openAddModal, handleAddSuggestion, handleDismissSuggestion,
  ]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

        {/* ── Fixed header ── */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerIcon]}>{meta.icon}</Text>
            <Text style={[styles.headerTitle, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
          </View>
          <View style={{ width: 48 }} />
        </View>

        {/* ── Pinned add buttons — always visible ── */}
        <View style={[styles.addBar, { borderBottomColor: meta.color + "20" }]}>
          <Pressable
            style={[styles.addBtn, { borderColor: meta.color + "50", backgroundColor: meta.color + "10" }]}
            onPress={() => openAddModal("main")}
          >
            <Ionicons name="add" size={16} color={meta.color} />
            <Text style={[styles.addBtnText, { color: meta.color }]}>ADD MISSION</Text>
          </Pressable>
          <Pressable
            style={[styles.addBtn, { borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.04)" }]}
            onPress={() => openAddModal("secondary")}
          >
            <Ionicons name="add" size={16} color={colors.textSecondary} />
            <Text style={[styles.addBtnText, { color: colors.textSecondary }]}>ADD SIDE QUEST</Text>
          </Pressable>
        </View>

        <FlashList
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item, index) =>
            item.type === "task" ? `task-${item.task.id}` :
            item.type === "suggestion" ? `sugg-${item.suggestion.id}` :
            `${item.type}-${index}`
          }
          ListFooterComponent={<View style={{ height: 60 }} />}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          showsVerticalScrollIndicator={false}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerIcon: { fontSize: 20 },
  headerTitle: { ...fonts.kicker, fontSize: 14, letterSpacing: 2 },

  // Pinned add bar
  addBar: {
    flexDirection: "row", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  addBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10,
    borderRadius: radius.md, borderWidth: 1,
    minHeight: TOUCH_MIN,
  },
  addBtnText: { ...fonts.kicker, fontSize: 10, letterSpacing: 1 },

  // Score ring section
  ringWrap: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  scoreLabel: {
    ...fonts.monoValue,
    fontSize: 32,
    color: colors.text,
    marginTop: spacing.sm,
  },
  tasksLabel: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
  },

  // Task add inline
  emptyAdd: {
    borderWidth: 1, borderColor: colors.surfaceBorder, borderStyle: "dashed",
    borderRadius: radius.md, paddingVertical: spacing.xl, alignItems: "center",
    marginBottom: spacing.sm,
  },
  emptyAddText: { fontSize: 15, color: colors.primary, fontWeight: "600" },
  inlineAdd: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: spacing.sm, marginBottom: spacing.md,
  },
  inlineAddText: { fontSize: 14, fontWeight: "600" },
});
