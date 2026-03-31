import React, { useEffect, useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, AppState, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, fonts, shadows } from "../../src/theme";
import { EngineCard } from "../../src/components/ui/EngineCard";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { PageHeader } from "../../src/components/ui/PageHeader";
import { Panel } from "../../src/components/ui/Panel";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { getTodayKey } from "../../src/lib/date";
import { useEngineStore, selectTotalScore, selectAllTasksForDate } from "../../src/stores/useEngineStore";
import { useModeStore, selectActiveEngines } from "../../src/stores/useModeStore";
import type { EngineKey } from "../../src/db/schema";

const ALL_ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

export default function EnginesScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - spacing.lg * 2 - spacing.md) / 2;
  const [appActive, setAppActive] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setAppActive((c) => c + 1);
    });
    return () => sub.remove();
  }, []);
  const dateKey = useMemo(() => getTodayKey(), [appActive]);

  const mode = useModeStore((s) => s.mode);
  const focusEngines = useModeStore((s) => s.focusEngines);
  const ENGINES = useMemo(() => selectActiveEngines(mode, focusEngines) as EngineKey[], [mode, focusEngines]);

  const loadAllEngines = useEngineStore((s) => s.loadAllEngines);
  const scores = useEngineStore((s) => s.scores);
  const tasks = useEngineStore((s) => s.tasks);
  const completions = useEngineStore((s) => s.completions);

  useEffect(() => {
    loadAllEngines(dateKey);
  }, [dateKey]);

  const allTasks = useMemo(
    () => selectAllTasksForDate(tasks, completions, dateKey),
    [tasks, completions, dateKey],
  );
  const totalScore = useMemo(
    () => selectTotalScore(scores, dateKey),
    [scores, dateKey],
  );
  const completedCount = useMemo(
    () => allTasks.filter((t) => t.completed).length,
    [allTasks],
  );

  const engineCounts = useCallback((engine: EngineKey) => {
    const et = tasks[engine] ?? [];
    const cIds = new Set(completions[`${engine}:${dateKey}`] ?? []);
    return { completed: et.filter((t) => cIds.has(t.id!)).length, total: et.length };
  }, [tasks, completions, dateKey]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HUDBackground />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader kicker="SYSTEM // ENGINES" title="Engines" subtitle="Your life operating system" />

        {/* Command Centre Card */}
        <Panel
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/hub/command");
          }}
          style={styles.commandCard}
          tone="hero"
          delay={50}
        >
          <View style={styles.commandCardInner}>
            <View style={styles.commandCardLeft}>
              <Text style={styles.commandKicker}>ALL ENGINES</Text>
              <Text style={styles.commandTitle}>Command Centre</Text>
              <Text style={styles.commandSubtitle}>
                {completedCount}/{allTasks.length} tasks done {"\u00B7"} {totalScore}% score
              </Text>
            </View>
            <View style={styles.commandCardRight}>
              <Text style={styles.commandArrow}>{"\u2192"}</Text>
            </View>
          </View>
        </Panel>

        <SectionHeader title="Core Engines" />
        <View style={styles.grid}>
          {ENGINES.map((engine) => {
            const c = engineCounts(engine);
            return (
              <View key={engine} style={{ width: cardWidth }}>
                <EngineCard
                  engine={engine}
                  score={scores[`${engine}:${dateKey}`] ?? 0}
                  completedCount={c.completed}
                  totalCount={c.total}
                  onPress={() => router.push(`/engine/${engine}`)}
                />
              </View>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },

  // Command Centre card
  commandCard: {
    marginBottom: spacing.lg,
  },
  commandCardInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commandCardLeft: {
    flex: 1,
  },
  commandKicker: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 4,
  },
  commandTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 0.5,
  },
  commandSubtitle: {
    ...fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  commandCardRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  commandArrow: {
    fontSize: 18,
    color: colors.text,
  },
});
