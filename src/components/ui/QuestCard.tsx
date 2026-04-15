/**
 * QuestCard — Daily operation displayed as an urgent quest assignment.
 *
 * Styled like a floating system window: dark glass background, subtle glow
 * border, quest objectives with checkboxes, XP rewards, timer.
 * Feels like receiving a quest in a game — but the quests are YOUR real tasks.
 */

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../theme";
import { generateDailyOperation, type OperationTask } from "../../lib/operation-engine";
import { useStoryStore } from "../../stores/useStoryStore";
import { useSystemNotification } from "./SystemNotification";
import { getTodayKey } from "../../lib/date";
import { getDayNumber } from "../../data/chapters";
import { getJSON } from "../../db/storage";
// Phase 3.6: cloud hooks replace legacy MMKV stores
import { useAllTasks, useAllCompletionsForDate, useRecentCompletionMap, useToggleCompletion } from "../../hooks/queries/useTasks";
import { useProfile, useAwardXP } from "../../hooks/queries/useProfile";
import { useEnqueueRankUp } from "../../hooks/queries/useRankUps";

const ENGINE_COLORS: Record<string, string> = {
  body: colors.body, mind: colors.mind, money: colors.money, charisma: colors.charisma,
};
const ENGINE_LABELS: Record<string, string> = {
  body: "BODY", mind: "MIND", money: "MONEY", charisma: "CHARISMA",
};

type Props = {
  delay?: number;
};

