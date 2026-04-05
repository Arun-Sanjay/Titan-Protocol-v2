/**
 * OperationBriefing — Reusable mission assignment screen.
 *
 * Shows the generated daily operation with actual tasks from the user's engines.
 * Used by ALL Day 2+ cinematics after the Protocol speech phase.
 */

import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { useProfileStore } from "../../../stores/useProfileStore";
import { generateDailyOperation, type DailyOperation } from "../../../lib/operation-engine";
import {
  playVoiceLineAsync,
  stopCurrentAudio,
  getOperationVoiceId,
} from "../../../lib/protocol-audio";

const ENGINE_COLORS: Record<string, string> = {
  body: colors.body, mind: colors.mind, money: colors.money, charisma: colors.charisma,
};
const ENGINE_LABELS: Record<string, string> = {
  body: "BODY", mind: "MIND", money: "MONEY", charisma: "CHARISMA",
};

type Props = {
  dayNumber: number;
  onAccept: () => void;
  /** Override operation name (e.g., "SYSTEMS CHECK" for Day 2) */
  operationName?: string;
  /** Override subtitle */
  operationSubtitle?: string;
  /** Custom note below tasks */
  note?: string;
  /** Button text override */
  buttonText?: string;
  /** Accent color override */
  accentColor?: string;
};

export function OperationBriefing({
  dayNumber,
  onAccept,
  operationName,
  operationSubtitle,
  note,
  buttonText = "ACCEPT OPERATION",
  accentColor,
}: Props) {
  const userName = useStoryStore((s) => s.userName) || "Recruit";
  const storyAct = useStoryStore((s) => s.currentAct);
  const streak = useProfileStore((s) => s.profile.streak);

  // Generate the operation with real tasks
  const operation = useMemo(
    () => generateDailyOperation(userName, dayNumber, streak, storyAct),
    [userName, dayNumber, streak, storyAct],
  );

  const displayName = operationName ?? operation.displayName;
  const displaySubtitle = operationSubtitle ?? operation.subtitle;
  const accent = accentColor ?? "#FBBF24";

  // Play operation voice line synced with header fade-in (200ms delay + 500ms duration)
  useEffect(() => {
    const timer = setTimeout(() => {
      playVoiceLineAsync(getOperationVoiceId(operation.name));
    }, 800);
    return () => {
      clearTimeout(timer);
      stopCurrentAudio();
    };
  }, [operation.name]);

  const handleAccept = () => {
    stopCurrentAudio();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAccept();
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Operation header */}
      <Animated.View entering={FadeIn.delay(200).duration(500)}>
        <Text style={[styles.operationKicker, { color: accent }]}>
          OPERATION
        </Text>
        <Text style={styles.operationName}>{displayName}</Text>
        <Text style={styles.operationSubtitle}>{displaySubtitle}</Text>
      </Animated.View>

      {/* Protocol message */}
      <Animated.View entering={FadeIn.delay(600).duration(400)}>
        <Text style={styles.protocolMessage}>{operation.protocolMessage}</Text>
      </Animated.View>

      {/* Stats bar */}
      <Animated.View entering={FadeIn.delay(800).duration(400)} style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statText}>{operation.taskCount} TASKS</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statText}>{operation.consistencyRate}% CONSISTENCY</Text>
        </View>
        {operation.weakEngine && (
          <View style={[styles.statPill, { borderColor: "#de6b7d40" }]}>
            <Text style={[styles.statText, { color: "#de6b7d" }]}>
              {ENGINE_LABELS[operation.weakEngine]} WEAK
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Task list */}
      <Animated.View entering={FadeInDown.delay(1000).duration(400)}>
        <Text style={styles.tasksHeader}>ASSIGNED OBJECTIVES</Text>

        {operation.tasks.map((task, i) => (
          <Animated.View
            key={task.id}
            entering={FadeInDown.delay(1200 + i * 120).duration(300)}
            style={[styles.taskCard, { borderLeftColor: ENGINE_COLORS[task.engine] }]}
          >
            <View style={styles.taskTop}>
              <View style={[styles.taskDot, { backgroundColor: ENGINE_COLORS[task.engine] }]} />
              <Text style={[styles.taskEngine, { color: ENGINE_COLORS[task.engine] }]}>
                {ENGINE_LABELS[task.engine]}
              </Text>
              <Text style={styles.taskKind}>
                {task.kind === "main" ? "MISSION" : "SIDE QUEST"}
              </Text>
              <Text style={styles.taskXp}>+{task.xp} XP</Text>
            </View>
            <Text style={styles.taskTitle}>{task.title}</Text>
            {task.isReassigned && (
              <Text style={styles.taskReassigned}>RE-ASSIGNED — skipped yesterday</Text>
            )}
          </Animated.View>
        ))}

        {operation.tasks.length === 0 && (
          <View style={styles.noTasks}>
            <Text style={styles.noTasksText}>
              No tasks configured. Add tasks to your engines first.
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Note */}
      {note && (
        <Animated.View entering={FadeIn.delay(1800).duration(400)} style={styles.noteCard}>
          <Text style={styles.noteText}>{note}</Text>
        </Animated.View>
      )}

      {/* Accept button */}
      <Animated.View entering={FadeIn.delay(2000).duration(400)} style={styles.footer}>
        <Pressable style={[styles.acceptBtn, { backgroundColor: accent }]} onPress={handleAccept}>
          <Text style={styles.acceptBtnText}>{buttonText}</Text>
        </Pressable>
        <Text style={styles.timerText}>24:00:00 REMAINING</Text>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
    paddingBottom: spacing["3xl"],
  },

  // Header
  operationKicker: {
    ...fonts.kicker,
    fontSize: 10,
    letterSpacing: 4,
    marginBottom: spacing.xs,
  },
  operationName: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 2,
    marginBottom: 4,
  },
  operationSubtitle: {
    fontSize: 13,
    fontStyle: "italic",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },

  // Protocol message
  protocolMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statPill: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  statText: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1.5,
  },

  // Tasks
  tasksHeader: {
    ...fonts.kicker,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 3,
    marginBottom: spacing.md,
  },
  taskCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderLeftWidth: 3,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  taskTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 4,
  },
  taskDot: { width: 6, height: 6, borderRadius: 3 },
  taskEngine: { ...fonts.kicker, fontSize: 9, letterSpacing: 1 },
  taskKind: { ...fonts.kicker, fontSize: 8, color: colors.textMuted, letterSpacing: 1, flex: 1 },
  taskXp: { ...fonts.mono, fontSize: 11, color: "#5cc9a0" },
  taskTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  taskReassigned: {
    ...fonts.kicker, fontSize: 8, color: "#FBBF24", letterSpacing: 1, marginTop: 4,
  },

  noTasks: {
    padding: spacing.xl,
    alignItems: "center",
  },
  noTasksText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },

  // Note
  noteCard: {
    backgroundColor: "rgba(251,191,36,0.08)",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.20)",
    padding: spacing.md,
    marginTop: spacing.md,
  },
  noteText: {
    fontSize: 12,
    color: "#FBBF24",
    lineHeight: 18,
  },

  // Footer
  footer: {
    marginTop: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  acceptBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["3xl"],
    alignItems: "center",
    width: "100%",
  },
  acceptBtnText: {
    ...fonts.kicker,
    fontSize: 14,
    color: "#000",
    letterSpacing: 3,
    fontWeight: "800",
  },
  timerText: {
    ...fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
  },
});
