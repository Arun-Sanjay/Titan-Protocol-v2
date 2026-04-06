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
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useEngineStore } from "../../../stores/useEngineStore";
import { useHabitStore } from "../../../stores/useHabitStore";
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    // If toggling ON, do a brief scale pulse
    if (!task.checked) {
      scale.value = withSequence(
        withTiming(1.04, { duration: 100, easing: Easing.out(Easing.cubic) }),
        withTiming(1.0, { duration: 150, easing: Easing.inOut(Easing.cubic) }),
      );
    }
    onToggle(task.globalIndex);
  }, [task.checked, task.globalIndex, onToggle]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={styles.taskRow}
        onPress={handlePress}
      >
        <View
          style={[
            styles.checkbox,
            task.checked && styles.checkboxChecked,
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
            {task.kind === "main" ? "MAIN" : "SIDE"}
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    if (!habit.checked) {
      scale.value = withSequence(
        withTiming(1.04, { duration: 100, easing: Easing.out(Easing.cubic) }),
        withTiming(1.0, { duration: 150, easing: Easing.inOut(Easing.cubic) }),
      );
    }
    onToggle(index);
  }, [habit.checked, index, onToggle]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={styles.taskRow}
        onPress={handlePress}
      >
        <View
          style={[
            styles.checkbox,
            habit.checked && styles.checkboxChecked,
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
        <Text style={styles.habitEngine}>
          {habit.engine.toUpperCase()}
        </Text>
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

  // -- Confirm --------------------------------------------------------------

  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Persist tasks
    const addTask = useEngineStore.getState().addTask;
    for (const t of tasks) {
      if (t.checked) {
        addTask(t.engine, t.title, t.kind);
      }
    }

    // Persist habits
    const addHabit = useHabitStore.getState().addHabit;
    for (const h of habits) {
      if (h.checked) {
        addHabit(h.title, h.icon, h.engine);
      }
    }

    onComplete();
  }, [tasks, habits, onComplete]);

  const canConfirm = hasMinOneMainPerEngine(tasks, engines);

  // -- Render: Task section for a single engine -----------------------------

  const renderEngineSection = (engine: string, sectionIndex: number) => {
    const engineTasks = tasks
      .map((t, i) => ({ ...t, globalIndex: i }))
      .filter((t) => t.engine === engine);

    const engineColor = ENGINE_COLORS[engine] ?? colors.textSecondary;

    return (
      <Animated.View
        key={engine}
        entering={FadeInDown.delay(100 + sectionIndex * 100).duration(400)}
        style={[
          styles.engineSection,
          { borderLeftWidth: 3, borderLeftColor: engineColor },
        ]}
      >
        <Text
          style={[
            styles.sectionHeader,
            { color: engineColor },
          ]}
        >
          {engine.toUpperCase()}
        </Text>

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
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={customTaskText}
              onChangeText={setCustomTaskText}
              onSubmitEditing={() => addCustomTask(engine)}
              autoFocus
              returnKeyType="done"
            />
            <Pressable
              style={styles.addInputConfirm}
              onPress={() => addCustomTask(engine)}
            >
              <Text style={styles.addInputConfirmText}>+</Text>
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
            <Text style={styles.addLinkText}>+ Add custom task</Text>
          </Pressable>
        )}
      </Animated.View>
    );
  };

  // -- Render: Habits -------------------------------------------------------

  const renderHabits = () => (
    <View style={styles.habitsContainer}>
      {habits.map((habit, index) => (
        <Animated.View
          key={`habit-${index}`}
          entering={FadeInDown.delay(index * 60).duration(400)}
        >
          <AnimatedHabitRow
            habit={habit}
            index={index}
            onToggle={toggleHabit}
          />
        </Animated.View>
      ))}

      {/* Add custom habit */}
      {addingHabit ? (
        <View style={styles.addInputRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Habit name..."
            placeholderTextColor="rgba(255,255,255,0.25)"
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
    </View>
  );

  // -- Main render ----------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Header with entrance animation */}
      <Animated.View
        entering={FadeInDown.delay(0).duration(400)}
        style={styles.headerWrap}
      >
        <Text style={styles.headerTitle}>BUILD YOUR PROTOCOL</Text>
        <Text style={styles.headerSubtitle}>Select the tasks and habits you want to track</Text>
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
            !canConfirm && styles.confirmButtonDisabled,
          ]}
          onPress={canConfirm ? handleConfirm : undefined}
          disabled={!canConfirm}
        >
          <Text
            style={[
              styles.confirmButtonText,
              !canConfirm && styles.confirmButtonTextDisabled,
            ]}
          >
            CONFIRM SETUP
          </Text>
        </Pressable>
        {!canConfirm && (
          <Text style={styles.hintText}>
            Select at least 1 main task per engine
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
    backgroundColor: "#000",
  },

  // Header
  headerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 3,
    color: "rgba(255,255,255,0.90)",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "rgba(255,255,255,0.40)",
    letterSpacing: 0.5,
  },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.10)",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#fff",
  },
  tabText: {
    fontFamily: "monospace",
    fontSize: 12,
    letterSpacing: 3,
    color: "rgba(255,255,255,0.35)",
  },
  tabTextActive: {
    color: "rgba(255,255,255,0.90)",
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 120,
  },

  // Engine section
  engineSection: {
    marginBottom: spacing["2xl"],
    paddingLeft: spacing.md,
  },
  sectionHeader: {
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },

  // Task row
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    paddingHorizontal: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    marginTop: -1,
  },
  taskTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.88)",
  },
  taskTitleUnchecked: {
    color: "rgba(255,255,255,0.45)",
  },

  // Kind badge
  kindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: spacing.sm,
  },
  kindBadgeMain: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  kindBadgeSide: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  kindBadgeText: {
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  kindBadgeTextMain: {
    color: "rgba(255,255,255,0.70)",
  },
  kindBadgeTextSide: {
    color: "rgba(255,255,255,0.35)",
  },

  // Habit-specific
  habitIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  habitEngine: {
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.30)",
    marginLeft: spacing.sm,
  },
  habitsContainer: {
    gap: 0,
  },

  // Add custom
  addLink: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
  addLinkText: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "rgba(255,255,255,0.40)",
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
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontFamily: "monospace",
  },
  addInputConfirm: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  addInputConfirmText: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.70)",
  },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["3xl"],
    paddingTop: spacing.lg,
    backgroundColor: "#000",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  confirmButton: {
    width: "100%",
    height: 48,
    backgroundColor: "#fff",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  confirmButtonText: {
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 3,
    color: "#000",
  },
  confirmButtonTextDisabled: {
    color: "rgba(255,255,255,0.25)",
  },
  hintText: {
    fontFamily: "monospace",
    fontSize: 10,
    color: "rgba(255,255,255,0.30)",
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
