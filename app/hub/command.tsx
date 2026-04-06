import React, { useEffect, useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SectionList,
  ScrollView,
  AppState,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, Easing } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, fonts, shadows } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { PageHeader } from "../../src/components/ui/PageHeader";
import { MetricValue } from "../../src/components/ui/MetricValue";
import { ScoreGauge } from "../../src/components/ui/ScoreGauge";
import { getTodayKey } from "../../src/lib/date";
import {
  useEngineStore,
  ENGINES,
  selectTotalScore,
  selectAllTasksForDate,
  type TaskWithStatus,
} from "../../src/stores/useEngineStore";
import { useProfileStore, XP_REWARDS } from "../../src/stores/useProfileStore";
import type { EngineKey } from "../../src/db/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const ENGINE_META: Record<EngineKey, { label: string; color: string; dimColor: string }> = {
  body: { label: "BODY", color: colors.body, dimColor: colors.bodyDim },
  mind: { label: "MIND", color: colors.mind, dimColor: colors.mindDim },
  money: { label: "MONEY", color: colors.money, dimColor: colors.moneyDim },
  charisma: { label: "CHARISMA", color: colors.charisma, dimColor: colors.charismaDim },
};

type FilterKey = "all" | EngineKey;

const FILTER_OPTIONS: { key: FilterKey; label: string; color: string }[] = [
  { key: "all", label: "All", color: colors.text },
  { key: "body", label: "Body", color: colors.body },
  { key: "mind", label: "Mind", color: colors.mind },
  { key: "money", label: "Money", color: colors.money },
  { key: "charisma", label: "Charisma", color: colors.charisma },
];

// ─── Filter Chip ──────────────────────────────────────────────────────────────

