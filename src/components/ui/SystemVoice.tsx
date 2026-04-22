/**
 * SystemVoice — Protocol's floating message on the dashboard.
 *
 * A premium dark glass card that shows Protocol's daily message.
 * Feels like a system window floating over the interface.
 * Uses real performance data to generate contextual messages.
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors, spacing, fonts, radius } from "../../theme";
import { getDashboardMessage } from "../../data/protocol-messages";
import { useStoryStore } from "../../stores/useStoryStore";
import { useProfile } from "../../hooks/queries/useProfile";
import { useAllTasks, useAllCompletionsForDate } from "../../hooks/queries/useTasks";
import { computeEngineScore } from "../../services/tasks";
import { getDayNumber } from "../../data/chapters";
import { getJSON } from "../../db/storage";
import { getTodayKey } from "../../lib/date";
import type { EngineKey } from "../../db/schema";
import {
  ENGINES,
  buildEngineSnapshot,
  selectWeakEngine,
  selectStrongEngine,
} from "../../lib/engine-scores";

const ENGINE_LABELS: Record<EngineKey, string> = {
  body: "Body", mind: "Mind", money: "Money", charisma: "Charisma",
};

type Props = {
  delay?: number;
};

export function SystemVoice({ delay = 0 }: Props) {
  const userName = useStoryStore((s) => s.userName) || "Recruit";
  const storyAct = useStoryStore((s) => s.currentAct);
  const streak = useProfile().data?.streak_current ?? 0;

  const firstActiveDate = getJSON<string | null>("first_active_date", null);
  const dayNumber = getDayNumber(firstActiveDate);
  const today = getTodayKey();

  // SQLite-backed task + completion state. `useEngineStore` was the legacy
  // MMKV scoreboard; it's stale for anyone post-local-first migration, so
  // we compute scores from the authoritative SQLite store instead.
  const { data: tasks = [] } = useAllTasks();
  const { data: completions = [] } = useAllCompletionsForDate(today);

  const snapshot = useMemo(() => {
    const scores: Record<EngineKey, number> = { body: 0, mind: 0, money: 0, charisma: 0 };
    const taskCounts: Record<EngineKey, number> = { body: 0, mind: 0, money: 0, charisma: 0 };
    for (const engine of ENGINES) {
      const engineTasks = tasks.filter((t) => t.engine === engine && t.is_active);
      taskCounts[engine] = engineTasks.length;
      scores[engine] = computeEngineScore(tasks, completions, engine);
    }
    return buildEngineSnapshot({ scores, taskCounts });
  }, [tasks, completions]);

  const titanScore = useMemo(() => {
    const staffed = ENGINES.filter((e) => snapshot[e].taskCount > 0);
    if (staffed.length === 0) return 0;
    const sum = staffed.reduce((acc, e) => acc + snapshot[e].score, 0);
    return Math.round(sum / staffed.length);
  }, [snapshot]);

  // Null when there's no meaningful weak/strong — the template gracefully
  // falls back to "weakest"/"strongest" placeholders when we pass "".
  const weakEngine = useMemo(() => selectWeakEngine(snapshot), [snapshot]);
  const strongEngine = useMemo(() => selectStrongEngine(snapshot), [snapshot]);

  const performance = titanScore >= 70 ? "high" : titanScore >= 40 ? "moderate" : "low";

  const message = useMemo(
    () => getDashboardMessage(
      userName, dayNumber, String(storyAct), performance,
      streak, titanScore,
      weakEngine ? ENGINE_LABELS[weakEngine] : "",
      strongEngine ? ENGINE_LABELS[strongEngine] : "",
    ),
    [userName, dayNumber, storyAct, performance, streak, titanScore, weakEngine, strongEngine],
  );

  if (dayNumber <= 1) return null; // Day 1 has its own cinematic

  return (
    <Animated.View entering={FadeIn.delay(delay).duration(600)}>
      <View style={styles.container}>
        {/* Top accent */}
        <View style={styles.topLine} />

        <View style={styles.content}>
          {/* System badge */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>PROTOCOL</Text>
          </View>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(0, 0, 10, 0.92)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  topLine: {
    height: 1,
    backgroundColor: "rgba(247, 250, 255, 0.12)",
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    ...fonts.kicker,
    fontSize: 7,
    color: "rgba(233, 240, 255, 0.50)",
    letterSpacing: 2,
  },
  message: {
    fontSize: 13,
    color: "rgba(233, 240, 255, 0.75)",
    lineHeight: 20,
    fontStyle: "italic",
  },
});
