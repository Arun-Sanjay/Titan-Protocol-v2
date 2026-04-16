import React, { useEffect, useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, AppState, useWindowDimensions, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts } from "../../src/theme";
import { EngineCard } from "../../src/components/ui/EngineCard";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { Panel } from "../../src/components/ui/Panel";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { getTodayKey } from "../../src/lib/date";
// Wave 1: Cloud hooks replace legacy engine store
import { useQueryClient } from "@tanstack/react-query";
import { useAllTasks, useAllCompletionsForDate } from "../../src/hooks/queries/useTasks";
import { computeEngineScore, ENGINES, type EngineKey } from "../../src/services/tasks";
import { useModeStore, selectActiveEngines } from "../../src/stores/useModeStore";

export default function EnginesScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - spacing.lg * 2 - spacing.md) / 2;
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient]);
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
  const activeEngines = useMemo(
    () => selectActiveEngines(mode, focusEngines) as EngineKey[],
    [mode, focusEngines],
  );

  // Wave 1: Read from Supabase via React Query instead of MMKV stores.
  // computeEngineScore is the same pure function that HQ uses — both
  // screens now derive scores from the same cloud data source, so
  // they'll always agree.
  const { data: allTasks = [] } = useAllTasks();
  const { data: allCompletions = [] } = useAllCompletionsForDate(dateKey);

  const completedTaskIds = useMemo(
    () => new Set(allCompletions.map((c) => c.task_id)),
    [allCompletions],
  );

  const engineScores = useMemo(() => {
    const result: Record<EngineKey, number> = { body: 0, mind: 0, money: 0, charisma: 0 };
    for (const e of ENGINES) {
      const engineTasks = allTasks.filter((t) => t.engine === e);
      result[e] = computeEngineScore(engineTasks, completedTaskIds);
    }
    return result;
  }, [allTasks, completedTaskIds]);

  const totalScore = useMemo(() => {
    const configured = ENGINES.filter((e) => allTasks.some((t) => t.engine === e));
    if (configured.length === 0) return 0;
    return Math.round(configured.reduce((sum, e) => sum + engineScores[e], 0) / configured.length);
  }, [allTasks, engineScores]);

  const allTasksWithStatus = useMemo(
    () => allTasks.map((t) => ({ ...t, completed: completedTaskIds.has(t.id) })),
    [allTasks, completedTaskIds],
  );
  const completedCount = allTasksWithStatus.filter((t) => t.completed).length;

  const engineCounts = useCallback(
    (engine: EngineKey) => {
      const et = allTasks.filter((t) => t.engine === engine);
      const completed = et.filter((t) => completedTaskIds.has(t.id)).length;
      return { completed, total: et.length };
    },
    [allTasks, completedTaskIds],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HUDBackground />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.textSecondary} />}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>ENGINES</Text>
          <View style={{ width: 34 }} />
        </View>

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
                {completedCount}/{allTasksWithStatus.length} tasks done {"\u00B7"} {totalScore}% score
              </Text>
            </View>
            <View style={styles.commandCardRight}>
              <Text style={styles.commandArrow}>{"\u2192"}</Text>
            </View>
          </View>
        </Panel>

        <SectionHeader title="Core Engines" />
        <View style={styles.grid}>
          {activeEngines.map((engine) => {
            const c = engineCounts(engine);
            return (
              <View key={engine} style={{ width: cardWidth }}>
                <EngineCard
                  engine={engine}
                  score={engineScores[engine]}
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg },
  backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.surfaceBorder },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  commandCard: { marginBottom: spacing.lg },
  commandCardInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  commandCardLeft: { flex: 1 },
  commandKicker: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: 4 },
  commandTitle: { fontSize: 18, fontWeight: "700", color: colors.text, letterSpacing: 0.5 },
  commandSubtitle: { ...fonts.mono, fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  commandCardRight: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  commandArrow: { fontSize: 18, color: colors.text },
});
