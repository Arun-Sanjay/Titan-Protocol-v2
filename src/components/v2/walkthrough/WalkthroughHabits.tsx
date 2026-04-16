import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { useWalkthroughStore } from "../../../stores/useWalkthroughStore";
import { IDENTITY_LABELS, type IdentityArchetype } from "../../../stores/useModeStore";
import { getSuggestedHabits } from "../../../lib/mission-suggester";

type Props = {
  onNext: () => void;
  onBack: () => void;
};

export function WalkthroughHabits({ onNext, onBack }: Props) {
  const identity = useOnboardingStore((s) => s.identity);
  const habits = useWalkthroughStore((s) => s.habits);
  const addHabit = useWalkthroughStore((s) => s.addHabit);
  const removeHabit = useWalkthroughStore((s) => s.removeHabit);

  const [customName, setCustomName] = useState("");
  const [customTrigger, setCustomTrigger] = useState("");
  const [addedSuggestions, setAddedSuggestions] = useState<Set<number>>(
    new Set(),
  );

  const suggested = useMemo(
    () => getSuggestedHabits(identity ?? "titan").slice(0, 4),
    [identity],
  );

  const archetypeLabel = identity
    ? IDENTITY_LABELS[identity as IdentityArchetype]?.replace("The ", "").toUpperCase()
    : "YOU";

  const handleAddSuggestion = (index: number) => {
    const h = suggested[index];
    if (!h || addedSuggestions.has(index)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addHabit({
      title: h.title,
      trigger: h.trigger,
      icon: h.icon ?? "",
      engine: h.engine ?? "",
    });
    setAddedSuggestions((prev) => new Set(prev).add(index));
  };

  const handleAddCustom = () => {
    const name = customName.trim();
    const trigger = customTrigger.trim();
    if (!name) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addHabit({
      title: name,
      trigger: trigger || "When I decide to",
      icon: "",
      engine: "",
    });
    setCustomName("");
    setCustomTrigger("");
  };

  const handleRemove = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    removeHabit(index);
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onNext();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={styles.kicker}>HABITS</Text>
        <Text style={styles.subtitle}>
          Build the routines that define your identity.
        </Text>

        {/* Explanation card */}
        <View style={styles.explainCard}>
          <Text style={styles.explainText}>
            Each habit has a trigger:{" "}
            <Text style={styles.explainHighlight}>
              {"\u201C"}After I [existing routine], I will [new habit].{"\u201D"}
            </Text>
            {"\n"}This makes habits 3{"\u00D7"} more likely to stick.
          </Text>
        </View>

        {/* Suggested habits */}
        <Text style={styles.sectionKicker}>
          SUGGESTED FOR {archetypeLabel}
        </Text>

        {suggested.map((h, i) => {
          const isAdded = addedSuggestions.has(i);
          return (
            <Animated.View
              key={`${h.title}-${i}`}
              entering={FadeInDown.delay(i * 60).duration(350)}
              style={styles.habitCard}
            >
              <View style={styles.habitContent}>
                <Text style={styles.habitName}>{h.title}</Text>
                <Text style={styles.habitTrigger}>
                  After {h.trigger}
                </Text>
              </View>
              <Pressable
                onPress={() => handleAddSuggestion(i)}
                style={[
                  styles.addBtn,
                  isAdded && { borderColor: colors.success },
                ]}
                disabled={isAdded}
              >
                <Text
                  style={[
                    styles.addBtnText,
                    isAdded && { color: colors.success },
                  ]}
                >
                  {isAdded ? "\u2713" : "ADD"}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}

        {/* Custom habit */}
        <Text style={[styles.sectionKicker, { marginTop: spacing["2xl"] }]}>
          ADD YOUR OWN
        </Text>
        <TextInput
          style={styles.input}
          value={customName}
          onChangeText={setCustomName}
          placeholder="Habit name..."
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.customRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={customTrigger}
            onChangeText={setCustomTrigger}
            placeholder='Trigger: "After I..."'
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            onSubmitEditing={handleAddCustom}
          />
          <Pressable
            onPress={handleAddCustom}
            style={styles.plusBtn}
          >
            <Text style={styles.plusBtnText}>+</Text>
          </Pressable>
        </View>

        {/* Review section */}
        {habits.length > 0 && (
          <>
            <Text
              style={[styles.sectionKicker, { marginTop: spacing["2xl"] }]}
            >
              YOUR HABITS
            </Text>
            {habits.map((h, i) => (
              <View key={`${h.title}-${i}`} style={styles.addedRow}>
                <View style={styles.addedContent}>
                  <Text style={styles.addedTitle}>{h.title}</Text>
                  <Text style={styles.addedTrigger}>After {h.trigger}</Text>
                </View>
                <Pressable
                  onPress={() => handleRemove(i)}
                  hitSlop={8}
                  style={styles.removeBtn}
                >
                  <Text style={styles.removeBtnText}>{"\u2715"}</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}

        <Text style={styles.countText}>
          {habits.length} habit{habits.length !== 1 ? "s" : ""} added
        </Text>
      </ScrollView>

      {/* Next button */}
      <Pressable onPress={handleNext} style={styles.button}>
        <Text style={styles.buttonText}>
          {habits.length === 0 ? "Skip" : "Next"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing["2xl"],
    paddingBottom: spacing["3xl"],
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  kicker: {
    ...fonts.kicker,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 23,
    marginBottom: spacing["2xl"],
  },
  explainCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    padding: spacing.lg,
    marginBottom: spacing["2xl"],
  },
  explainText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  explainHighlight: {
    color: colors.text,
    fontWeight: "600",
  },
  sectionKicker: {
    ...fonts.kicker,
    marginBottom: spacing.md,
  },
  habitCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  habitContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  habitName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "500",
    marginBottom: 2,
  },
  habitTrigger: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  addBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  input: {
    height: 40,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  plusBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  plusBtnText: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.accent,
  },
  addedRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  addedContent: { flex: 1 },
  addedTitle: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "500",
  },
  addedTrigger: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: "italic",
    marginTop: 1,
  },
  removeBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  removeBtnText: {
    fontSize: 14,
    color: colors.danger,
    fontWeight: "600",
  },
  countText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  button: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },
});
