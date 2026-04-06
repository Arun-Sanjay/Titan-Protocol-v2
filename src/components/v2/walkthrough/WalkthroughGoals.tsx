import React, { useState } from "react";
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
import { useWalkthroughStore } from "../../../stores/useWalkthroughStore";
import type { EngineKey } from "../../../db/schema";

type Props = {
  onNext: () => void;
  onBack: () => void;
};

const ENGINE_OPTIONS: { key: EngineKey; label: string; color: string }[] = [
  { key: "body", label: "Body", color: colors.body },
  { key: "mind", label: "Mind", color: colors.mind },
  { key: "money", label: "Money", color: colors.money },
  { key: "charisma", label: "Charisma", color: colors.charisma },
];

export function WalkthroughGoals({ onNext, onBack }: Props) {
  const goals = useWalkthroughStore((s) => s.goals);
  const addGoal = useWalkthroughStore((s) => s.addGoal);
  const removeGoal = useWalkthroughStore((s) => s.removeGoal);

  const [title, setTitle] = useState("");
  const [engine, setEngine] = useState<EngineKey>("body");

  const handleAdd = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addGoal({ title: trimmed, engine });
    setTitle("");
  };

  const handleRemove = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    removeGoal(index);
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
        <Text style={styles.kicker}>GOALS</Text>
        <Text style={styles.subtitle}>
          What are you working toward?
        </Text>
        <Text style={styles.intro}>
          Set 1{"\u2013"}3 goals now, or add them later.
        </Text>

        {/* Engine selector */}
        <View style={styles.engineRow}>
          {ENGINE_OPTIONS.map((opt) => {
            const active = engine === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setEngine(opt.key);
                }}
                style={[
                  styles.enginePill,
                  active && { backgroundColor: opt.color + "22", borderColor: opt.color },
                ]}
              >
                <Text
                  style={[
                    styles.enginePillText,
                    active && { color: opt.color },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Input row */}
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Goal title..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
          <Pressable onPress={handleAdd} style={styles.addBtn}>
            <Text style={styles.addBtnText}>ADD</Text>
          </Pressable>
        </View>

        {/* Added goals */}
        {goals.length > 0 && (
          <>
            <Text
              style={[styles.sectionKicker, { marginTop: spacing["2xl"] }]}
            >
              YOUR GOALS
            </Text>
            {goals.map((g, i) => {
              const engineOpt = ENGINE_OPTIONS.find((e) => e.key === g.engine);
              return (
                <Animated.View
                  key={`${g.title}-${i}`}
                  entering={FadeInDown.delay(i * 50).duration(300)}
                  style={styles.goalRow}
                >
                  <View style={styles.goalContent}>
                    <Text style={styles.goalTitle}>{g.title}</Text>
                    <View
                      style={[
                        styles.goalTag,
                        { backgroundColor: (engineOpt?.color ?? colors.primary) + "1A" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.goalTagText,
                          { color: engineOpt?.color ?? colors.primary },
                        ]}
                      >
                        {engineOpt?.label ?? g.engine}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => handleRemove(i)}
                    hitSlop={8}
                    style={styles.removeBtn}
                  >
                    <Text style={styles.removeBtnText}>{"\u2715"}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </>
        )}

        <Text style={styles.countText}>
          {goals.length} goal{goals.length !== 1 ? "s" : ""} set
        </Text>
      </ScrollView>

      {/* Next button */}
      <Pressable onPress={handleNext} style={styles.button}>
        <Text style={styles.buttonText}>
          {goals.length === 0 ? "Skip" : "Next"}
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
    marginBottom: spacing.sm,
  },
  intro: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing["2xl"],
  },
  engineRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  enginePill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
  },
  enginePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  input: {
    height: 44,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  addBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
  },
  sectionKicker: {
    ...fonts.kicker,
    marginBottom: spacing.md,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  goalContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  goalTitle: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "500",
    flex: 1,
  },
  goalTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  goalTagText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
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
