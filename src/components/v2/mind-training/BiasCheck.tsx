import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { colors, spacing } from "../../../theme";
import { Panel } from "../../ui/Panel";
import type { Exercise, ExerciseOption } from "../../../stores/useMindTrainingStore";

const LETTERS = ["A", "B", "C", "D"];

type Props = {
  exercise: Exercise;
  onComplete: (selectedId: string, correct: boolean) => void;
};

export function BiasCheck({ exercise, onComplete }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const isCorrect = selectedId === exercise.correct;

  function handleConfirm() {
    if (!selectedId) return;
    setRevealed(true);
  }

  function handleNext() {
    if (!selectedId) return;
    onComplete(selectedId, isCorrect);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Scenario */}
      <Animated.View entering={FadeIn.duration(400)}>
        <View style={styles.scenarioPanel}>
          <View style={styles.scenarioBorder} />
          <Text style={styles.scenarioText}>{exercise.scenario}</Text>
        </View>
      </Animated.View>

      {/* Question */}
      <Animated.Text entering={FadeIn.delay(200).duration(400)} style={styles.question}>
        {exercise.question}
      </Animated.Text>

      {/* Options */}
      {exercise.options.map((opt: ExerciseOption, idx: number) => {
        const isSelected = selectedId === opt.id;
        const isCorrectOpt = opt.id === exercise.correct;
        const showCorrect = revealed && isCorrectOpt;
        const showWrong = revealed && isSelected && !isCorrectOpt;

        return (
          <Animated.View
            key={opt.id}
            entering={FadeInUp.delay(300 + idx * 80).duration(400)}
          >
            <Pressable
              style={[
                styles.option,
                isSelected && !revealed && styles.optionSelected,
                showCorrect && styles.optionCorrect,
                showWrong && styles.optionWrong,
              ]}
              onPress={() => !revealed && setSelectedId(opt.id)}
              disabled={revealed}
            >
              <View style={[
                styles.letterBadge,
                isSelected && !revealed && styles.letterBadgeSelected,
                showCorrect && styles.letterBadgeCorrect,
                showWrong && styles.letterBadgeWrong,
              ]}>
                <Text style={styles.letter}>{LETTERS[idx]}</Text>
              </View>
              <View style={styles.optionText}>
                <Text style={[
                  styles.optionLabel,
                  (isSelected || showCorrect) && styles.optionLabelHighlighted,
                ]}>
                  {opt.text}
                </Text>
                {opt.description && (
                  <Text style={styles.optionDesc}>{opt.description}</Text>
                )}
              </View>
            </Pressable>
          </Animated.View>
        );
      })}

      {/* Explanation (after reveal) */}
      {revealed && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.explanationWrap}>
          <Panel style={styles.explanationPanel}>
            <Text style={styles.explanationTitle}>
              {isCorrect ? "Correct!" : "Not quite."}
            </Text>
            <Text style={styles.explanation}>{exercise.explanation}</Text>
          </Panel>
          {exercise.insight && (
            <Text style={styles.insight}>{exercise.insight}</Text>
          )}
        </Animated.View>
      )}

      {/* Button */}
      {!revealed ? (
        <Pressable
          style={[styles.button, !selectedId && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={!selectedId}
        >
          <Text style={[styles.buttonText, !selectedId && styles.buttonTextDisabled]}>
            CONFIRM
          </Text>
        </Pressable>
      ) : (
        <Pressable style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>NEXT</Text>
        </Pressable>
      )}

      <View style={{ height: spacing["2xl"] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing["2xl"],
  },
  scenarioPanel: {
    flexDirection: "row",
    backgroundColor: "rgba(167, 139, 250, 0.06)",
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    overflow: "hidden",
  },
  scenarioBorder: {
    width: 3,
    backgroundColor: colors.mind,
    borderRadius: 2,
    marginRight: spacing.md,
  },
  scenarioText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "400",
    color: colors.text,
    lineHeight: 22,
  },
  question: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.lg,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: spacing.sm,
  },
  optionSelected: {
    borderColor: colors.surfaceBorderStrong,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  optionCorrect: {
    borderColor: colors.success,
    backgroundColor: "rgba(52, 211, 153, 0.08)",
  },
  optionWrong: {
    borderColor: colors.danger,
    backgroundColor: "rgba(248, 113, 113, 0.08)",
  },
  letterBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  letterBadgeSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  letterBadgeCorrect: {
    backgroundColor: colors.success,
  },
  letterBadgeWrong: {
    backgroundColor: colors.danger,
  },
  letter: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  optionLabelHighlighted: {
    color: colors.text,
  },
  optionDesc: {
    fontSize: 11,
    color: colors.textMuted,
  },
  explanationWrap: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  explanationPanel: {
    padding: spacing.lg,
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  explanation: {
    fontSize: 14,
    fontWeight: "400",
    color: colors.textSecondary,
    lineHeight: 22,
  },
  insight: {
    fontSize: 13,
    fontWeight: "400",
    fontStyle: "italic",
    color: colors.textMuted,
    paddingHorizontal: spacing.sm,
  },
  button: {
    paddingVertical: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  buttonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.bg,
    letterSpacing: 2,
  },
  buttonTextDisabled: {
    color: colors.textMuted,
  },
});
