import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions } from "react-native";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { playVoiceLineAsync, playVoiceLine } from "../../../lib/protocol-audio";

// ── Types ────────────────────────────────────────────────────────────────────

type TaskDef = {
  title: string;
  engine: string;
  kind: "main" | "secondary";
};

type Props = {
  archetype: string;
  activeEngines: string[];
  onComplete: (tasks: Array<{ title: string; engine: string; kind: string }>) => void;
};

// ── Engine metadata ─────────────────────────────────────────────────────────

const ENGINE_META: Record<string, { label: string; color: string; dim: string }> = {
  body:     { label: "BODY",     color: colors.body,     dim: colors.bodyDim },
  mind:     { label: "MIND",     color: colors.mind,     dim: colors.mindDim },
  money:    { label: "MONEY",    color: colors.money,    dim: colors.moneyDim },
  charisma: { label: "CHARISMA", color: colors.charisma, dim: colors.charismaDim },
};

const ALL_ENGINES = ["body", "mind", "money", "charisma"] as const;

// ── Archetype → recommended engine mapping ──────────────────────────────────

const ARCHETYPE_RECOMMENDED: Record<string, string[]> = {
  athlete: ["body"],
  scholar: ["mind"],
  hustler: ["money"],
  showman: ["charisma"],
  charmer: ["charisma"],
  warrior: ["body", "mind"],
  founder: ["money", "mind"],
  titan:   [], // no specific recommendation
};

// ── Task catalog per engine ─────────────────────────────────────────────────

const TASK_CATALOG: Record<string, { main: string[]; secondary: string[] }> = {
  body: {
    main: [
      "Morning workout",
      "10,000 steps",
      "Track meals",
      "Gym session",
    ],
    secondary: [
      "Stretch / mobility (10 min)",
      "Drink 2L water",
      "Sleep by midnight",
      "Cold shower",
    ],
  },
  mind: {
    main: [
      "Deep work \u2014 60 min",
      "Read 30 min",
      "Learn something new",
      "Journaling",
    ],
    secondary: [
      "Meditate (10 min)",
      "No social media (2 hrs)",
      "Teach someone",
      "Review notes",
    ],
  },
  money: {
    main: [
      "Track expenses",
      "Work on side project",
      "Networking call",
      "Budget review",
    ],
    secondary: [
      "Save receipt/invoice",
      "Read financial content",
      "Cancel unused subscription",
      "Plan tomorrow\u2019s spending",
    ],
  },
  charisma: {
    main: [
      "Call a friend/family",
      "Record a 60s pitch",
      "Attend social event",
      "Public speaking practice",
    ],
    secondary: [
      "Compliment 3 people",
      "Active listening exercise",
      "Body language practice",
      "Write a thank you note",
    ],
  },
};

// Per engine, first 2 main tasks get "RECOMMENDED" when that engine matches archetype
const RECOMMENDED_INDICES = [0, 1];

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildTaskDefs(engine: string): TaskDef[] {
  const catalog = TASK_CATALOG[engine];
  if (!catalog) return [];
  return [
    ...catalog.main.map((title) => ({ title, engine, kind: "main" as const })),
    ...catalog.secondary.map((title) => ({ title, engine, kind: "secondary" as const })),
  ];
}

function taskKey(t: TaskDef): string {
  return `${t.engine}::${t.kind}::${t.title}`;
}

// ── Task row component ──────────────────────────────────────────────────────

