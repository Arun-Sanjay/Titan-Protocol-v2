import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Panel } from "../../src/components/ui/Panel";
import { PageHeader } from "../../src/components/ui/PageHeader";
import { TitanProgress } from "../../src/components/ui/TitanProgress";

import {
  useAllTasks,
  useAllCompletionsForDate,
} from "../../src/hooks/queries/useTasks";
import { computeEngineScore } from "../../src/services/tasks";
import type { EngineKey } from "../../src/db/schema";
import { getTodayKey } from "../../src/lib/date";

import { colors, fonts, radius, spacing } from "../../src/theme";

type EngineMeta = {
  key: EngineKey;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
};

const ENGINE_META: readonly EngineMeta[] = [
  {
    key: "body",
    icon: "barbell-outline",
    title: "BODY",
    subtitle: "Strength · sleep · nutrition",
    color: colors.body,
  },
  {
    key: "mind",
    icon: "library-outline",
    title: "MIND",
    subtitle: "Focus · learning · reflection",
    color: colors.mind,
  },
  {
    key: "money",
    icon: "trending-up-outline",
    title: "MONEY",
    subtitle: "Earn · save · invest · build",
    color: colors.money,
  },
  {
    key: "charisma",
    icon: "people-outline",
    title: "GENERAL",
    subtitle: "Connection · presence · voice",
    color: colors.charisma,
  },
];

export default function EnginesScreen() {
  const router = useRouter();
  const today = getTodayKey();

  const { data: tasks } = useAllTasks();
  const { data: completions } = useAllCompletionsForDate(today);

  const activeTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.is_active),
    [tasks],
  );
  const completedSet = useMemo(
    () => new Set((completions ?? []).map((c) => c.task_id)),
    [completions],
  );

  const scores = useMemo(() => {
    const map = {} as Record<EngineKey, { score: number; total: number; done: number }>;
    for (const meta of ENGINE_META) {
      const engineTasks = activeTasks.filter((t) => t.engine === meta.key);
      const done = engineTasks.filter((t) => completedSet.has(t.id)).length;
      map[meta.key] = {
        score: computeEngineScore(activeTasks, completedSet, meta.key),
        total: engineTasks.length,
        done,
      };
    }
    return map;
  }, [activeTasks, completedSet]);

  const handlePress = useCallback(
    (engine: EngineKey) => {
      Haptics.selectionAsync();
      router.push(`/engine/${engine}`);
    },
    [router],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader
          kicker="FOUR ENGINES"
          title="Engines"
          subtitle="Tap any engine for its missions, history, and progress."
        />
        <View style={styles.grid}>
          {ENGINE_META.map((meta) => {
            const data = scores[meta.key];
            return (
              <Pressable
                key={meta.key}
                onPress={() => handlePress(meta.key)}
                style={({ pressed }) => [
                  styles.pressableCell,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Open ${meta.title} engine`}
              >
                <Panel style={styles.engineCard}>
                  <View style={styles.iconRow}>
                    <View
                      style={[
                        styles.iconBox,
                        { borderColor: meta.color },
                      ]}
                    >
                      <Ionicons name={meta.icon} size={20} color={meta.color} />
                    </View>
                    <Text style={[styles.engineScore, { color: meta.color }]}>
                      {data.score}
                    </Text>
                  </View>
                  <Text style={styles.engineTitle}>{meta.title}</Text>
                  <Text style={styles.engineSubtitle}>{meta.subtitle}</Text>
                  <View style={styles.progressWrap}>
                    <TitanProgress value={data.score} color={meta.color} />
                  </View>
                  <Text style={styles.engineMeta}>
                    {data.done} / {data.total} today
                  </Text>
                </Panel>
              </Pressable>
            );
          })}
        </View>
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },
  grid: {
    gap: spacing.md,
  },
  pressableCell: { width: "100%" },
  pressed: { opacity: 0.85 },
  engineCard: { gap: spacing.sm, padding: spacing.lg },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  engineScore: {
    ...fonts.title,
    fontSize: 32,
    letterSpacing: -0.5,
  },
  engineTitle: {
    ...fonts.kicker,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 2,
  },
  engineSubtitle: {
    ...fonts.body,
    color: colors.textSecondary,
    fontSize: 13,
  },
  progressWrap: { marginTop: spacing.xs },
  engineMeta: {
    ...fonts.small,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1,
  },
});
