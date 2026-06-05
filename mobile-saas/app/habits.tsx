import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ScreenHeader } from "../src/components/ui/ScreenHeader";
import { Panel } from "../src/components/ui/Panel";
import { Skeleton } from "../src/components/ui/Skeleton";
import { HabitGrid } from "../src/components/ui/HabitGrid";
import { EditorSheet } from "../src/components/ui/EditorSheet";
import { FieldInput } from "../src/components/ui/FieldInput";
import { FieldSelectRow } from "../src/components/ui/FieldSelectRow";
import { EngineFilterTabs, type EngineFilter } from "../src/components/ui/EngineFilterTabs";

import {
  useHabits,
  useHabitLogsForRange,
  useToggleHabit,
  useCreateHabit,
  useDeleteHabit,
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

const ENGINE_OPTIONS = [
  { value: "body", label: "BODY", color: colors.body },
  { value: "mind", label: "MIND", color: colors.mind },
  { value: "money", label: "MONEY", color: colors.money },
  { value: "charisma", label: "GENERAL", color: colors.charisma },
];

const CHAIN_DAYS = 28;
const RANGE_DAYS = 56; // 8 weeks for the aggregate grid

export default function HabitsScreen() {
  const today = getTodayKey();
  const startKey = addDays(today, -(RANGE_DAYS - 1));

  const { data: habits, isLoading: habitsLoading } = useHabits();
  const { data: logs } = useHabitLogsForRange(startKey, today);
  const toggleHabit = useToggleHabit();
  const createHabit = useCreateHabit();
  const deleteHabit = useDeleteHabit();

  const [filter, setFilter] = useState<EngineFilter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newEngine, setNewEngine] = useState<EngineKey>("body");
  const [newIcon, setNewIcon] = useState("");

  const logsByHabit = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const log of logs ?? []) {
      if (!map[log.habit_id]) map[log.habit_id] = new Set();
      map[log.habit_id].add(log.date_key);
    }
    return map;
  }, [logs]);

  const allHabits = habits ?? [];

  // Aggregate activity: count of habits logged per day across the range.
  const aggregateCells = useMemo(() => {
    const byDate: Record<string, number> = {};
    for (const log of logs ?? []) byDate[log.date_key] = (byDate[log.date_key] ?? 0) + 1;
    const max = Math.max(1, allHabits.length);
    return Object.entries(byDate).map(([dateKey, count]) => ({ dateKey, count, max }));
  }, [logs, allHabits.length]);

  const todayDoneCount = useMemo(
    () => allHabits.filter((h) => logsByHabit[h.id]?.has(today)).length,
    [allHabits, logsByHabit, today],
  );

  const visibleHabits = useMemo(
    () => (filter === "all" ? allHabits : allHabits.filter((h) => h.engine === filter)),
    [allHabits, filter],
  );

  const handleToggle = useCallback(
    (habit: Habit) => {
      Haptics.selectionAsync();
      toggleHabit.mutate({ habit: { id: habit.id }, dateKey: today });
    },
    [toggleHabit, today],
  );

  const handleLongPress = useCallback(
    (habit: Habit) => {
      Alert.alert(habit.title, "Remove this habit?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            deleteHabit.mutate(habit.id);
          },
        },
      ]);
    },
    [deleteHabit],
  );

  const openSheet = useCallback(() => {
    setNewTitle("");
    setNewEngine(filter !== "all" ? (filter as EngineKey) : "body");
    setNewIcon("");
    setSheetOpen(true);
  }, [filter]);

  const handleCreate = useCallback(async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) {
      Alert.alert("Missing title", "Give the habit a name.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await createHabit.mutateAsync({
        title: trimmed,
        engine: newEngine,
        icon: newIcon.trim() || undefined,
      });
      setSheetOpen(false);
    } catch {
      Alert.alert("Save failed", "Could not create the habit.");
    }
  }, [newTitle, newEngine, newIcon, createHabit]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          kicker="Daily Rhythm"
          title="Habits"
          subtitle={
            allHabits.length > 0
              ? `${todayDoneCount} of ${allHabits.length} completed today`
              : "Build a chain. Don't break it."
          }
          rightSlot={
            <Pressable onPress={openSheet} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
              <Ionicons name="add" size={22} color={colors.text} />
            </Pressable>
          }
        />

        {allHabits.length > 0 && (
          <>
            <Panel>
              <Text style={styles.panelKicker}>Activity · Last 8 weeks</Text>
              <HabitGrid cells={aggregateCells} weeks={8} color={colors.primary} />
            </Panel>
            <EngineFilterTabs value={filter} onChange={setFilter} />
          </>
        )}

        {habitsLoading ? (
          <View style={styles.list}>
            <Skeleton variant="card" height={120} />
            <Skeleton variant="card" height={120} />
          </View>
        ) : allHabits.length === 0 ? (
          <Panel>
            <Text style={styles.emptyText}>No habits yet. Tap + to create your first.</Text>
          </Panel>
        ) : (
          <View style={styles.list}>
            {visibleHabits.map((habit) => {
              const engine = habit.engine as EngineKey;
              const color = ENGINE_COLOR[engine] ?? colors.text;
              const loggedSet = logsByHabit[habit.id] ?? new Set<string>();
              const todayDone = loggedSet.has(today);

              return (
                <Pressable
                  key={habit.id}
                  onPress={() => handleToggle(habit)}
                  onLongPress={() => handleLongPress(habit)}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Panel tone="subtle" style={styles.habitCard}>
                    <View style={styles.habitTopRow}>
                      <View style={styles.habitInfo}>
                        <Text style={styles.habitTitle}>
                          {habit.icon ? `${habit.icon} ` : ""}
                          {habit.title}
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
                        {todayDone && <Ionicons name="checkmark" size={16} color={colors.bg} />}
                      </View>
                    </View>

                    <View style={styles.chainRow}>
                      {Array.from({ length: CHAIN_DAYS }).map((_, i) => {
                        const dk = addDays(today, -(CHAIN_DAYS - 1 - i));
                        const done = loggedSet.has(dk);
                        return (
                          <View
                            key={`${habit.id}-${dk}`}
                            style={[styles.chainCell, done && { backgroundColor: color, opacity: 0.85 }]}
                          />
                        );
                      })}
                    </View>

                    <View style={styles.statsRow}>
                      <Text style={styles.statsLabel}>Best: {habit.best_chain ?? 0}</Text>
                      <Text style={styles.statsLabel}>Now: {habit.current_chain ?? 0}</Text>
                    </View>
                  </Panel>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>

      <EditorSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="New Habit"
        primaryLabel="CREATE"
        onPrimary={handleCreate}
        primaryBusy={createHabit.isPending}
      >
        <FieldInput
          label="TITLE"
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="e.g. Read 20 minutes"
          autoFocus
        />
        <FieldSelectRow
          label="ENGINE"
          options={ENGINE_OPTIONS}
          value={newEngine}
          onChange={(v) => setNewEngine(v as EngineKey)}
        />
        <FieldInput
          label="ICON (OPTIONAL)"
          value={newIcon}
          onChangeText={setNewIcon}
          placeholder="📚"
          maxLength={2}
        />
      </EditorSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },
  pressed: { opacity: 0.7 },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  panelKicker: { ...fonts.kicker, color: colors.textMuted, letterSpacing: 2, marginBottom: spacing.md },
  list: { gap: spacing.md },
  habitCard: { padding: spacing.lg, gap: spacing.sm },
  habitTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  habitInfo: { flex: 1, gap: spacing.xs },
  habitTitle: { ...fonts.body, color: colors.text, fontSize: 15, fontWeight: "600" },
  habitMeta: { ...fonts.kicker, fontSize: 10, letterSpacing: 1.5 },
  checkBox: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  chainRow: { flexDirection: "row", gap: 2 },
  chainCell: {
    flex: 1,
    height: 16,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  statsRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: spacing.xs },
  statsLabel: { ...fonts.kicker, fontSize: 10, color: colors.textMuted, letterSpacing: 1.5 },
  emptyText: {
    ...fonts.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingVertical: spacing.md,
  },
});
