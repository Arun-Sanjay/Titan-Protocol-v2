import React, { useEffect, useCallback, useMemo } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../../src/theme";
import { EngineCard } from "../../src/components/ui/EngineCard";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { PageHeader } from "../../src/components/ui/PageHeader";
import { getTodayKey } from "../../src/lib/date";
import { useEngineStore } from "../../src/stores/useEngineStore";
import type { EngineKey } from "../../src/db/schema";

const ENGINES: EngineKey[] = ["body", "mind", "money", "general"];

export default function EnginesScreen() {
  const router = useRouter();
  const dateKey = getTodayKey();

  const loadAllEngines = useEngineStore((s) => s.loadAllEngines);
  const scores = useEngineStore((s) => s.scores);
  const tasks = useEngineStore((s) => s.tasks);
  const completions = useEngineStore((s) => s.completions);

  useEffect(() => {
    loadAllEngines(dateKey);
  }, [dateKey]);

  const engineCounts = useCallback((engine: EngineKey) => {
    const et = tasks[engine] ?? [];
    const cIds = new Set(completions[`${engine}:${dateKey}`] ?? []);
    return { completed: et.filter((t) => cIds.has(t.id!)).length, total: et.length };
  }, [tasks, completions, dateKey]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader kicker="SYSTEM // ENGINES" title="Engines" subtitle="Your life operating system" />

        <SectionHeader title="Core Engines" />
        <View style={styles.grid}>
          {ENGINES.map((engine) => {
            const c = engineCounts(engine);
            return (
              <EngineCard
                key={engine}
                engine={engine}
                score={scores[`${engine}:${dateKey}`] ?? 0}
                completedCount={c.completed}
                totalCount={c.total}
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
});
