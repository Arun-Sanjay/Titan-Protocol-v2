import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, fonts, radius } from "../../../theme";
import {
  useEngineStore,
  selectAllTasksForDate,
  ENGINES,
  type TaskWithStatus,
} from "../../../stores/useEngineStore";
import { useProfileStore, XP_REWARDS } from "../../../stores/useProfileStore";
import { getTodayKey } from "../../../lib/date";
import { getCurrentChapter, getDayNumber } from "../../../data/chapters";
import { getJSON } from "../../../db/storage";
import { evaluateAllTrees } from "../../../lib/skill-tree-evaluator";
import { HUDBackground } from "../../ui/AnimatedBackground";
import { Panel } from "../../ui/Panel";
import { MissionRow } from "../../ui/MissionRow";

/* ─── Engine color map ──────────────────────────────────────────────── */
const ENGINE_COLORS: Record<string, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  charisma: colors.charisma,
};

/* ─── Component ─────────────────────────────────────────────────────── */
export function WarRoom() {
  const router = useRouter();
  const today = getTodayKey();

  // Stores
  const tasks = useEngineStore((s) => s.tasks);
  const completions = useEngineStore((s) => s.completions);
  const loadAllEngines = useEngineStore((s) => s.loadAllEngines);
  const toggleTask = useEngineStore((s) => s.toggleTask);
  const awardXP = useProfileStore((s) => s.awardXP);

  // Collapsed completed section
  const [completedExpanded, setCompletedExpanded] = useState(false);

  // Load engines on mount
  useEffect(() => {
    loadAllEngines(today);
  }, []);

  // Chapter / boss info
  const firstActiveDate = getJSON<string | null>("first_active_date", null);
  const dayNumber = getDayNumber(firstActiveDate);
  const chapter = getCurrentChapter(dayNumber);

  // Boss active in final week of chapter
  const chapterEndDay = chapter.weekEnd * 7;
  const isBossActive = dayNumber > chapterEndDay - 7 && dayNumber <= chapterEndDay;

  // All tasks for today
  const allTasks = useMemo(
    () => selectAllTasksForDate(tasks, completions, today),
    [tasks, completions, today],
  );

  const mainMissions = useMemo(
    () => allTasks.filter((t) => t.kind === "main" && !t.completed),
    [allTasks],
  );
  const sideQuests = useMemo(
    () => allTasks.filter((t) => t.kind === "secondary" && !t.completed),
    [allTasks],
  );
  const completedTasks = useMemo(
    () => allTasks.filter((t) => t.completed),
    [allTasks],
  );

  // Toggle handler
  const handleToggle = (task: TaskWithStatus) => {
    const completed = toggleTask(task.engine, task.id!, today);
    if (completed) {
      const xp =
        task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
      awardXP(today, `task:${task.id}`, xp);
      evaluateAllTrees();
    }
  };

  return (
    <View style={styles.root}>
      <HUDBackground />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={colors.textSecondary}
            />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>WAR ROOM</Text>
            <Text style={styles.title}>Operations Board</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Boss Challenge Card ─────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <Panel
              style={[
                styles.bossCard,
                {
                  borderColor: isBossActive
                    ? colors.danger + "60"
                    : "rgba(255,255,255,0.10)",
                },
              ]}
              glowColor={isBossActive ? colors.danger : undefined}
            >
              <View style={styles.bossHeader}>
                <Text style={styles.bossKicker}>BOSS CHALLENGE</Text>
                <View
                  style={[
                    styles.statusBadge,
                    isBossActive ? styles.statusActive : styles.statusLocked,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      isBossActive
                        ? styles.statusTextActive
                        : styles.statusTextLocked,
                    ]}
                  >
                    {isBossActive ? "ACTIVE" : "LOCKED"}
                  </Text>
                </View>
              </View>
              <Text style={styles.bossName}>{chapter.bossName}</Text>
              <Text style={styles.bossDesc}>{chapter.bossDescription}</Text>
            </Panel>
          </Animated.View>

          {/* ─── Main Missions ───────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(250).duration(500)}>
            <Text style={styles.sectionHeader}>MAIN MISSIONS</Text>
          </Animated.View>

          {mainMissions.length > 0 ? (
            mainMissions.map((task, idx) => (
              <Animated.View
                key={task.id}
                entering={FadeInDown.delay(300 + idx * 60).duration(400)}
              >
                <MissionRow
                  title={task.title}
                  xp={XP_REWARDS.MAIN_TASK}
                  completed={task.completed}
                  kind="main"
                  engine={task.engine}
                  onToggle={() => handleToggle(task)}
                />
              </Animated.View>
            ))
          ) : (
            <Animated.View
              entering={FadeInDown.delay(300).duration(400)}
              style={styles.emptySection}
            >
              <Ionicons
                name="checkmark-done-outline"
                size={20}
                color={colors.textMuted}
              />
              <Text style={styles.emptyText}>All main missions completed</Text>
            </Animated.View>
          )}

          {/* ─── Side Quests ─────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(450).duration(500)}>
            <Text style={styles.sectionHeader}>SIDE QUESTS</Text>
          </Animated.View>

          {sideQuests.length > 0 ? (
            sideQuests.map((task, idx) => (
              <Animated.View
                key={task.id}
                entering={FadeInDown.delay(500 + idx * 60).duration(400)}
                style={styles.dimRow}
              >
                <MissionRow
                  title={task.title}
                  xp={XP_REWARDS.SIDE_QUEST}
                  completed={task.completed}
                  kind="secondary"
                  engine={task.engine}
                  onToggle={() => handleToggle(task)}
                />
              </Animated.View>
            ))
          ) : (
            <Animated.View
              entering={FadeInDown.delay(500).duration(400)}
              style={styles.emptySection}
            >
              <Ionicons
                name="checkmark-done-outline"
                size={20}
                color={colors.textMuted}
              />
              <Text style={styles.emptyText}>All side quests completed</Text>
            </Animated.View>
          )}

          {/* ─── Completed Section ───────────────────────────────── */}
          {completedTasks.length > 0 && (
            <Animated.View entering={FadeInDown.delay(650).duration(500)}>
              <Pressable
                style={styles.completedHeader}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCompletedExpanded((v) => !v);
                }}
              >
                <Text style={styles.sectionHeader}>
                  COMPLETED ({completedTasks.length})
                </Text>
                <Ionicons
                  name={completedExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.textMuted}
                />
              </Pressable>

              {completedExpanded &&
                completedTasks.map((task, idx) => (
                  <Animated.View
                    key={task.id}
                    entering={FadeInDown.delay(idx * 40).duration(300)}
                    style={styles.completedRow}
                  >
                    <MissionRow
                      title={task.title}
                      xp={
                        task.kind === "main"
                          ? XP_REWARDS.MAIN_TASK
                          : XP_REWARDS.SIDE_QUEST
                      }
                      completed={task.completed}
                      kind={task.kind}
                      engine={task.engine}
                      onToggle={() => handleToggle(task)}
                    />
                  </Animated.View>
                ))}
            </Animated.View>
          )}

          {/* Bottom spacer for scroll */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    alignItems: "center",
  },
  kicker: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 4,
  },
  title: {
    ...fonts.heading,
    fontSize: 22,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },

  /* Boss card */
  bossCard: {
    marginBottom: spacing.xl,
    borderWidth: 1.5,
  },
  bossHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  bossKicker: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.danger,
    letterSpacing: 3,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: colors.dangerDim,
    borderColor: colors.danger + "40",
  },
  statusLocked: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.10)",
  },
  statusText: {
    ...fonts.kicker,
    fontSize: 8,
    letterSpacing: 2,
  },
  statusTextActive: {
    color: colors.danger,
  },
  statusTextLocked: {
    color: colors.textMuted,
  },
  bossName: {
    ...fonts.heading,
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  bossDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  /* Section headers */
  sectionHeader: {
    ...fonts.kicker,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 3,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },

  /* Dim side quest rows */
  dimRow: {
    opacity: 0.85,
  },

  /* Completed section */
  completedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  completedRow: {
    opacity: 0.5,
  },

  /* Empty states */
  emptySection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderStyle: "dashed",
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
