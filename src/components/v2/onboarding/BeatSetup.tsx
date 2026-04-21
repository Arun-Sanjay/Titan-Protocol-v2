import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Dimensions,
} from "react-native";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius, shadows } from "../../../theme";
import { tasksKeys } from "../../../hooks/queries/useTasks";
import { habitsKeys } from "../../../hooks/queries/useHabits";
import { useQueryClient } from "@tanstack/react-query";
import { logError } from "../../../lib/error-log";
import { Panel } from "../../ui/Panel";
import { requireUserId } from "../../../lib/supabase";
import { sqliteUpsertMany, newId } from "../../../db/sqlite/service-helpers";
import type { Tables } from "../../../types/supabase";
// Phase 3.6: dual-write removed — operation engine now reads from
// Supabase via cloud hooks. MMKV mirror no longer needed.
import type { EngineKey } from "../../../db/schema";

// -- Types ------------------------------------------------------------------

type Props = {
  archetype: string;
  engines: string[];
  onComplete: () => void;
};

type Tab = "tasks" | "habits";

type TaskItem = {
  title: string;
  kind: "main" | "secondary";
  checked: boolean;
  engine: EngineKey;
};

type HabitItem = {
  title: string;
  icon: string;
  engine: string;
  checked: boolean;
};

// -- Engine color map -------------------------------------------------------

const ENGINE_COLORS: Record<string, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  charisma: colors.charisma,
};

const ENGINE_ICONS: Record<string, string> = {
  body: "\uD83D\uDCAA",
  mind: "\uD83E\udDE0",
  money: "\uD83D\uDCB0",
  charisma: "\u2728",
};

// -- Suggested tasks per archetype ------------------------------------------

const SUGGESTED_TASKS: Record<
  string,
  Record<string, { main: string[]; secondary: string[] }>
> = {
  default: {
    body: {
      main: ["Complete a workout", "10,000 steps"],
      secondary: ["Stretch (10 min)"],
    },
    mind: {
      main: ["Deep work \u2014 60 min", "Read 30 min"],
      secondary: ["Meditate (10 min)"],
    },
    money: {
      main: ["Track expenses", "Work on side project"],
      secondary: ["Review budget"],
    },
    charisma: {
      main: ["Call a friend/family", "Practice a pitch"],
      secondary: ["Compliment 3 people"],
    },
  },
};

// -- Suggested habits -------------------------------------------------------

const DEFAULT_HABITS: HabitItem[] = [
  { title: "Morning exercise", icon: "\ud83c\udfc3", engine: "body", checked: false },
  { title: "Drink 2L water", icon: "\ud83d\udca7", engine: "body", checked: false },
  { title: "Read before bed", icon: "\ud83d\udcd6", engine: "mind", checked: false },
  { title: "Meditate", icon: "\ud83e\uddd8", engine: "mind", checked: false },
  { title: "No impulse spending", icon: "\ud83d\udcb0", engine: "money", checked: false },
  { title: "Reach out to someone", icon: "\ud83d\ude0a", engine: "charisma", checked: false },
];

// -- Helpers ----------------------------------------------------------------

function buildInitialTasks(
  archetype: string,
  engines: string[],
): TaskItem[] {
  const taskMap =
    SUGGESTED_TASKS[archetype] ?? SUGGESTED_TASKS.default;
  const items: TaskItem[] = [];

  for (const eng of engines) {
    const suggestions = taskMap[eng] ?? SUGGESTED_TASKS.default[eng];
    if (!suggestions) continue;

    for (const title of suggestions.main) {
      items.push({ title, kind: "main", checked: false, engine: eng as EngineKey });
    }
    for (const title of suggestions.secondary) {
      items.push({ title, kind: "secondary", checked: false, engine: eng as EngineKey });
    }
  }

  return items;
}

function hasMinOneMainPerEngine(
  tasks: TaskItem[],
  engines: string[],
): boolean {
  for (const eng of engines) {
    const hasMain = tasks.some(
      (t) => t.engine === eng && t.kind === "main" && t.checked,
    );
    if (!hasMain) return false;
  }
  return true;
}

// -- Animated task row with toggle pulse ------------------------------------

