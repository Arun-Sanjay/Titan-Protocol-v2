import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Panel } from "../src/components/ui/Panel";
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from "../src/hooks/queries/useGoals";
import type { Goal } from "../src/services/goals";
import { logError } from "../src/lib/error-log";

import { colors, fonts, radius, spacing } from "../src/theme";

export default function GoalsScreen() {
  const router = useRouter();
  const { data: goals, isLoading } = useGoals();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  const { active, completed } = useMemo(() => {
    const a: Goal[] = [];
    const c: Goal[] = [];
    for (const g of goals ?? []) {
      if (g.status === "completed") c.push(g);
      else a.push(g);
    }
    return { active: a, completed: c };
  }, [goals]);

  const handleCreate = useCallback(async () => {
    const trimmed = draftTitle.trim();
    if (!trimmed) {
      Alert.alert("Missing title", "Give the goal a name.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await createGoal.mutateAsync({ title: trimmed });
      setDraftTitle("");
      setSheetOpen(false);
    } catch (e) {
      logError("goals.create", e);
      Alert.alert("Could not save", "Try again.");
    }
  }, [draftTitle, createGoal]);

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
      Alert.alert(goal.title, undefined, [
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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>LONG-HORIZON</Text>
          <Text style={styles.title}>Goals</Text>
        </View>
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [
            styles.newButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="add" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <Panel>
            <Text style={styles.emptyText}>Loading…</Text>
          </Panel>
        ) : active.length === 0 && completed.length === 0 ? (
          <Panel>
            <Text style={styles.emptyText}>
              No goals yet. Tap + to set one.
            </Text>
          </Panel>
        ) : (
          <>
            <Section title={`ACTIVE (${active.length})`}>
              {active.map((g) => (
                <GoalRow
                  key={g.id}
                  goal={g}
                  onToggle={handleToggle}
                  onLongPress={handleLongPress}
                />
              ))}
            </Section>

            {completed.length > 0 && (
              <Section title={`COMPLETED (${completed.length})`}>
                {completed.map((g) => (
                  <GoalRow
                    key={g.id}
                    goal={g}
                    onToggle={handleToggle}
                    onLongPress={handleLongPress}
                  />
                ))}
              </Section>
            )}
          </>
        )}

        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>

      <NewGoalSheet
        visible={sheetOpen}
        value={draftTitle}
        onChange={setDraftTitle}
        onClose={() => {
          setSheetOpen(false);
          setDraftTitle("");
        }}
        onSave={handleCreate}
        saving={createGoal.isPending}
      />
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionList}>{children}</View>
    </View>
  );
}

function GoalRow({
  goal,
  onToggle,
  onLongPress,
}: {
  goal: Goal;
  onToggle: (g: Goal) => void;
  onLongPress: (g: Goal) => void;
}) {
  const done = goal.status === "completed";
  return (
    <Pressable
      onPress={() => onToggle(goal)}
      onLongPress={() => onLongPress(goal)}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Panel style={styles.goalCard}>
        <View
          style={[
            styles.checkBox,
            done && { backgroundColor: colors.success, borderColor: colors.success },
          ]}
        >
          {done && <Ionicons name="checkmark" size={14} color={colors.bg} />}
        </View>
        <View style={styles.goalText}>
          <Text
            style={[
              styles.goalTitle,
              done && styles.goalTitleDone,
            ]}
          >
            {goal.title}
          </Text>
          {goal.target_date && (
            <Text style={styles.goalMeta}>Target: {goal.target_date}</Text>
          )}
        </View>
      </Panel>
    </Pressable>
  );
}

function NewGoalSheet({
  visible,
  value,
  onChange,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const translateY = useSharedValue(800);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(1, { duration: 220 });
    } else {
      translateY.value = withTiming(800, { duration: 220 });
      backdropOpacity.value = withTiming(0, { duration: 180 });
    }
    return () => {
      cancelAnimation(translateY);
      cancelAnimation(backdropOpacity);
    };
  }, [visible, translateY, backdropOpacity]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable onPress={saving ? undefined : onClose} style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalKav}
          pointerEvents="box-none"
        >
          <Animated.View style={[styles.sheet, sheetStyle]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>New Goal</Text>

            <TextInput
              value={value}
              onChangeText={onChange}
              placeholder="e.g. Read 50 books this year"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              editable={!saving}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={onSave}
            />

            <Pressable
              onPress={onSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.submit,
                pressed && styles.pressed,
                saving && styles.submitDisabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.submitText}>CREATE</Text>
              )}
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.6 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
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
  headerText: { flex: 1, gap: spacing.xs },
  kicker: { ...fonts.kicker, color: colors.textMuted, letterSpacing: 2 },
  title: { ...fonts.title, fontSize: 28, letterSpacing: -0.5 },
  newButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.text,
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
  sectionTitle: {
    ...fonts.kicker,
    color: colors.textMuted,
    letterSpacing: 2,
    fontSize: 11,
  },
  sectionList: { gap: spacing.sm },

  goalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
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

  // Sheet
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.75)" },
  modalKav: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.panelBorder,
    padding: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: spacing.sm,
  },
  sheetTitle: { ...fonts.title, fontSize: 22 },
  input: {
    ...fonts.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
  },
  submit: {
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { ...fonts.kicker, color: colors.bg, fontSize: 13, letterSpacing: 2 },
});
