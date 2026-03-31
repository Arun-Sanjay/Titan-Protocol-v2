import React, { useState, useMemo, useEffect } from "react";
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
import { IDENTITIES, type Archetype } from "../../../stores/useIdentityStore";
import { getStarterMissions } from "../../../data/starter-missions";
import type { EngineKey } from "../../../db/schema";

type Props = {
  engine: EngineKey;
  onNext: () => void;
  onBack: () => void;
};

type EngineMeta = {
  icon: string;
  name: string;
  desc: string;
  color: string;
};

const ENGINE_META: Record<EngineKey, EngineMeta> = {
  body: {
    icon: "\uD83D\uDCAA",
    name: "Body",
    desc: "Physical fitness, workouts, nutrition, sleep, health habits",
    color: colors.body,
  },
  mind: {
    icon: "\uD83E\uDDE0",
    name: "Mind",
    desc: "Learning, reading, focus, deep work, reflection, journaling",
    color: colors.mind,
  },
  money: {
    icon: "\uD83D\uDCB0",
    name: "Money",
    desc: "Income, expenses, savings, career, side projects",
    color: colors.money,
  },
  charisma: {
    icon: "\uD83D\uDDE3\uFE0F",
    name: "Charisma",
    desc: "Confidence building, speaking, networking, social courage",
    color: colors.charisma,
  },
};

export function WalkthroughEngineSetup({ engine, onNext, onBack }: Props) {
  const meta = ENGINE_META[engine];
  const identity = useOnboardingStore((s) => s.identity);
  const identityMeta = identity
    ? IDENTITIES.find((i) => i.id === identity)
    : null;

  const engineTasks = useWalkthroughStore((s) => s.engineTasks[engine]);
  const addEngineTask = useWalkthroughStore((s) => s.addEngineTask);
  const removeEngineTask = useWalkthroughStore((s) => s.removeEngineTask);

  const [customTitle, setCustomTitle] = useState("");
  const [customKind, setCustomKind] = useState<"main" | "secondary">("main");
  const [addedSuggestions, setAddedSuggestions] = useState<Set<number>>(
    new Set(),
  );

  // Reset added suggestions when engine changes
  useEffect(() => {
    setAddedSuggestions(new Set());
  }, [engine]);

  // Get suggested missions for this engine
  const suggestions = useMemo(() => {
    const all = getStarterMissions(identity ?? "titan");
    return all.filter((m) => m.engine === engine);
  }, [identity, engine]);

  const handleAddSuggestion = (index: number) => {
    const mission = suggestions[index];
    if (!mission || addedSuggestions.has(index)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addEngineTask(engine, { title: mission.title, kind: mission.kind });
    setAddedSuggestions((prev) => new Set(prev).add(index));
  };

  const handleAddCustom = () => {
    const trimmed = customTitle.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addEngineTask(engine, { title: trimmed, kind: customKind });
    setCustomTitle("");
  };

  const handleRemove = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    removeEngineTask(engine, index);
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onNext();
  };

  const archetypeName = identityMeta?.name?.replace("The ", "") ?? "YOU";

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.engineIcon}>{meta.icon}</Text>
          <Text style={[styles.engineName, { color: meta.color }]}>
            {meta.name}
          </Text>
        </View>
        <Text style={styles.desc}>{meta.desc}</Text>

        {/* Suggested missions */}
        <Text style={styles.sectionKicker}>
          SUGGESTED FOR {archetypeName.toUpperCase()}
        </Text>

        {suggestions.map((mission, i) => {
          const isAdded = addedSuggestions.has(i);
          const label =
            mission.kind === "main" ? "Mission +2pt" : "Side Quest +1pt";
          return (
            <Animated.View
              key={`${mission.title}-${i}`}
              entering={FadeInDown.delay(i * 60).duration(350)}
              style={styles.suggestionCard}
            >
              <View style={styles.suggestionContent}>
                <Text style={styles.suggestionTitle}>{mission.title}</Text>
                <Text
                  style={[
                    styles.suggestionLabel,
                    {
                      color:
                        mission.kind === "main"
                          ? meta.color
                          : colors.textMuted,
                    },
                  ]}
                >
                  {label}
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

        {/* Add your own */}
        <Text style={[styles.sectionKicker, { marginTop: spacing["2xl"] }]}>
          ADD YOUR OWN
        </Text>
        <View style={styles.customRow}>
          <TextInput
            style={styles.input}
            value={customTitle}
            onChangeText={setCustomTitle}
            placeholder="Enter a task..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            onSubmitEditing={handleAddCustom}
          />
          <Pressable
            onPress={() =>
              setCustomKind((k) => (k === "main" ? "secondary" : "main"))
            }
            style={[styles.kindToggle, { borderColor: meta.color }]}
          >
            <Text style={[styles.kindToggleText, { color: meta.color }]}>
              {customKind === "main" ? "Mission" : "Side"}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleAddCustom}
            style={[styles.plusBtn, { borderColor: meta.color }]}
          >
            <Text style={[styles.plusBtnText, { color: meta.color }]}>+</Text>
          </Pressable>
        </View>

        {/* Added tasks */}
        {engineTasks.length > 0 && (
          <>
            <Text
              style={[styles.sectionKicker, { marginTop: spacing["2xl"] }]}
            >
              ADDED TASKS
            </Text>
            {engineTasks.map((task, i) => (
              <View key={`${task.title}-${i}`} style={styles.addedRow}>
                <View style={styles.addedContent}>
                  <Text style={styles.addedTitle}>{task.title}</Text>
                  <Text style={styles.addedKind}>
                    {task.kind === "main" ? "Mission" : "Side Quest"}
                  </Text>
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

        {/* Running count */}
        <Text style={styles.countText}>
          {engineTasks.length} task{engineTasks.length !== 1 ? "s" : ""} added
          to {meta.name}
        </Text>
      </ScrollView>

      {/* Next button */}
      <Pressable onPress={handleNext} style={styles.button}>
        <Text style={styles.buttonText}>Next</Text>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  engineIcon: {
    fontSize: 32,
  },
  engineName: {
    fontSize: 20,
    fontWeight: "700",
  },
  desc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: spacing["2xl"],
  },
  sectionKicker: {
    ...fonts.kicker,
    marginBottom: spacing.md,
  },
  suggestionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  suggestionContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  suggestionTitle: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "500",
    marginBottom: 2,
  },
  suggestionLabel: {
    fontSize: 11,
    fontWeight: "600",
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
    flex: 1,
    height: 40,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  kindToggle: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  kindToggleText: {
    fontSize: 11,
    fontWeight: "700",
  },
  plusBtn: {
    borderWidth: 1,
    borderRadius: radius.sm,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  plusBtnText: {
    fontSize: 20,
    fontWeight: "600",
  },
  addedRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  addedContent: {
    flex: 1,
  },
  addedTitle: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "500",
  },
  addedKind: {
    fontSize: 11,
    color: colors.textMuted,
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