function AnimatedTaskRow({
  task,
  onToggle,
}: {
  task: TaskItem & { globalIndex: number };
  onToggle: (index: number) => void;
}) {
  const scale = useSharedValue(1);
  const engineColor = ENGINE_COLORS[task.engine] ?? colors.textSecondary;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    if (!task.checked) {
      scale.value = withSequence(
        withTiming(1.03, { duration: 100, easing: Easing.out(Easing.cubic) }),
        withTiming(1.0, { duration: 150, easing: Easing.inOut(Easing.cubic) }),
      );
    }
    onToggle(task.globalIndex);
  }, [task.checked, task.globalIndex, onToggle]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={[
          styles.taskRow,
          { borderLeftColor: task.checked ? engineColor : "rgba(255,255,255,0.06)" },
        ]}
        onPress={handlePress}
      >
        <View
          style={[
            styles.checkbox,
            task.checked && [styles.checkboxChecked, { backgroundColor: engineColor, borderColor: engineColor }],
          ]}
        >
          {task.checked && <Text style={styles.checkmark}>{"\u2713"}</Text>}
        </View>
        <Text
          style={[
            styles.taskTitle,
            !task.checked && styles.taskTitleUnchecked,
          ]}
          numberOfLines={1}
        >
          {task.title}
        </Text>
        <View
          style={[
            styles.kindBadge,
            task.kind === "main"
              ? styles.kindBadgeMain
              : styles.kindBadgeSide,
          ]}
        >
          <Text
            style={[
              styles.kindBadgeText,
              task.kind === "main"
                ? styles.kindBadgeTextMain
                : styles.kindBadgeTextSide,
            ]}
          >
            {task.kind === "main" ? "MISSION" : "SIDE"}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// -- Animated habit row with toggle pulse -----------------------------------

function AnimatedHabitRow({
  habit,
  index,
  onToggle,
}: {
  habit: HabitItem;
  index: number;
  onToggle: (index: number) => void;
}) {
  const scale = useSharedValue(1);
  const engineColor = ENGINE_COLORS[habit.engine] ?? colors.textSecondary;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    if (!habit.checked) {
      scale.value = withSequence(
        withTiming(1.03, { duration: 100, easing: Easing.out(Easing.cubic) }),
        withTiming(1.0, { duration: 150, easing: Easing.inOut(Easing.cubic) }),
      );
    }
    onToggle(index);
  }, [habit.checked, index, onToggle]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={[
          styles.taskRow,
          {
            borderLeftColor: habit.checked ? engineColor : "rgba(255,255,255,0.06)",
          },
        ]}
        onPress={handlePress}
      >
        <View
          style={[
            styles.checkbox,
            habit.checked && [styles.checkboxChecked, { backgroundColor: engineColor, borderColor: engineColor }],
          ]}
        >
          {habit.checked && (
            <Text style={styles.checkmark}>{"\u2713"}</Text>
          )}
        </View>
        <Text style={styles.habitIcon}>{habit.icon}</Text>
        <Text
          style={[
            styles.taskTitle,
            !habit.checked && styles.taskTitleUnchecked,
          ]}
          numberOfLines={1}
        >
          {habit.title}
        </Text>
        <View style={[styles.engineBadge, { backgroundColor: engineColor + "18" }]}>
          <Text style={[styles.engineBadgeText, { color: engineColor }]}>
            {habit.engine.toUpperCase()}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// -- Component --------------------------------------------------------------

