import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Panel } from "../src/components/ui/Panel";
import { Skeleton } from "../src/components/ui/Skeleton";
import {
  useHabits,
  useHabitLogsForRange,
  useToggleHabit,
} from "../src/hooks/queries/useHabits";
import type { Habit } from "../src/services/habits";
import type { EngineKey } from "../src/db/schema";
import { addDays, getTodayKey } from "../src/lib/date";

import { colors, fonts, radius, spacing } from "../src/theme";

const ENGINE_COLOR: Record<EngineKey, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  charisma: colors.charisma,
};

const CHAIN_DAYS = 30;

export default function HabitsScreen() {
  const router = useRouter();
  const today = getTodayKey();
  const startKey = addDays(today, -(CHAIN_DAYS - 1));

  const { data: habits, isLoading: habitsLoading } = useHabits();
  const { data: logs } = useHabitLogsForRange(startKey, today);
  const toggleHabit = useToggleHabit();

  /**
   * Pre-compute: for each habit, the set of date_keys it was logged on
   * within the chain window. O(N) over logs once, indexed by habit_id.
   */
  const logsByHabit = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const log of logs ?? []) {
      if (!map[log.habit_id]) map[log.habit_id] = new Set();
      map[log.habit_id].add(log.date_key);
    }
    return map;
  }, [logs]);

  const handleToggle = useCallback(
    (habit: Habit) => {
      Haptics.selectionAsync();
      toggleHabit.mutate({ habit: { id: habit.id }, dateKey: today });
    },
    [toggleHabit, today],
  );

  const handleLongPress = useCallback(
    (habit: Habit) => {
      Alert.alert(habit.title, undefined, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete habit",
          style: "destructive",
          onPress: () => {
            // Note: useDeleteHabit lives in useHabits; M5 wiring will
            // add the destructive button. For M4, only toggle/log paths.
            Alert.alert("Coming in M5", "Habit deletion lands with Settings.");
          },
        },
      ]);
    },
    [],
  );

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
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>DAILY RHYTHM</Text>
            <Text style={styles.title}>Habits</Text>
          </View>
        </View>

        {habitsLoading ? (
          <View style={styles.list}>
            <Skeleton variant="card" height={120} />
            <Skeleton variant="card" height={120} />
            <Skeleton variant="card" height={120} />
          </View>
        ) : (habits ?? []).length === 0 ? (
          <Panel>
            <Text style={styles.emptyText}>
              No habits yet. Habit creation lands with Settings in M5; for
              now seed one via the web app.
            </Text>
          </Panel>
        ) : (
          <View style={styles.list}>
            {(habits ?? []).map((habit) => {
              const engine = habit.engine as EngineKey;
              const color = ENGINE_COLOR[engine] ?? colors.text;
              const loggedSet = logsByHabit[habit.id] ?? new Set<string>();
              const todayDone = loggedSet.has(today);

              return (
                <Pressable
                  key={habit.id}
                  onPress={() => handleToggle(habit)}
                  onLongPress={() => handleLongPress(habit)}
                  style={({ pressed }) => [
                    pressed && styles.pressed,
                  ]}
                >
                  <Panel style={styles.habitCard}>
                    <View style={styles.habitTopRow}>
                      <View style={styles.habitInfo}>
                        <Text style={styles.habitTitle}>
                          {habit.icon ?? "•"} {habit.title}
                        </Text>
                        <Text style={[styles.habitMeta, { color }]}>
                          {engine.toUpperCase()}
                          {habit.frequency ? ` · ${habit.frequency}` : ""}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.checkBox,
                          { borderColor: color },
                          todayDone && { backgroundColor: color },
                        ]}
                      >
                        {todayDone && (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={colors.bg}
                          />
                        )}
                      </View>
                    </View>

                    {/* 30-day chain */}
                    <View style={styles.chainRow}>
                      {Array.from({ length: CHAIN_DAYS }).map((_, i) => {
                        const dk = addDays(today, -(CHAIN_DAYS - 1 - i));
                        const done = loggedSet.has(dk);
                        return (
                          <View
                            key={`${habit.id}-${dk}`}
                            style={[
                              styles.chainCell,
                              done && {
                                backgroundColor: color,
                                opacity: 0.85,
                              },
                            ]}
                          />
                        );
                      })}
                    </View>

                    <View style={styles.statsRow}>
                      <Text style={styles.statsLabel}>
                        Best: {habit.best_chain ?? 0}
                      </Text>
                      <Text style={styles.statsLabel}>
                        Now: {habit.current_chain ?? 0}
                      </Text>
                    </View>
                  </Panel>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },
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
  pressed: { opacity: 0.7 },
  kicker: {
    ...fonts.kicker,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  title: {
    ...fonts.title,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  list: { gap: spacing.md },
  habitCard: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  habitTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  habitInfo: { flex: 1, gap: spacing.xs },
  habitTitle: {
    ...fonts.body,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  habitMeta: {
    ...fonts.kicker,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  checkBox: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  chainRow: {
    flexDirection: "row",
    gap: 2,
  },
  chainCell: {
    flex: 1,
    height: 16,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.xs,
  },
  statsLabel: {
    ...fonts.kicker,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  emptyText: {
    ...fonts.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingVertical: spacing.md,
  },
});