function TaskRow({
  task,
  selected,
  recommended,
  engineColor,
  index,
  onToggle,
}: {
  task: TaskDef;
  selected: boolean;
  recommended: boolean;
  engineColor: string;
  index: number;
  onToggle: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(250)}>
      <Pressable
        style={styles.taskRow}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle();
        }}
      >
        {/* Selection circle */}
        <View
          style={[
            styles.circle,
            selected
              ? { backgroundColor: engineColor, borderColor: engineColor }
              : { borderColor: "rgba(255,255,255,0.20)" },
          ]}
        >
          {selected && <View style={styles.circleInner} />}
        </View>

        {/* Task title */}
        <Text
          style={[
            styles.taskTitle,
            selected && { color: "rgba(255,255,255,0.92)" },
          ]}
          numberOfLines={1}
        >
          {task.title}
        </Text>

        {/* Recommended badge */}
        {recommended && (
          <View style={[styles.badge, { borderColor: engineColor }]}>
            <Text style={[styles.badgeText, { color: engineColor }]}>REC</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── Engine tab ──────────────────────────────────────────────────────────────

function EngineTab({
  engine,
  active,
  onPress,
}: {
  engine: string;
  active: boolean;
  onPress: () => void;
}) {
  const meta = ENGINE_META[engine];
  if (!meta) return null;

  return (
    <Pressable
      style={[
        styles.tab,
        active && { borderBottomColor: meta.color, borderBottomWidth: 2 },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <Text
        style={[
          styles.tabLabel,
          active ? { color: "#FFFFFF", opacity: 1 } : { opacity: 0.35 },
        ]}
      >
        {meta.label}
      </Text>
    </Pressable>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function BeatTaskSelection({ archetype, activeEngines, onComplete }: Props) {
  // Resolve which engines to show
  const engines =
    activeEngines.length > 0
      ? ALL_ENGINES.filter((e) => activeEngines.includes(e))
      : [...ALL_ENGINES];

  const [activeTab, setActiveTab] = useState(engines[0]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Play voice line on mount
  const hasPlayedRef = useRef(false);
  useEffect(() => {
    if (!hasPlayedRef.current) {
      hasPlayedRef.current = true;
      playVoiceLineAsync("ONBO-013");
    }
  }, []);

  // Determine which engines get recommendations
  const recommendedEngines = ARCHETYPE_RECOMMENDED[archetype] ?? [];

  // Toggle a task selection
  const toggleTask = useCallback((task: TaskDef) => {
    const key = taskKey(task);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Compute counts
  const allSelected = engines.flatMap((eng) =>
    buildTaskDefs(eng).filter((t) => selected.has(taskKey(t))),
  );
  const totalCount = allSelected.length;
  const mainCount = allSelected.filter((t) => t.kind === "main").length;
  const secondaryCount = allSelected.filter((t) => t.kind === "secondary").length;

  // Validation: at least 1 main task per active engine
  const isValid = engines.every((eng) => {
    const engineMain = TASK_CATALOG[eng]?.main ?? [];
    return engineMain.some((title) =>
      selected.has(taskKey({ title, engine: eng, kind: "main" })),
    );
  });

  // Confirm handler
  const handleConfirm = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Play confirmation voice line
    await playVoiceLine("ONBO-014");

    // 1.5s pause then complete
    setTimeout(() => {
      onComplete(allSelected.map((t) => ({ title: t.title, engine: t.engine, kind: t.kind })));
    }, 1500);
  };

  // Current tab tasks
  const currentMain = (TASK_CATALOG[activeTab]?.main ?? []).map((title) => ({
    title,
    engine: activeTab,
    kind: "main" as const,
  }));
  const currentSecondary = (TASK_CATALOG[activeTab]?.secondary ?? []).map((title) => ({
    title,
    engine: activeTab,
    kind: "secondary" as const,
  }));
  const engineColor = ENGINE_META[activeTab]?.color ?? colors.textMuted;
  const isRecommendedEngine = recommendedEngines.includes(activeTab);

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.title}>SELECT OPERATIONS</Text>
        <Text style={styles.subtitle}>Start with what you can do.</Text>
      </Animated.View>

      {/* Engine tab bar */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.tabBar}>
        {engines.map((eng) => (
          <EngineTab
            key={eng}
            engine={eng}
            active={activeTab === eng}
            onPress={() => setActiveTab(eng)}
          />
        ))}
      </Animated.View>

      {/* Task list */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* MAIN section */}
        <Animated.View entering={FadeIn.duration(200)} key={`main-${activeTab}`}>
          <Text style={[styles.sectionHeader, { color: engineColor }]}>MAIN</Text>
          {currentMain.map((task, i) => (
            <TaskRow
              key={taskKey(task)}
              task={task}
              selected={selected.has(taskKey(task))}
              recommended={isRecommendedEngine && RECOMMENDED_INDICES.includes(i)}
              engineColor={engineColor}
              index={i}
              onToggle={() => toggleTask(task)}
            />
          ))}
        </Animated.View>

        {/* SECONDARY section */}
        <Animated.View
          entering={FadeIn.delay(100).duration(200)}
          key={`sec-${activeTab}`}
          style={styles.secondarySection}
        >
          <Text style={[styles.sectionHeader, { color: engineColor }]}>SECONDARY</Text>
          {currentSecondary.map((task, i) => (
            <TaskRow
              key={taskKey(task)}
              task={task}
              selected={selected.has(taskKey(task))}
              recommended={false}
              engineColor={engineColor}
              index={i + currentMain.length}
              onToggle={() => toggleTask(task)}
            />
          ))}
        </Animated.View>
      </ScrollView>

      {/* Bottom bar: counter + confirm */}
      <View style={styles.bottomBar}>
        {/* Running counter */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.counter}>
          <Text style={styles.counterText}>
            {totalCount} TASKS SELECTED
          </Text>
          <Text style={styles.counterBreakdown}>
            {mainCount} MAIN / {secondaryCount} SECONDARY
          </Text>
        </Animated.View>

        {/* Validation hint */}
        {!isValid && (
          <Text style={styles.hint}>Select at least 1 main task per engine</Text>
        )}

        {/* Confirm button */}
        <Pressable
          style={[styles.btn, !isValid && styles.btnDisabled]}
          onPress={handleConfirm}
          disabled={!isValid}
        >
          <Text style={[styles.btnText, !isValid && { opacity: 0.4 }]}>CONFIRM</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Layout constants ────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CIRCLE_SIZE = 22;

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingTop: spacing["4xl"],
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },

  title: {
    ...fonts.mono,
    fontSize: 20,
    fontWeight: "700",
    color: colors.success,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },

  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.40)",
  },

  // ── Tab bar ─────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: spacing.xl,
  },

  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },

  tabLabel: {
    ...fonts.mono,
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  // ── Scroll area ─────────────────────────────────────────────────────────
  scrollArea: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },

  // ── Section headers ─────────────────────────────────────────────────────
  sectionHeader: {
    ...fonts.kicker,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },

  secondarySection: {
    marginTop: spacing.xl,
  },

  // ── Task row ────────────────────────────────────────────────────────────
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
  },

  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },

  circleInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#000000",
  },

  taskTitle: {
    flex: 1,
    ...fonts.mono,
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.55)",
  },

  // ── Recommended badge ───────────────────────────────────────────────────
  badge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },

  badgeText: {
    ...fonts.mono,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  // ── Bottom bar ──────────────────────────────────────────────────────────
  bottomBar: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing["3xl"],
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },

  counter: {
    alignItems: "center",
    marginBottom: spacing.md,
  },

  counterText: {
    ...fonts.mono,
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.70)",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  counterBreakdown: {
    ...fonts.mono,
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 1.5,
    marginTop: spacing.xs,
  },

  hint: {
    ...fonts.mono,
    fontSize: 11,
    color: colors.warning,
    textAlign: "center",
    marginBottom: spacing.sm,
    opacity: 0.7,
  },

  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },

  btnDisabled: {
    opacity: 0.3,
  },

  btnText: {
    ...fonts.kicker,
    fontSize: 13,
    color: "#000",
    letterSpacing: 2,
  },
});