export function BeatSetup({ archetype, engines, onComplete }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("tasks");
  const [tasks, setTasks] = useState<TaskItem[]>(() =>
    buildInitialTasks(archetype, engines),
  );
  const [habits, setHabits] = useState<HabitItem[]>(() => [...DEFAULT_HABITS]);
  const [addingTaskFor, setAddingTaskFor] = useState<string | null>(null);
  const [customTaskText, setCustomTaskText] = useState("");
  const [addingHabit, setAddingHabit] = useState(false);
  const [customHabitText, setCustomHabitText] = useState("");

  // -- Task toggles ---------------------------------------------------------

  const toggleTask = useCallback(
    (index: number) => {
      setTasks((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], checked: !next[index].checked };
        return next;
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [],
  );

  const addCustomTask = useCallback(
    (engine: string) => {
      const title = customTaskText.trim();
      if (!title) return;
      setTasks((prev) => [
        ...prev,
        {
          title,
          kind: "secondary" as const,
          checked: true,
          engine: engine as EngineKey,
        },
      ]);
      setCustomTaskText("");
      setAddingTaskFor(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [customTaskText],
  );

  // -- Habit toggles --------------------------------------------------------

  const toggleHabit = useCallback((index: number) => {
    setHabits((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], checked: !next[index].checked };
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const addCustomHabit = useCallback(() => {
    const title = customHabitText.trim();
    if (!title) return;
    setHabits((prev) => [
      ...prev,
      { title, icon: "\u2b50", engine: "all", checked: true },
    ]);
    setCustomHabitText("");
    setAddingHabit(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [customHabitText]);

  // -- Cloud persistence -----------------------------------------------------

  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // -- Confirm --------------------------------------------------------------

  const handleConfirm = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const doSave = async () => {
      const userId = await requireUserId();

      const checkedTasks = tasks.filter((t) => t.checked);
      const checkedHabits = habits.filter((h) => h.checked);

      if (checkedTasks.length > 0) {
        const taskRows: Tables<"tasks">[] = checkedTasks.map((t) => ({
          id: newId(),
          user_id: userId,
          engine: t.engine,
          title: t.title,
          kind: t.kind,
          days_per_week: 7,
          is_active: true,
          legacy_local_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        await sqliteUpsertMany("tasks", taskRows);
      }

      if (checkedHabits.length > 0) {
        const fallbackEngine = engines[0] ?? "body";
        const habitRows: Tables<"habits">[] = checkedHabits.map((h) => ({
          id: newId(),
          user_id: userId,
          title: h.title,
          icon: h.icon,
          engine: h.engine === "all" ? fallbackEngine : h.engine,
          current_chain: 0,
          best_chain: 0,
          frequency: null,
          trigger_text: null,
          duration_text: null,
          last_broken_date: null,
          legacy_local_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        await sqliteUpsertMany("habits", habitRows);
      }
    };

    // Race against a 10s timeout, one retry. On final failure, block
    // the user here with an error+retry UI — silently advancing meant
    // users landed on an empty dashboard with no idea what went wrong.
    let lastError: unknown = null;
    let saved = false;
    for (let attempt = 0; attempt < 2 && !saved; attempt++) {
      try {
        await Promise.race([
          doSave(),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error("Setup save timed out")), 10_000),
          ),
        ]);
        saved = true;
      } catch (e) {
        lastError = e;
        logError(`BeatSetup.confirm.attempt${attempt}`, e);
      }
    }

    if (!saved) {
      setSaving(false);
      const message =
        lastError instanceof Error ? lastError.message : "Something went wrong";
      setSaveError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    queryClient.invalidateQueries({ queryKey: tasksKeys.all });
    queryClient.invalidateQueries({ queryKey: habitsKeys.all });

    onComplete();
  }, [tasks, habits, onComplete, saving, queryClient, engines]);

  const canConfirm = hasMinOneMainPerEngine(tasks, engines);

  // Task count per engine
  const engineTaskCounts = (engine: string) => {
    const engineTasks = tasks.filter((t) => t.engine === engine);
    const checked = engineTasks.filter((t) => t.checked).length;
    return { checked, total: engineTasks.length };
  };

  // -- Render: Task section for a single engine -----------------------------

  const renderEngineSection = (engine: string, sectionIndex: number) => {
    const engineTasks = tasks
      .map((t, i) => ({ ...t, globalIndex: i }))
      .filter((t) => t.engine === engine);

    const engineColor = ENGINE_COLORS[engine] ?? colors.textSecondary;
    const engineIcon = ENGINE_ICONS[engine] ?? "";
    const counts = engineTaskCounts(engine);

    return (
      <Animated.View
        key={engine}
        entering={FadeInDown.delay(100 + sectionIndex * 100).duration(400)}
        style={styles.engineSectionWrap}
      >
        <Panel
          glowColor={engineColor}
          style={styles.enginePanel}
        >
          {/* Engine section header */}
          <View style={styles.engineHeader}>
            <Text style={styles.engineHeaderIcon}>{engineIcon}</Text>
            <Text
              style={[styles.engineHeaderLabel, { color: engineColor }]}
            >
              {engine.toUpperCase()}
            </Text>
            <Text style={styles.engineHeaderCount}>
              {counts.checked}/{counts.total}
            </Text>
          </View>

          {/* Task rows */}
          {engineTasks.map((task) => (
            <AnimatedTaskRow
              key={`${engine}-${task.globalIndex}`}
              task={task}
              onToggle={toggleTask}
            />
          ))}

          {/* Add custom task */}
          {addingTaskFor === engine ? (
            <View style={styles.addInputRow}>
              <TextInput
                style={styles.addInput}
                placeholder="Task name..."
                placeholderTextColor={colors.textMuted}
                value={customTaskText}
                onChangeText={setCustomTaskText}
                onSubmitEditing={() => addCustomTask(engine)}
                autoFocus
                returnKeyType="done"
              />
              <Pressable
                style={[styles.addInputConfirm, { borderColor: engineColor + "40" }]}
                onPress={() => addCustomTask(engine)}
              >
                <Text style={[styles.addInputConfirmText, { color: engineColor }]}>+</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.addLink}
              onPress={() => {
                setAddingTaskFor(engine);
                setCustomTaskText("");
              }}
            >
              <Text style={[styles.addLinkText, { color: engineColor + "80" }]}>
                + Add custom task
              </Text>
            </Pressable>
          )}
        </Panel>
      </Animated.View>
    );
  };

  // -- Render: Habits -------------------------------------------------------

  const renderHabits = () => (
    <Animated.View
      entering={FadeInDown.delay(100).duration(400)}
    >
      <Panel style={styles.habitsPanel}>
        <View style={styles.habitsPanelHeader}>
          <Text style={styles.habitsPanelTitle}>DAILY HABITS</Text>
          <Text style={styles.habitsPanelCount}>
            {habits.filter((h) => h.checked).length} selected
          </Text>
        </View>

        {habits.map((habit, index) => (
          <AnimatedHabitRow
            key={`habit-${index}`}
            habit={habit}
            index={index}
            onToggle={toggleHabit}
          />
        ))}

        {/* Add custom habit */}
        {addingHabit ? (
          <View style={styles.addInputRow}>
            <TextInput
              style={styles.addInput}
              placeholder="Habit name..."
              placeholderTextColor={colors.textMuted}
              value={customHabitText}
              onChangeText={setCustomHabitText}
              onSubmitEditing={addCustomHabit}
              autoFocus
              returnKeyType="done"
            />
            <Pressable style={styles.addInputConfirm} onPress={addCustomHabit}>
              <Text style={styles.addInputConfirmText}>+</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.addLink}
            onPress={() => {
              setAddingHabit(true);
              setCustomHabitText("");
            }}
          >
            <Text style={styles.addLinkText}>+ Add habit</Text>
          </Pressable>
        )}
      </Panel>
    </Animated.View>
  );

  // -- Main render ----------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(0).duration(400)}
        style={styles.headerWrap}
      >
        <Text style={styles.kicker}>CONFIGURE</Text>
        <Text style={styles.headerTitle}>BUILD YOUR PROTOCOL</Text>
        <Text style={styles.headerSubtitle}>
          Select the tasks and habits you want to track daily
        </Text>
      </Animated.View>

      {/* Tab bar */}
      <Animated.View
        entering={FadeInDown.delay(50).duration(400)}
        style={styles.tabBar}
      >
        <Pressable
          style={[styles.tab, activeTab === "tasks" && styles.tabActive]}
          onPress={() => setActiveTab("tasks")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "tasks" && styles.tabTextActive,
            ]}
          >
            TASKS
          </Text>
          {activeTab === "tasks" && <View style={styles.tabIndicator} />}
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "habits" && styles.tabActive]}
          onPress={() => setActiveTab("habits")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "habits" && styles.tabTextActive,
            ]}
          >
            HABITS
          </Text>
          {activeTab === "habits" && <View style={styles.tabIndicator} />}
        </Pressable>
      </Animated.View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === "tasks"
          ? engines.map((eng, i) => renderEngineSection(eng, i))
          : renderHabits()}
      </ScrollView>

      {/* Confirm button */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(400)}
        style={styles.bottomBar}
      >
        <Pressable
          style={[
            styles.confirmButton,
            (!canConfirm || saving) && styles.confirmButtonDisabled,
          ]}
          onPress={canConfirm && !saving ? handleConfirm : undefined}
          disabled={!canConfirm || saving}
        >
          {canConfirm && !saving && (
            <LinearGradient
              colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.04)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <Text
            style={[
              styles.confirmButtonText,
              (!canConfirm || saving) && styles.confirmButtonTextDisabled,
            ]}
          >
            {saving ? "SAVING..." : "CONFIRM SETUP"}
          </Text>
        </Pressable>
        {!canConfirm && !saveError && (
          <Text style={styles.hintText}>
            Select at least 1 mission per engine
          </Text>
        )}
        {saveError && (
          <Text style={styles.errorText}>
            Couldn't save — {saveError}. Tap CONFIRM SETUP to retry.
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

// -- Styles -----------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
  },

  // Header
  headerWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  kicker: {
    ...fonts.kicker,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    ...fonts.heading,
    fontSize: 18,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...fonts.small,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    marginHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    position: "relative",
  },
  tabActive: {
    backgroundColor: colors.panelHighlight,
  },
  tabText: {
    ...fonts.mono,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 3,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.text,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: spacing.xl,
    right: spacing.xl,
    height: 2,
    backgroundColor: colors.glowLine,
    borderRadius: 1,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 120,
  },

  // Engine section
  engineSectionWrap: {
    marginBottom: spacing.lg,
  },
  enginePanel: {
    padding: spacing.md,
  },
  engineHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  engineHeaderIcon: {
    fontSize: 16,
  },
  engineHeaderLabel: {
    ...fonts.mono,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 3,
    flex: 1,
  },
  engineHeaderCount: {
    ...fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },

  // Task row — metallic card style matching MissionRow
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: colors.panelInnerBorder,
    borderLeftWidth: 3,
    marginBottom: spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  checkboxChecked: {
    // backgroundColor and borderColor set dynamically
  },
  checkmark: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000",
    marginTop: -1,
  },
  taskTitle: {
    flex: 1,
    ...fonts.mono,
    fontSize: 13,
    fontWeight: "500",
    color: colors.text,
  },
  taskTitleUnchecked: {
    color: colors.textMuted,
  },

  // Kind badge
  kindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
    borderWidth: 1,
  },
  kindBadgeMain: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.10)",
  },
  kindBadgeSide: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.06)",
  },
  kindBadgeText: {
    ...fonts.kicker,
    fontSize: 8,
    letterSpacing: 1.5,
  },
  kindBadgeTextMain: {
    color: colors.textSecondary,
  },
  kindBadgeTextSide: {
    color: colors.textMuted,
  },

  // Engine badge (habits)
  engineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
  },
  engineBadgeText: {
    ...fonts.kicker,
    fontSize: 8,
    letterSpacing: 1.5,
  },

  // Habit-specific
  habitIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },

  // Habits panel
  habitsPanel: {
    padding: spacing.md,
  },
  habitsPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  habitsPanelTitle: {
    ...fonts.mono,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 3,
    color: colors.text,
    flex: 1,
  },
  habitsPanelCount: {
    ...fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },

  // Add custom
  addLink: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
  addLinkText: {
    ...fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
  },
  addInputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  addInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    ...fonts.mono,
    fontSize: 13,
    color: colors.text,
  },
  addInputConfirm: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.panelHighlight,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  addInputConfirmText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing["3xl"],
    paddingTop: spacing.lg,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.panelInnerBorder,
  },
  confirmButton: {
    width: "100%",
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadows.panel,
  },
  confirmButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.06)",
    ...shadows.card,
  },
  confirmButtonText: {
    ...fonts.mono,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 3,
    color: colors.text,
  },
  confirmButtonTextDisabled: {
    color: colors.textMuted,
  },
  hintText: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  errorText: {
    ...fonts.mono,
    fontSize: 11,
    color: "#F87171",
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 16,
  },
});
