import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../../src/theme";
import { EngineCard } from "../../src/components/ui/EngineCard";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { getTodayKey } from "../../src/lib/date";
import { getAllEngineScores, getAllTasksForDate, type TaskWithStatus } from "../../src/db/engine";
import type { EngineKey } from "../../src/db/schema";

export default function EnginesScreen() {
  const router = useRouter();
  const dateKey = getTodayKey();

  const [scores, setScores] = useState<Record<EngineKey, number>>({
    body: 0, mind: 0, money: 0, general: 0,
  });
  const [tasks, setTasks] = useState<TaskWithStatus[]>([]);

  useFocusEffect(
    useCallback(() => {
      try {
        setScores(getAllEngineScores(dateKey));
        setTasks(getAllTasksForDate(dateKey));
      } catch (err) {
        console.error("[Engines] load failed:", err);
      }
    }, [dateKey])
  );

  const engineCounts = (engine: EngineKey) => {
    const et = tasks.filter((t) => t.engine === engine);
    return { completed: et.filter((t) => t.completed).length, total: et.length };
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Engines</Text>
        <Text style={styles.subtitle}>Your life operating system</Text>

        <SectionHeader title="Core Engines" />
        <View style={styles.grid}>
          {(["body", "mind", "money", "general"] as EngineKey[]).map((engine) => {
            const c = engineCounts(engine);
            return (
              <EngineCard
                key={engine} engine={engine} score={scores[engine]}
                completedCount={c.completed} totalCount={c.total}
                onPress={() => router.push(`/engine/${engine}`)}
              />
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
  title: { fontSize: 28, fontWeight: "800", color: colors.text, marginTop: spacing.lg },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
});
