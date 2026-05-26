import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Panel } from "../src/components/ui/Panel";
import { SparklineChart } from "../src/components/ui/SparklineChart";
import { TitanProgress } from "../src/components/ui/TitanProgress";
import {
  useAllTasks,
  useRecentCompletionMap,
} from "../src/hooks/queries/useTasks";
import { computeEngineScore } from "../src/services/tasks";
import type { EngineKey } from "../src/db/schema";
import { addDays, getTodayKey } from "../src/lib/date";

import { colors, fonts, spacing } from "../src/theme";

const ENGINES: { key: EngineKey; label: string; color: string }[] = [
  { key: "body", label: "BODY", color: colors.body },
  { key: "mind", label: "MIND", color: colors.mind },
  { key: "money", label: "MONEY", color: colors.money },
  { key: "charisma", label: "GENERAL", color: colors.charisma },
];

export default function AnalyticsScreen() {
  const router = useRouter();
  const today = getTodayKey();

  const { data: tasks } = useAllTasks();
  const { data: recent } = useRecentCompletionMap();

  const activeTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.is_active),
    [tasks],
  );

  /**
   * Per-day per-engine score for the last 30 days. Computed from
   * useRecentCompletionMap (taskId → date_keys[]). Each cell:
   * sum of engine-completed tasks that day / total engine tasks * 100.
   */
  const engineTrends = useMemo(() => {
    const map = {} as Record<EngineKey, number[]>;
    for (const e of ENGINES) {
      const arr: number[] = [];
      const engineTasks = activeTasks.filter((t) => t.engine === e.key);
      const engineTaskIds = new Set(engineTasks.map((t) => t.id));
      for (let i = 29; i >= 0; i--) {
        const dateKey = addDays(today, -i);
        if (!recent || engineTasks.length === 0) {
          arr.push(0);
          continue;
        }
        let done = 0;
        for (const [taskId, dates] of Object.entries(recent)) {
          if (engineTaskIds.has(taskId) && dates.includes(dateKey)) done++;
        }
        arr.push(Math.round((done / engineTasks.length) * 100));
      }
      map[e.key] = arr;
    }
    return map;
  }, [activeTasks, recent, today]);

  /**
   * This-week daily Titan Scores (Mon → Sun, week-to-date). Each
   * day's score = average of the 4 engine scores for that day.
   */
  const week = useMemo(() => {
    const todayDate = new Date(today + "T00:00:00");
    const dayOfWeek = todayDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const days: { dateKey: string; label: string; score: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const dateKey = addDays(today, mondayOffset + i);
      const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      let scoreSum = 0;
      let scoreCount = 0;
      for (const e of ENGINES) {
        const eScores = engineTrends[e.key];
        const idx = 29 - i; // engineTrends is reverse-chronological? actually it's oldest→newest over 30 days
        // Map dateKey index against today: position from end
        // We need to find the engineTrends index for dateKey.
        // engineTrends index 0 = 29 days ago, index 29 = today
        const distFromToday = Math.round(
          (new Date(today + "T00:00:00").getTime() -
            new Date(dateKey + "T00:00:00").getTime()) /
            (24 * 3600 * 1000),
        );
        if (distFromToday < 0 || distFromToday > 29) continue;
        const trendIdx = 29 - distFromToday;
        scoreSum += eScores[trendIdx] ?? 0;
        scoreCount += 1;
        void idx;
      }
      const avg = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;
      days.push({ dateKey, label: labels[i], score: avg });
    }
    return days;
  }, [today, engineTrends]);

  const weekStats = useMemo(() => {
    const past = week.filter((d) => d.dateKey <= today);
    if (past.length === 0) return null;
    const avg = Math.round(
      past.reduce((s, d) => s + d.score, 0) / past.length,
    );
    let best = past[0];
    let worst = past[0];
    for (const d of past) {
      if (d.score > best.score) best = d;
      if (d.score < worst.score) worst = d;
    }
    return { avg, best, worst };
  }, [week, today]);

  /**
   * Task reliability: per active task, fraction of last-30-days the task
   * was completed (out of days the task could have been done — for v1 we
   * use a flat 30 denominator, which is fine for the relative ranking).
   */
  const reliability = useMemo(() => {
    if (!recent) return [];
    return activeTasks
      .map((t) => {
        const dates = recent[t.id] ?? [];
        const pct = Math.round((dates.length / 30) * 100);
        return { taskId: t.id, title: t.title, engine: t.engine, pct };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);
  }, [activeTasks, recent]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>INSIGHTS</Text>
            <Text style={styles.title}>Analytics</Text>
          </View>
        </View>

        {/* This week */}
        <Section title="THIS WEEK">
          {weekStats ? (
            <Panel style={styles.weekPanel}>
              <View style={styles.weekRow}>
                <Text style={styles.weekLabel}>AVG SCORE</Text>
                <Text style={styles.weekValue}>{weekStats.avg}</Text>
              </View>
              <Divider />
              <View style={styles.weekRow}>
                <Text style={styles.weekLabel}>BEST DAY</Text>
                <Text style={styles.weekValue}>
                  {weekStats.best.label} · {weekStats.best.score}
                </Text>
              </View>
              <Divider />
              <View style={styles.weekRow}>
                <Text style={styles.weekLabel}>WORST DAY</Text>
                <Text style={styles.weekValue}>
                  {weekStats.worst.label} · {weekStats.worst.score}
                </Text>
              </View>
            </Panel>
          ) : (
            <Panel>
              <Text style={styles.emptyText}>Run a few days to populate.</Text>
            </Panel>
          )}
        </Section>

        {/* Engine trend */}
        <Section title="ENGINE TREND · 30 DAYS">
          <Panel style={styles.trendPanel}>
            {ENGINES.map((e) => (
              <View key={e.key} style={styles.trendRow}>
                <Text style={[styles.trendLabel, { color: e.color }]}>
                  {e.label}
                </Text>
                <SparklineChart
                  data={engineTrends[e.key]}
                  width={220}
                  height={32}
                  color={e.color}
                />
              </View>
            ))}
          </Panel>
        </Section>

        {/* Task reliability */}
        <Section title="TASK RELIABILITY · 30D">
          {reliability.length === 0 ? (
            <Panel>
              <Text style={styles.emptyText}>
                No active tasks yet. Add some on the Track tab.
              </Text>
            </Panel>
          ) : (
            <Panel style={styles.reliabilityPanel}>
              {reliability.map((r, i) => (
                <View
                  key={r.taskId}
                  style={[styles.reliabilityRow, i > 0 && styles.rowSpaced]}
                >
                  <View style={styles.reliabilityHead}>
                    <Text style={styles.reliabilityTitle} numberOfLines={1}>
                      {r.title}
                    </Text>
                    <Text style={styles.reliabilityPct}>{r.pct}%</Text>
                  </View>
                  <TitanProgress
                    value={r.pct}
                    color={
                      ENGINES.find((e) => e.key === r.engine)?.color ??
                      colors.accent
                    }
                  />
                </View>
              ))}
            </Panel>
          )}
        </Section>

        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },
  pressed: { opacity: 0.7 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerText: { flex: 1, gap: spacing.xs },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: { ...fonts.kicker, color: colors.textMuted, letterSpacing: 2 },
  title: { ...fonts.title, fontSize: 28, letterSpacing: -0.5 },

  section: { gap: spacing.sm },
  sectionTitle: {
    ...fonts.kicker,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 2,
  },

  weekPanel: { padding: spacing.lg, gap: spacing.xs },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  weekLabel: { ...fonts.kicker, color: colors.textMuted, fontSize: 10, letterSpacing: 1.5 },
  weekValue: { ...fonts.body, color: colors.text, fontSize: 15, fontWeight: "600" },
  divider: { height: 1, backgroundColor: colors.panelBorder, marginVertical: spacing.xs },

  trendPanel: { padding: spacing.md, gap: spacing.sm },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  trendLabel: {
    ...fonts.kicker,
    fontSize: 11,
    letterSpacing: 1.5,
    minWidth: 70,
  },

  reliabilityPanel: { padding: spacing.md },
  reliabilityRow: { gap: spacing.xs },
  rowSpaced: { marginTop: spacing.md },
  reliabilityHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reliabilityTitle: { ...fonts.body, color: colors.text, fontSize: 13, flex: 1 },
  reliabilityPct: { ...fonts.kicker, color: colors.textMuted, fontSize: 11, letterSpacing: 1 },

  emptyText: {
    ...fonts.body,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
});
