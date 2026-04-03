import React, { useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import type { EngineKey } from "../../../db/schema";

type Props = { onNext: () => void; onBack: () => void };

// ─── Goal chips with engine color mapping ─────────────────────────────────────

type GoalOption = {
  id: string;
  label: string;
  engine: EngineKey;
};

const ENGINE_COLORS: Record<EngineKey, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  charisma: colors.charisma,
};

const GOAL_OPTIONS: GoalOption[] = [
  { id: "fit",         label: "Get physically fit",       engine: "body" },
  { id: "health",      label: "Improve my health",        engine: "body" },
  { id: "clarity",     label: "Build mental clarity",     engine: "mind" },
  { id: "read",        label: "Read more books",          engine: "mind" },
  { id: "skills",      label: "Learn new skills",         engine: "mind" },
  { id: "income",      label: "Grow my income",           engine: "money" },
  { id: "money_mgmt",  label: "Manage money better",      engine: "money" },
  { id: "habits",      label: "Build better habits",      engine: "charisma" },
  { id: "discipline",  label: "Become more disciplined",  engine: "charisma" },
  { id: "organized",   label: "Be more organized",        engine: "charisma" },
];

// ─── Animated Chip ───────────────────────────────────────────────────────────

function GoalChip({
  goal,
  selected,
  engineColor,
  index,
  onToggle,
}: {
  goal: GoalOption;
  selected: boolean;
  engineColor: string;
  index: number;
  onToggle: (id: string) => void;
}) {
  const scale = useSharedValue(1);

  const animatedChipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    onToggle(goal.id);
    scale.value = withSequence(
      withTiming(1.04, { duration: 100 }),
      withTiming(1.0, { duration: 100 }),
    );
  }, [goal.id, onToggle, scale]);

  return (
    <Animated.View entering={FadeInDown.delay(200 + index * 60).duration(400)}>
      <Pressable
        style={[
          styles.chip,
          { borderLeftColor: engineColor },
          selected && { borderColor: engineColor, backgroundColor: engineColor + "12" },
        ]}
        onPress={handlePress}
      >
        <Animated.View style={animatedChipStyle}>
          <View style={styles.chipInner}>
            {selected && (
              <View style={[styles.chipCheck, { backgroundColor: engineColor }]}>
                <Text style={styles.chipCheckText}>{"\u2713"}</Text>
              </View>
            )}
            <Text style={[styles.chipLabel, selected && { color: colors.text }]}>
              {goal.label}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepGoals({ onNext, onBack }: Props) {
  const goals = useOnboardingStore((s) => s.goals);
  const setGoals = useOnboardingStore((s) => s.setGoals);

  const toggleGoal = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (goals.includes(id)) {
      setGoals(goals.filter((g) => g !== id));
    } else if (goals.length < 4) {
      setGoals([...goals, id]);
    }
  }, [goals, setGoals]);

  const canContinue = goals.length >= 2;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(0).duration(400)}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={styles.backText}>{"\u2190"} BACK</Text>
          </Pressable>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(50).duration(400)}>
          <Text style={styles.kicker}>STEP 2 OF 6</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={styles.title}>WHAT ARE YOU{"\n"}WORKING TOWARD?</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Text style={styles.subtitle}>
            Select your top priorities (pick 2-4). This helps us suggest the right missions.
          </Text>
        </Animated.View>

        <View style={styles.chips}>
          {GOAL_OPTIONS.map((goal, index) => {
            const selected = goals.includes(goal.id);
            const engineColor = ENGINE_COLORS[goal.engine];

            return (
              <GoalChip
                key={goal.id}
                goal={goal}
                selected={selected}
                engineColor={engineColor}
                index={index}
                onToggle={toggleGoal}
              />
            );
          })}
        </View>

        {/* Selected count */}
        <Text style={styles.countText}>
          {goals.length}/4 selected{goals.length < 2 ? " (pick at least 2)" : ""}
        </Text>
      </ScrollView>

      <Pressable
        style={[styles.btn, !canContinue && styles.btnDisabled]}
        onPress={() => { if (canContinue) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onNext(); }}}
        disabled={!canContinue}
      >
        <Text style={[styles.btnText, !canContinue && styles.btnTextDisabled]}>CONTINUE</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing["3xl"] },
  scroll: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  backText: { ...fonts.kicker, fontSize: 10, color: colors.textMuted, marginBottom: spacing.xl },
  kicker: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.xs },
  title: { fontSize: 26, fontWeight: "700", color: colors.text, letterSpacing: 1, marginBottom: spacing.sm },
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.xl },

  chips: { gap: spacing.sm },
  chip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.md,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderLeftWidth: 3,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  chipInner: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
  chipCheck: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  chipCheckText: { fontSize: 11, fontWeight: "700", color: "#000" },
  chipLabel: { fontSize: 15, fontWeight: "500", color: colors.textSecondary },

  countText: {
    ...fonts.kicker, fontSize: 9, color: colors.textMuted,
    textAlign: "center", marginTop: spacing.lg,
  },

  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.lg, alignItems: "center",
  },
  btnDisabled: { backgroundColor: "rgba(255,255,255,0.08)" },
  btnText: { ...fonts.kicker, fontSize: 13, color: "#000", letterSpacing: 2 },
  btnTextDisabled: { color: colors.textMuted },
});