export function QuestCard({ delay = 0 }: Props) {
  const userName = useStoryStore((s) => s.userName) || "Recruit";
  const storyAct = useStoryStore((s) => s.currentAct);
  const notify = useSystemNotification();

  // Phase 3.6: cloud hooks replace legacy MMKV stores
  const { data: profile } = useProfile();
  const streak = profile?.streak_current ?? 0;
  const { data: cloudTasks = [] } = useAllTasks();
  const completionMap = useRecentCompletionMap();
  const toggleCompletionMutation = useToggleCompletion();
  const awardXPMutation = useAwardXP();
  const enqueueRankUpMutation = useEnqueueRankUp();

  const firstActiveDate = getJSON<string | null>("first_active_date", null);
  const dayNumber = getDayNumber(firstActiveDate);
  const today = getTodayKey();

  // Generate operation from cloud task data
  const operation = useMemo(
    () => generateDailyOperation(userName, dayNumber, streak, storyAct, cloudTasks, completionMap),
    [userName, dayNumber, streak, storyAct, cloudTasks, completionMap],
  );

  // Track completed tasks from cloud completions
  const { data: allCompletions = [] } = useAllCompletionsForDate(today);
  const completedIds = useMemo(() => {
    return new Set(allCompletions.map((c) => c.task_id));
  }, [allCompletions]);

  const completedCount = operation.tasks.filter((t) => completedIds.has(t.id)).length;
  const totalXp = operation.tasks.reduce((sum, t) => sum + t.xp, 0);
  const earnedXp = operation.tasks
    .filter((t) => completedIds.has(t.id))
    .reduce((sum, t) => sum + t.xp, 0);

  // Phase 3.6: cloud toggle + XP award (same pattern as dashboard)
  const handleToggleTask = (task: OperationTask) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const wasCompleted = completedIds.has(task.id);

    toggleCompletionMutation.mutate(
      { task: { id: task.id, engine: task.engine }, dateKey: today },
      {
        onSuccess: () => {
          if (!wasCompleted) {
            awardXPMutation.mutate(task.xp, {
              onSuccess: (result) => {
                if (result.leveledUp) {
                  enqueueRankUpMutation.mutate({ fromLevel: result.fromLevel, toLevel: result.toLevel });
                }
              },
            });
            notify({ type: "xp", title: `+${task.xp} XP`, subtitle: task.title });

            if (completedCount + 1 === operation.tasks.length) {
              setTimeout(() => {
                notify({
                  type: "quest_complete",
                  title: "QUEST COMPLETE",
                  subtitle: `${operation.displayName} \u2014 All objectives cleared`,
                });
              }, 800);
            }
          }
        },
      },
    );
  };

  if (operation.tasks.length === 0) return null;

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(500)}>
      <View style={styles.card}>
        {/* Top glow line */}
        <View style={styles.glowLine} />

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.questKicker}>DAILY QUEST</Text>
            <Text style={styles.questName}>{operation.displayName}</Text>
          </View>
          <View style={styles.xpBadge}>
            <Text style={styles.xpText}>{earnedXp}/{totalXp} XP</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${operation.tasks.length > 0 ? (completedCount / operation.tasks.length) * 100 : 0}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {completedCount}/{operation.tasks.length} OBJECTIVES CLEARED
        </Text>

        {/* Protocol message */}
        <Text style={styles.protocolMsg}>{operation.protocolMessage}</Text>

        {/* Objectives */}
        <View style={styles.objectives}>
          {operation.tasks.map((task, i) => {
            const done = completedIds.has(task.id);
            return (
              <Pressable
                key={task.id}
                style={[styles.objective, done && styles.objectiveDone]}
                onPress={() => handleToggleTask(task)}
              >
                {/* Checkbox */}
                <View style={[styles.checkbox, done && styles.checkboxDone]}>
                  {done && <Text style={styles.checkmark}>{"\u2713"}</Text>}
                </View>

                {/* Content */}
                <View style={styles.objContent}>
                  <View style={styles.objTop}>
                    <View style={[styles.objDot, { backgroundColor: ENGINE_COLORS[task.engine] }]} />
                    <Text style={[styles.objEngine, { color: ENGINE_COLORS[task.engine] }]}>
                      {ENGINE_LABELS[task.engine]}
                    </Text>
                    {task.isReassigned && (
                      <Text style={styles.reassigned}>RE-ASSIGNED</Text>
                    )}
                  </View>
                  <Text style={[styles.objTitle, done && styles.objTitleDone]}>
                    {task.title}
                  </Text>
                </View>

                {/* XP */}
                <Text style={[styles.objXp, done && styles.objXpDone]}>
                  +{task.xp}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {operation.consistency} CONSISTENCY {"\u00B7"} {operation.consistencyRate}%
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(0, 0, 10, 0.95)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    // Subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 6,
  },
  glowLine: {
    height: 2,
    backgroundColor: "rgba(247, 250, 255, 0.15)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  questKicker: {
    ...fonts.kicker,
    fontSize: 9,
    color: "rgba(233, 240, 255, 0.52)",
    letterSpacing: 3,
    marginBottom: 4,
  },
  questName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 1,
  },
  xpBadge: {
    borderWidth: 1,
    borderColor: "rgba(92, 201, 160, 0.30)",
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    backgroundColor: "rgba(92, 201, 160, 0.08)",
  },
  xpText: {
    ...fonts.mono,
    fontSize: 11,
    color: "#5cc9a0",
    fontWeight: "700",
  },

  // Progress
  progressTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: spacing.lg,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#5cc9a0",
    borderRadius: 2,
  },
  progressText: {
    ...fonts.kicker,
    fontSize: 9,
    color: "rgba(233, 240, 255, 0.52)",
    letterSpacing: 2,
    paddingHorizontal: spacing.lg,
    marginTop: 6,
    marginBottom: spacing.sm,
  },

  // Protocol message
  protocolMsg: {
    fontSize: 12,
    color: "rgba(233, 240, 255, 0.60)",
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    fontStyle: "italic",
  },

  // Objectives
  objectives: {
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  objective: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    gap: spacing.sm,
  },
  objectiveDone: {
    opacity: 0.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: {
    borderColor: "#5cc9a0",
    backgroundColor: "rgba(92, 201, 160, 0.15)",
  },
  checkmark: {
    fontSize: 12,
    fontWeight: "800",
    color: "#5cc9a0",
  },
  objContent: { flex: 1 },
  objTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  objDot: { width: 5, height: 5, borderRadius: 3 },
  objEngine: { ...fonts.kicker, fontSize: 8, letterSpacing: 1 },
  reassigned: { ...fonts.kicker, fontSize: 7, color: "#FBBF24", letterSpacing: 1, marginLeft: 4 },
  objTitle: { fontSize: 14, fontWeight: "500", color: colors.text },
  objTitleDone: { textDecorationLine: "line-through", color: colors.textMuted },
  objXp: { ...fonts.mono, fontSize: 12, color: "#5cc9a0", fontWeight: "600" },
  objXpDone: { color: colors.textMuted },

  // Footer
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.04)",
    marginTop: spacing.sm,
  },
  footerText: {
    ...fonts.kicker,
    fontSize: 8,
    color: "rgba(233, 240, 255, 0.40)",
    letterSpacing: 2,
  },
});
