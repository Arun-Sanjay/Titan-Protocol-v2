import React, { useEffect, useCallback, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "../../src/theme";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { DateNavigator } from "../../src/components/ui/DateNavigator";
import { PowerRing } from "../../src/components/ui/PowerRing";
import { getTodayKey } from "../../src/lib/date";
import { useEngineStore, selectTotalScore, selectAllTasksForDate, type TaskWithStatus } from "../../src/stores/useEngineStore";
import { useProfileStore, XP_REWARDS } from "../../src/stores/useProfileStore";
import { Pressable } from "react-native";

export default function CommandCenterScreen() {
  const router = useRouter();
  const [dateKey, setDateKey] = React.useState(getTodayKey());

  const loadAllEngines = useEngineStore((s) => s.loadAllEngines);
  const toggleTask = useEngineStore((s) => s.toggleTask);
  const storeTasks = useEngineStore((s) => s.tasks);
  const storeCompletions = useEngineStore((s) => s.completions);
  const scores = useEngineStore((s) => s.scores);
  const tasks = useMemo(() => selectAllTasksForDate(storeTasks, storeCompletions, dateKey), [storeTasks, storeCompletions, dateKey]);
  const totalScore = useMemo(() => selectTotalScore(scores, dateKey), [scores, dateKey]);
  const awardXP = useProfileStore((s) => s.awardXP);
  const updateStreak = useProfileStore((s) => s.updateStreak);

  useEffect(() => {
    loadAllEngines(dateKey);
  }, [dateKey]);

  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);

  const handleToggle = useCallback((task: TaskWithStatus) => {
    const completed = toggleTask(task.engine, task.id!, dateKey);
    if (completed) {
      const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
      awardXP(dateKey, "task_complete", xp);
      updateStreak(dateKey);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [dateKey]);

  const renderItem = useCallback(({ item }: { item: TaskWithStatus }) => (
    <MissionRow
      title={item.title}
      xp={item.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST}
      completed={item.completed}
      kind={item.kind}
      onToggle={() => handleToggle(item)}
    />
  ), [handleToggle]);

  const ListHeader = useMemo(() => (
    <>
      <DateNavigator dateKey={dateKey} onChange={setDateKey} />
      <View style={styles.ringWrap}>
        <PowerRing score={totalScore} size={140} strokeWidth={8} />
      </View>
      <SectionHeader title="All Missions" right={`${completedCount}/${tasks.length}`} />
      {tasks.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No tasks for this date</Text>
        </View>
      )}
    </>
  ), [dateKey, totalScore, completedCount, tasks.length]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Command Center</Text>
        <View style={{ width: 48 }} />
      </View>

      <FlashList
        data={tasks}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}

        ListHeaderComponent={ListHeader}
        ListFooterComponent={<View style={{ height: 100 }} />}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  backBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 24, color: colors.text },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  ringWrap: { alignItems: "center", marginVertical: spacing.lg },
  empty: { alignItems: "center", paddingVertical: spacing["4xl"] },
  emptyText: { fontSize: 16, color: colors.textSecondary },
});
