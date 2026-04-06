import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fonts } from "../../../theme";
import { useProtocolStore } from "../../../stores/useProtocolStore";
import { useHabitStore } from "../../../stores/useHabitStore";
import { getTodayKey } from "../../../lib/date";

const MAX_HABITS = 5;

export function PhaseHabitConfirm() {
  const completePhase = useProtocolStore((s) => s.completePhase);
  const habits = useHabitStore((s) => s.habits);
  const completedIds = useHabitStore((s) => s.completedIds);
  const toggleHabit = useHabitStore((s) => s.toggleHabit);

  const today = getTodayKey();
  const displayHabits = useMemo(() => habits.slice(0, MAX_HABITS), [habits]);
  const completedSet = useMemo(
    () => new Set(completedIds[today] ?? []),
    [completedIds, today],
  );
  const completedCount = useMemo(
    () => displayHabits.filter((h) => completedSet.has(h.id!)).length,
    [displayHabits, completedSet],
  );

  function handleToggle(habitId: number) {
    toggleHabit(habitId, today);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleNext() {
    completePhase("habit_confirm", {
      completed: completedCount,
      total: displayHabits.length,
    });
  }

  if (displayHabits.length === 0) {
    return (
      <View style={styles.container}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyState}>
          <Ionicons name="leaf-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>No habits configured</Text>
          <Text style={styles.emptyHint}>Add habits in the Track tab to include them here.</Text>
        </Animated.View>

        <View style={styles.bottomSpacer} />

        <Pressable style={styles.skipButton} onPress={handleNext}>
          <Text style={styles.skipText}>SKIP</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.Text entering={FadeIn.duration(400)} style={styles.header}>
        HABIT CHECK
      </Animated.Text>

      <View style={styles.list}>
        {displayHabits.map((habit, idx) => {
          const isDone = completedSet.has(habit.id!);
          return (
            <Animated.View
              key={habit.id}
              entering={FadeInUp.delay(idx * 60).duration(400)}
            >
              <Pressable
                style={[styles.row, isDone && styles.rowDone]}
                onPress={() => handleToggle(habit.id!)}
              >
                <View style={[styles.checkbox, isDone && styles.checkboxDone]}>
                  {isDone && <Ionicons name="checkmark" size={14} color={colors.bg} />}
                </View>
                <Text style={[styles.habitName, isDone && styles.habitNameDone]}>
                  {habit.title}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <Animated.Text entering={FadeIn.delay(400).duration(400)} style={styles.summary}>
        {completedCount} of {displayHabits.length} completed
      </Animated.Text>

      <View style={styles.bottomSpacer} />

      <Pressable style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>NEXT</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    ...fonts.kicker,
    fontSize: 12,
    letterSpacing: 4,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  rowDone: {
    opacity: 0.5,
    borderColor: colors.success + "40",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  habitName: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  habitNameDone: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  summary: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  emptyHint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },
  bottomSpacer: {
    flex: 1,
  },
  button: {
    paddingVertical: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.bg,
    letterSpacing: 2,
  },
  skipButton: {
    paddingVertical: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  skipText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 2,
  },
});