const FilterChip = React.memo(function FilterChip({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[
        styles.chip,
        active && { backgroundColor: color + "20", borderColor: color + "40" },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? color : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

// ─── Task Row ─────────────────────────────────────────────────────────────────

const TaskRow = React.memo(function TaskRow({
  task,
  onToggle,
}: {
  task: TaskWithStatus;
  onToggle: () => void;
}) {
  const meta = ENGINE_META[task.engine];
  const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onToggle();
      }}
      style={[styles.taskRow, task.completed && styles.taskRowDone]}
    >
      {/* Engine color dot */}
      <View style={[styles.dot, { backgroundColor: meta.color }]} />

      {/* Checkbox */}
      <View style={[styles.checkbox, task.completed && { borderColor: colors.success, backgroundColor: colors.success }]}>
        {task.completed && <View style={styles.checkInner} />}
      </View>

      {/* Task info */}
      <View style={styles.taskContent}>
        <Text
          style={[styles.taskTitle, task.completed && styles.taskTitleDone]}
          numberOfLines={1}
        >
          {task.title}
        </Text>
      </View>

      {/* Engine badge */}
      <View style={[styles.engineBadge, { backgroundColor: meta.dimColor, borderColor: meta.color + "30" }]}>
        <Text style={[styles.engineBadgeText, { color: meta.color }]}>
          {meta.label}
        </Text>
      </View>

      {/* XP value */}
      <View style={[styles.xpBadge, task.completed && styles.xpBadgeDone]}>
        <Text style={[styles.xpText, task.completed && styles.xpTextDone]}>
          {task.completed ? "\u2713" : `${xp} XP`}
        </Text>
      </View>
    </Pressable>
  );
});

// ─── Section Header ───────────────────────────────────────────────────────────

const EngineSectionHeader = React.memo(function EngineSectionHeader({
  engine,
  count,
  completedCount,
}: {
  engine: EngineKey;
  count: number;
  completedCount: number;
}) {
  const meta = ENGINE_META[engine];
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <View style={[styles.sectionDot, { backgroundColor: meta.color }]} />
        <Text style={[styles.sectionTitle, { color: meta.color }]}>
          {meta.label}
        </Text>
      </View>
      <Text style={styles.sectionCount}>
        {completedCount}/{count}
      </Text>
    </View>
  );
});

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = React.memo(function StatCard({
  label,
  value,
  delay,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  delay: number;
  color?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Panel delay={delay} style={styles.statCard}>
      {icon && <Ionicons name={icon} size={16} color={color ?? colors.textSecondary} />}
      <MetricValue label={label} value={value} size="sm" color={color} animated={typeof value === "number"} />
    </Panel>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CommandCentreScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");

  // AppState refresh for midnight crossing
  const [appActive, setAppActive] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setAppActive((c) => c + 1);
    });
    return () => sub.remove();
  }, []);
  const dateKey = useMemo(() => getTodayKey(), [appActive]);

  // Engine store
  const loadAllEngines = useEngineStore((s) => s.loadAllEngines);
  const toggleTask = useEngineStore((s) => s.toggleTask);
  const storeTasks = useEngineStore((s) => s.tasks);
  const storeCompletions = useEngineStore((s) => s.completions);
  const scores = useEngineStore((s) => s.scores);

  // Profile store
  const awardXP = useProfileStore((s) => s.awardXP);
  const updateStreak = useProfileStore((s) => s.updateStreak);
  const streak = useProfileStore((s) => s.profile.streak);

  useEffect(() => {
    loadAllEngines(dateKey);
  }, [dateKey]);

  // All tasks with status
  const allTasks = useMemo(
    () => selectAllTasksForDate(storeTasks, storeCompletions, dateKey),
    [storeTasks, storeCompletions, dateKey],
  );

  // Total score
  const totalScore = useMemo(
    () => selectTotalScore(scores, dateKey),
    [scores, dateKey],
  );

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    if (filter === "all") return allTasks;
    return allTasks.filter((t) => t.engine === filter);
  }, [allTasks, filter]);

  // Group by engine for SectionList
  const sections = useMemo(() => {
    const engineOrder: EngineKey[] = filter === "all"
      ? ENGINES
      : [filter as EngineKey];

    return engineOrder
      .map((engine) => {
        const data = filteredTasks.filter((t) => t.engine === engine);
        return { engine, data };
      })
      .filter((s) => s.data.length > 0);
  }, [filteredTasks, filter]);

  // Stats
  const completedCount = useMemo(() => allTasks.filter((t) => t.completed).length, [allTasks]);
  const totalTasks = allTasks.length;

  // Toggle handler — award XP on complete, deduct on un-complete
  const handleToggle = useCallback(
    (task: TaskWithStatus) => {
      const completed = toggleTask(task.engine, task.id!, dateKey);
      const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
      if (completed) {
        awardXP(dateKey, "task_complete", xp);
        updateStreak(dateKey);
      } else {
        // Deduct XP on un-complete to prevent farming
        awardXP(dateKey, "task_uncomplete", -xp);
      }
    },
    [dateKey, toggleTask, awardXP, updateStreak],
  );

  // SectionList renderers
  const renderItem = useCallback(
    ({ item }: { item: TaskWithStatus }) => (
      <TaskRow task={item} onToggle={() => handleToggle(item)} />
    ),
    [handleToggle],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { engine: EngineKey; data: TaskWithStatus[] } }) => {
      const completed = section.data.filter((t) => t.completed).length;
      return (
        <EngineSectionHeader
          engine={section.engine}
          count={section.data.length}
          completedCount={completed}
        />
      );
    },
    [],
  );

  const keyExtractor = useCallback(
    (item: TaskWithStatus) => `${item.engine}:${item.id}`,
    [],
  );

  // Header component
  const ListHeader = useMemo(
    () => (
      <>
        {/* Back + Title */}
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        </View>

        <PageHeader
          kicker="ALL ENGINES"
          title="Command Centre"
          subtitle="Every task. One view."
        />

        {/* Score Gauge */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(500).easing(Easing.out(Easing.cubic))}
          style={styles.gaugeWrap}
        >
          <ScoreGauge score={totalScore} size={160} label="TITAN SCORE" />
        </Animated.View>

        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <StatCard label="Total" value={totalTasks} delay={150} icon="list" color={colors.charisma} />
          <StatCard label="Done" value={completedCount} delay={200} icon="checkmark-done" color={colors.body} />
          <StatCard label="Score" value={`${totalScore}%`} delay={250} icon="analytics" color={colors.mind} />
          <StatCard label="Streak" value={streak} delay={300} icon="flame" color={colors.warning} />
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          {FILTER_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.key}
              label={opt.label}
              color={opt.color}
              active={filter === opt.key}
              onPress={() => setFilter(opt.key)}
            />
          ))}
        </ScrollView>

        {/* Empty state */}
        {sections.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tasks yet</Text>
            <Text style={styles.emptySubtext}>
              Add tasks from each engine to see them here
            </Text>
          </View>
        )}
      </>
    ),
    [totalScore, totalTasks, completedCount, streak, filter, sections.length, router],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={<View style={{ height: 120 }} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
  },

  // Navigation
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  backBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  // Gauge
  gaugeWrap: {
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },

  // Stats row
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },

  // Filter chips
  chipScroll: {
    marginBottom: spacing.lg,
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    ...fonts.kicker,
    fontSize: 11,
  },
  sectionCount: {
    ...fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
  },

  // Task row
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.84)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 11,
    paddingVertical: 10,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadows.card,
  },
  taskRowDone: {
    borderColor: colors.success + "20",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkInner: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  taskTitleDone: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  engineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  engineBadgeText: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
  },
  xpBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    minWidth: 44,
    alignItems: "center",
  },
  xpBadgeDone: {
    backgroundColor: colors.successDim,
    borderColor: colors.success + "15",
  },
  xpText: {
    ...fonts.mono,
    fontSize: 10,
    color: colors.textSecondary,
  },
  xpTextDone: {
    color: colors.success,
  },

  // Empty state
  empty: {
    alignItems: "center",
    paddingVertical: spacing["4xl"],
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 6,
  },
});
