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
import { useProfileStore } from "../../stores/useProfileStore";
import { useEngineStore, ENGINES } from "../../stores/useEngineStore";
import { getDayNumber } from "../../data/chapters";
import { getJSON } from "../../db/storage";
import { getTodayKey } from "../../lib/date";
import type { EngineKey } from "../../db/schema";

const ENGINE_LABELS: Record<EngineKey, string> = {
  body: "Body", mind: "Mind", money: "Money", charisma: "Charisma",
};

type Props = {
  delay?: number;
};

export function SystemVoice({ delay = 0 }: Props) {
  const userName = useStoryStore((s) => s.userName) || "Recruit";
  const storyAct = useStoryStore((s) => s.currentAct);
  const streak = useProfileStore((s) => s.profile.streak);
  const scores = useEngineStore((s) => s.scores);

  const firstActiveDate = getJSON<string | null>("first_active_date", null);
  const dayNumber = getDayNumber(firstActiveDate);
  const today = getTodayKey();

  // Calculate engine scores for today
  const engineScores = useMemo(() => {
    const result: Record<EngineKey, number> = { body: 0, mind: 0, money: 0, charisma: 0 };
    for (const e of ENGINES) {
      result[e] = scores[`${e}:${today}`] ?? 0;
    }
    return result;
  }, [scores, today]);

  const titanScore = useMemo(() => {
    const vals = Object.values(engineScores);
    if (vals.every((v) => v === 0)) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / 4);
  }, [engineScores]);

  // Find weak and strong engines
  const weakEngine = useMemo(() => {
    let w: EngineKey = "body";
    let low = Infinity;
    for (const e of ENGINES) {
      if (engineScores[e] < low) { low = engineScores[e]; w = e; }
    }
    return w;
  }, [engineScores]);

  const strongEngine = useMemo(() => {
    let s: EngineKey = "body";
    let high = -1;
    for (const e of ENGINES) {
      if (engineScores[e] > high) { high = engineScores[e]; s = e; }
    }
    return s;
  }, [engineScores]);

  // Determine performance level
  const performance = titanScore >= 70 ? "high" : titanScore >= 40 ? "moderate" : "low";

  // Get message
  const message = useMemo(
    () => getDashboardMessage(
      userName, dayNumber, String(storyAct), performance,
      streak, titanScore,
      ENGINE_LABELS[weakEngine], ENGINE_LABELS[strongEngine],
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
