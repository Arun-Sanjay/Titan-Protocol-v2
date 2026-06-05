import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ScreenHeader } from "../src/components/ui/ScreenHeader";
import { Panel } from "../src/components/ui/Panel";
import { EditorSheet } from "../src/components/ui/EditorSheet";
import { FieldInput } from "../src/components/ui/FieldInput";
import { FieldSelectRow } from "../src/components/ui/FieldSelectRow";
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from "../src/hooks/queries/useGoals";
import type { Goal } from "../src/services/goals";
import { addDays, getTodayKey, formatDateShort } from "../src/lib/date";
import { logError } from "../src/lib/error-log";

import { colors, fonts, radius, spacing } from "../src/theme";

const DEADLINE_OPTIONS = [
  { value: "none", label: "NONE" },
  { value: "7", label: "7 DAYS" },
  { value: "30", label: "30 DAYS" },
  { value: "90", label: "90 DAYS" },
];

function countdownLabel(targetDate: string, today: string): string {
  const diff = Math.ceil(
    (new Date(targetDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86_400_000,
  );
  if (diff < 0) return "Expired";
  if (diff === 0) return "Due today";
  if (diff === 1) return "1 day left";
  return `${diff} days left`;
}

export default function GoalsScreen() {
  const today = getTodayKey();
  const { data: goals, isLoading } = useGoals();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDeadline, setDraftDeadline] = useState("none");

  const { active, completed } = useMemo(() => {
    const a: Goal[] = [];
    const c: Goal[] = [];
    for (const g of goals ?? []) {
      if (g.status === "completed") c.push(g);
      else a.push(g);
    }
    return { active: a, completed: c };
  }, [goals]);

  const openSheet = useCallback(() => {
    setDraftTitle("");
    setDraftDeadline("none");
    setSheetOpen(true);
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmed = draftTitle.trim();
    if (!trimmed) {
      Alert.alert("Missing title", "Give the goal a name.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const targetDate = draftDeadline === "none" ? undefined : addDays(getTodayKey(), Number(draftDeadline));
      await createGoal.mutateAsync({ title: trimmed, targetDate });
      setSheetOpen(false);
    } catch (e) {
      logError("goals.create", e);
      Alert.alert("Could not save", "Try again.");
    }
  }, [draftTitle, draftDeadline, createGoal]);

  const handleToggle = useCallback(
    (goal: Goal) => {
      Haptics.selectionAsync();
      const next = goal.status === "completed" ? "active" : "completed";
      updateGoal.mutate({ goalId: goal.id, patch: { status: next } });
    },
    [updateGoal],
  );

  const handleLongPress = useCallback(
    (goal: Goal) => {
      Alert.alert(goal.title, "Remove this goal?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            deleteGoal.mutate(goal.id);
          },
        },
      ]);
    },
    [deleteGoal],
  );

  const renderGoal = (g: Goal) => {
    const done = g.status === "completed";
    return (
      <Pressable
        key={g.id}
        onPress={() => handleToggle(g)}
        onLongPress={() => handleLongPress(g)}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <Panel tone="subtle" style={styles.goalCard}>
          <View
            style={[
              styles.checkBox,
              done && { backgroundColor: colors.success, borderColor: colors.success },
            ]}
          >
            {done && <Ionicons name="checkmark" size={14} color={colors.bg} />}
          </View>
          <View style={styles.goalText}>
            <Text style={[styles.goalTitle, done && styles.goalTitleDone]}>{g.title}</Text>
            {g.target_date && !done ? (
              <Text style={styles.goalMeta}>
                {countdownLabel(g.target_date, today)} · Due {formatDateShort(g.target_date)}
              </Text>
            ) : null}
          </View>
        </Panel>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.headerWrap}>
        <ScreenHeader
          kicker="Targets & Progress"
          title="Goals"
          subtitle="Long-horizon targets the missions ladder up to."
          rightSlot={
            <Pressable onPress={openSheet} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
              <Ionicons name="add" size={22} color={colors.text} />
            </Pressable>
          }
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <Panel>
            <Text style={styles.emptyText}>Loading…</Text>
          </Panel>
        ) : active.length === 0 && completed.length === 0 ? (
          <Panel>
            <Text style={styles.emptyText}>No goals yet. Tap + to set one.</Text>
          </Panel>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ACTIVE ({active.length})</Text>
              <View style={styles.sectionList}>{active.map(renderGoal)}</View>
            </View>

            {completed.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>COMPLETED ({completed.length})</Text>
                <View style={styles.sectionList}>{completed.map(renderGoal)}</View>
              </View>
            )}
          </>
        )}

        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>

      <EditorSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="New Goal"
        primaryLabel="CREATE"
        onPrimary={handleCreate}
        primaryBusy={createGoal.isPending}
      >
        <FieldInput
          label="TITLE"
          value={draftTitle}
          onChangeText={setDraftTitle}
          placeholder="e.g. Read 50 books this year"
          autoFocus
        />
        <FieldSelectRow
          label="DEADLINE"
          options={DEADLINE_OPTIONS}
          value={draftDeadline}
          onChange={setDraftDeadline}
        />
      </EditorSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.6 },
  headerWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
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
  content: { padding: spacing.xl, gap: spacing.lg },
  emptyText: {
    ...fonts.body,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  section: { gap: spacing.sm },
  sectionTitle: { ...fonts.kicker, color: colors.textMuted, letterSpacing: 2, fontSize: 11 },
  sectionList: { gap: spacing.sm },
  goalCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  goalText: { flex: 1, gap: spacing.xs },
  goalTitle: { ...fonts.body, color: colors.text, fontSize: 14 },
  goalTitleDone: { color: colors.textMuted, textDecorationLine: "line-through" },
  goalMeta: { ...fonts.kicker, color: colors.textMuted, fontSize: 10, letterSpacing: 1 },
});
