import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
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

/* ─── Constants ────────────────────────────────────────────────────── */
const CARD_GAP = 12;
const CARD_BORDER_RADIUS = 16;

const ENGINE_COLORS: Record<string, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  charisma: colors.charisma,
};

const ENGINE_DIM_COLORS: Record<string, string> = {
  body: colors.bodyDim,
  mind: colors.mindDim,
  money: colors.moneyDim,
  charisma: colors.charismaDim,
};

const ENGINE_ICONS: Record<string, string> = {
  body: "fitness",
  mind: "bulb",
  money: "cash",
  charisma: "people",
};

const ENGINE_LABELS: Record<string, string> = {
  body: "BODY",
  mind: "MIND",
  money: "MONEY",
  charisma: "CHARISMA",
};

const TACTICAL_DESCRIPTIONS: Record<string, string> = {
  body: "Physical performance target",
  mind: "Cognitive development objective",
  money: "Financial growth operation",
  charisma: "Social influence mission",
};

/* ─── Component ────────────────────────────────────────────────────── */
export function WarRoom() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const CARD_WIDTH = screenWidth * 0.85;
  const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

  const dateKey = getTodayKey();
  const tasks = useEngineStore((s) => s.tasks);
  const completions = useEngineStore((s) => s.completions);
  const toggleTask = useEngineStore((s) => s.toggleTask);
  const awardXP = useProfileStore((s) => s.awardXP);

  const [justCompleted, setJustCompleted] = useState<Set<number>>(new Set());

  /* Load engines on mount */
  useEffect(() => {
    const load = useEngineStore.getState().loadEngine;
    for (const e of ENGINES) load(e, dateKey);
    useProfileStore.getState().load();
  }, [dateKey]);

  /* Derive all tasks */
  const allTasks = useMemo(
    () => selectAllTasksForDate(tasks, completions, dateKey),
    [tasks, completions, dateKey]
  );

  /* Sort: active first, completed last */
  const sortedTasks = useMemo(() => {
    const active = allTasks.filter((t) => !t.completed);
    const done = allTasks.filter((t) => t.completed);
    return [...active, ...done];
  }, [allTasks]);

  /* Stats */
  const mainTasks = allTasks.filter((t) => t.kind === "main");
  const sideTasks = allTasks.filter((t) => t.kind === "secondary");
  const mainDone = mainTasks.filter((t) => t.completed).length;
  const sideDone = sideTasks.filter((t) => t.completed).length;
  const totalDone = allTasks.filter((t) => t.completed).length;

  /* Boss data */
  const firstActiveDate = getJSON<string | null>("first_active_date", null);
  const dayNumber = getDayNumber(firstActiveDate);
  const chapter = getCurrentChapter(dayNumber);

  /* Boss status — simplified: active if we have tasks, locked if day 0 */
  const bossActive = dayNumber > 0 && allTasks.length > 0;

  /* Handle toggle */
  const handleToggle = useCallback(
    (task: TaskWithStatus) => {
      if (task.completed) return; // Don't un-complete
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      toggleTask(task.engine, task.id!, dateKey);
      const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
      awardXP(dateKey, `task:${task.id}`, xp);
      evaluateAllTrees();

      setJustCompleted((prev) => {
        const next = new Set(prev);
        next.add(task.id!);
        return next;
      });
    },
    [dateKey, toggleTask, awardXP]
  );

  return (
    <View style={styles.root}>
      <HUDBackground />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={16}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerKicker}>OPERATIONS BOARD</Text>
            <Text style={styles.headerTitle}>WAR ROOM</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Boss Challenge Banner ─── */}
          <View style={styles.bossCard}>
            <View style={styles.bossGlow} />
            <View style={styles.bossContent}>
              <Text style={styles.bossKicker}>
                {"\u{1F480}"} BOSS CHALLENGE
              </Text>
              <Text style={styles.bossName}>{chapter.bossName}</Text>
              <Text style={styles.bossDescription}>
                {chapter.bossDescription}
              </Text>
              <View style={styles.bossStatusRow}>
                {bossActive ? (
                  <View style={styles.bossStatusActive}>
                    <View style={styles.bossActiveDot} />
                    <Text style={styles.bossStatusActiveText}>ACTIVE</Text>
                  </View>
                ) : (
                  <View style={styles.bossStatusLocked}>
                    <Ionicons
                      name="lock-closed"
                      size={12}
                      color={colors.textMuted}
                    />
                    <Text style={styles.bossStatusLockedText}>LOCKED</Text>
                  </View>
                )}
              </View>
              {bossActive && (
                <View style={styles.bossProgressRow}>
                  <View style={styles.bossProgressTrack}>
                    <View
                      style={[
                        styles.bossProgressFill,
                        {
                          width: `${Math.min(
                            100,
                            (totalDone / Math.max(1, allTasks.length)) * 100
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.bossProgressLabel}>
                    {totalDone}/{allTasks.length} completed
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ─── Mission Briefing Cards ─── */}
          {sortedTasks.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled={false}
              snapToInterval={SNAP_INTERVAL}
              snapToAlignment="start"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                styles.cardsContainer,
                { paddingHorizontal: (screenWidth - CARD_WIDTH) / 2 },
              ]}
              style={styles.cardsScroll}
            >
              {sortedTasks.map((task, index) => {
                const isCompleted =
                  task.completed || justCompleted.has(task.id!);
                const engineColor =
                  ENGINE_COLORS[task.engine] ?? colors.primary;
                const engineDimColor =
                  ENGINE_DIM_COLORS[task.engine] ?? colors.primaryDim;
                const engineIcon =
                  ENGINE_ICONS[task.engine] ?? "ellipse";
                const engineLabel =
                  ENGINE_LABELS[task.engine] ?? task.engine.toUpperCase();
                const isSide = task.kind === "secondary";
                const xpReward = isSide
                  ? XP_REWARDS.SIDE_QUEST
                  : XP_REWARDS.MAIN_TASK;

                return (
                  <View
                    key={`${task.engine}-${task.id}`}
                    style={[
                      styles.missionCard,
                      {
                        width: CARD_WIDTH,
                        marginRight:
                          index < sortedTasks.length - 1 ? CARD_GAP : 0,
                        opacity: isCompleted ? 0.5 : 1,
                      },
                    ]}
                  >
                    {/* Color stripe */}
                    <View
                      style={[
                        styles.cardStripe,
                        { backgroundColor: engineColor },
                      ]}
                    />

                    <View style={styles.cardBody}>
                      {/* Top row: kicker + engine pill */}
                      <View style={styles.cardTopRow}>
                        <Text style={styles.cardKicker}>
                          {isSide ? "SIDE QUEST" : "MISSION"}
                        </Text>
                        <View
                          style={[
                            styles.enginePill,
                            { backgroundColor: engineDimColor },
                          ]}
                        >
                          <Ionicons
                            name={engineIcon as any}
                            size={12}
                            color={engineColor}
                          />
                          <Text
                            style={[
                              styles.enginePillText,
                              { color: engineColor },
                            ]}
                          >
                            {engineLabel}
                          </Text>
                        </View>
                      </View>

                      {/* Mission title */}
                      <Text
                        style={styles.cardTitle}
                        numberOfLines={2}
                      >
                        {task.title}
                      </Text>

                      {/* Tactical description */}
                      <Text style={styles.cardDescription}>
                        {TACTICAL_DESCRIPTIONS[task.engine] ??
                          "Operational objective"}
                      </Text>

                      {/* XP + Status row */}
                      <View style={styles.cardMetaRow}>
                        <View style={styles.xpBadge}>
                          <Text style={styles.xpBadgeText}>
                            +{xpReward} XP
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.cardStatus,
                            {
                              color: isCompleted
                                ? colors.success
                                : colors.warning,
                            },
                          ]}
                        >
                          {isCompleted ? "COMPLETED" : "ACTIVE"}
                        </Text>
                      </View>

                      {/* Complete button / check overlay */}
                      {isCompleted ? (
                        <View style={styles.completedOverlay}>
                          <Ionicons
                            name="checkmark-circle"
                            size={48}
                            color={colors.success}
                          />
                          <Text style={styles.completedText}>
                            MISSION COMPLETE
                          </Text>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => handleToggle(task)}
                          style={({ pressed }) => [
                            styles.completeButton,
                            {
                              borderColor: engineColor,
                              backgroundColor: pressed
                                ? engineDimColor
                                : "transparent",
                            },
                          ]}
                        >
                          <Ionicons
                            name="checkmark-sharp"
                            size={20}
                            color={engineColor}
                          />
                          <Text
                            style={[
                              styles.completeButtonText,
                              { color: engineColor },
                            ]}
                          >
                            MARK COMPLETE
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="document-text-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text style={styles.emptyText}>
                No missions assigned. Add tasks to your engines.
              </Text>
            </View>
          )}

          {/* ─── Stats Bar ─── */}
          <View style={styles.statsBar}>
            <View style={styles.statsRow}>
              <Text style={styles.statsLabel}>
                COMPLETED: {totalDone}/{allTasks.length}
              </Text>
            </View>
            <View style={styles.statsProgressTrack}>
              <View
                style={[
                  styles.statsProgressFill,
                  {
                    width: `${
                      allTasks.length > 0
                        ? (totalDone / allTasks.length) * 100
                        : 0
                    }%`,
                  },
                ]}
              />
            </View>
            <View style={styles.statsBreakdown}>
              <Text style={styles.statsBreakdownText}>
                MAIN: {mainDone}/{mainTasks.length}
              </Text>
              <Text style={styles.statsBreakdownDivider}>{"\u{2022}"}</Text>
              <Text style={styles.statsBreakdownText}>
                SIDE: {sideDone}/{sideTasks.length}
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safeArea: {
    flex: 1,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerKicker: {
    ...fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textMuted,
    marginBottom: 2,
  },
  headerTitle: {
    ...fonts.heading,
    fontSize: 22,
    letterSpacing: 4,
    color: colors.text,
  },

  /* Scroll */
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing["2xl"],
  },

  /* Boss Card */
  bossCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    borderRadius: CARD_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.3)",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    overflow: "hidden",
    position: "relative",
  },
  bossGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  bossContent: {
    padding: spacing.md,
    paddingTop: spacing.md + 4,
  },
  bossKicker: {
    ...fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  bossName: {
    ...fonts.heading,
    fontSize: 24,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  bossDescription: {
    ...fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  bossStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  bossStatusActive: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(248, 113, 113, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  bossActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
    marginRight: 6,
  },
  bossStatusActiveText: {
    ...fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.danger,
  },
  bossStatusLocked: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    gap: 4,
  },
  bossStatusLockedText: {
    ...fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  bossProgressRow: {
    marginTop: spacing.xs,
  },
  bossProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    marginBottom: 4,
  },
  bossProgressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: colors.danger,
  },
  bossProgressLabel: {
    ...fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },

  /* Cards Scroll */
  cardsScroll: {
    flexGrow: 0,
  },
  cardsContainer: {
    paddingVertical: spacing.sm,
  },

  /* Mission Card */
  missionCard: {
    borderRadius: CARD_BORDER_RADIUS,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: "hidden",
  },
  cardStripe: {
    height: 4,
    width: "100%",
  },
  cardBody: {
    padding: spacing.md,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  cardKicker: {
    ...fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  enginePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    gap: 4,
  },
  enginePillText: {
    ...fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
  },
  cardTitle: {
    ...fonts.heading,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.xs,
    lineHeight: 24,
  },
  cardDescription: {
    ...fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.md,
    letterSpacing: 0.3,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  xpBadge: {
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  xpBadgeText: {
    ...fonts.mono,
    fontSize: 11,
    color: colors.warning,
    letterSpacing: 0.5,
  },
  cardStatus: {
    ...fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
  },

  /* Complete button */
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: 14,
    gap: 8,
  },
  completeButtonText: {
    ...fonts.heading,
    fontSize: 13,
    letterSpacing: 2,
  },

  /* Completed overlay */
  completedOverlay: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    gap: 8,
  },
  completedText: {
    ...fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.success,
  },

  /* Empty state */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["2xl"],
    gap: spacing.sm,
  },
  emptyText: {
    ...fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },

  /* Stats Bar */
  statsBar: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  statsLabel: {
    ...fonts.mono,
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.text,
  },
  statsProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  statsProgressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  statsBreakdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statsBreakdownText: {
    ...fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  statsBreakdownDivider: {
    color: colors.textMuted,
    fontSize: 8,
  },
});

export default WarRoom;
