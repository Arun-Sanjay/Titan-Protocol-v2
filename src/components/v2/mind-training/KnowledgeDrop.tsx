import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { colors, spacing, fonts } from "../../../theme";
import { Panel } from "../../ui/Panel";
import type { Exercise, ExerciseOption } from "../../../types/mind-training-ui";

const LETTERS = ["A", "B", "C", "D"];

type Props = {
  exercise: Exercise;
  onComplete: (selectedId: string, correct: boolean) => void;
};

export function KnowledgeDrop({ exercise, onComplete }: Props) {
  const [showQuestion, setShowQuestion] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const isCorrect = selectedId === exercise.correct;

  // Extract title from scenario (first line or first sentence)
  const title = exercise.category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

  function handleGotIt() {
    setShowQuestion(true);
  }

  function handleConfirm() {
    if (!selectedId) return;
    setRevealed(true);
  }

  function handleDone() {
    if (!selectedId) return;
    onComplete(selectedId, isCorrect);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Title */}
      <Animated.Text entering={FadeIn.duration(400)} style={styles.title}>
        {title}
      </Animated.Text>

      {/* Content */}
      <Animated.View entering={FadeIn.delay(200).duration(400)}>
        <Panel style={styles.contentPanel}>
          <Text style={styles.content}>{exercise.scenario}</Text>
        </Panel>
      </Animated.View>

      {/* Application insight */}
      {exercise.insight && (
        <Animated.View entering={FadeIn.delay(400).duration(400)} style={styles.applicationBox}>
          <Text style={styles.applicationLabel}>APPLICATION</Text>
          <Text style={styles.applicationText}>{exercise.insight}</Text>
        </Animated.View>
      )}

      {!showQuestion ? (
        /* Got it button — advance to comprehension question */
        <Animated.View entering={FadeIn.delay(600).duration(400)}>
          <Pressable style={styles.button} onPress={handleGotIt}>
            <Text style={styles.buttonText}>GOT IT</Text>
          </Pressable>
        </Animated.View>
      ) : (
        /* Comprehension question */
        <>
          <Animated.Text entering={FadeIn.duration(400)} style={styles.question}>
            {exercise.question}
          </Animated.Text>

          {exercise.options.map((opt: ExerciseOption, idx: number) => {
            const isSelected = selectedId === opt.id;
            const isCorrectOpt = opt.id === exercise.correct;
            const showCorrectStyle = revealed && isCorrectOpt;
            const showWrongStyle = revealed && isSelected && !isCorrectOpt;

            return (
              <Animated.View key={opt.id} entering={FadeInUp.delay(idx * 80).duration(400)}>
                <Pressable
                  style={[
                    styles.option,
                    isSelected && !revealed && styles.optionSelected,
                    showCorrectStyle && styles.optionCorrect,
                    showWrongStyle && styles.optionWrong,
                  ]}
                  onPress={() => !revealed && setSelectedId(opt.id)}
                  disabled={revealed}
                >
                  <View style={[
                    styles.letterBadge,
                    showCorrectStyle && styles.letterBadgeCorrect,
                    showWrongStyle && styles.letterBadgeWrong,
                  ]}>
                    <Text style={styles.letter}>{LETTERS[idx]}</Text>
                  </View>
                  <Text style={[styles.optionLabel, (isSelected || showCorrectStyle) && styles.optionLabelHighlighted]}>
                    {opt.text}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}

          {revealed && (
            <Animated.View entering={FadeIn.duration(400)}>
              <Panel style={styles.resultPanel}>
                <Text style={styles.resultText}>
                  {isCorrect ? "Correct!" : "Not quite."} {exercise.explanation}
                </Text>
              </Panel>
            </Animated.View>
          )}

          {!revealed ? (
            <Pressable
              style={[styles.button, !selectedId && styles.buttonDisabled]}
              onPress={handleConfirm}
              disabled={!selectedId}
            >
              <Text style={[styles.buttonText, !selectedId && styles.buttonTextDisabled]}>CONFIRM</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.button} onPress={handleDone}>
              <Text style={styles.buttonText}>DONE</Text>
            </Pressable>
          )}
        </>
      )}

      <View style={{ height: spacing["2xl"] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: spacing["2xl"] },
  title: {
    fontSize: 20, fontWeight: "700", color: colors.text,
    textAlign: "center", marginBottom: spacing.xl, letterSpacing: 0.5,
  },
  contentPanel: { padding: spacing.lg, marginBottom: spacing.lg },
  content: { fontSize: 15, fontWeight: "400", color: colors.text, lineHeight: 24 },
  applicationBox: {
    padding: spacing.lg, borderRadius: 12, backgroundColor: "rgba(251, 191, 36, 0.06)",
    borderLeftWidth: 3, borderLeftColor: colors.warning, marginBottom: spacing.xl, gap: spacing.sm,
  },
  applicationLabel: { ...fonts.kicker, fontSize: 9, color: colors.warning },
  applicationText: { fontSize: 14, fontWeight: "400", color: colors.textSecondary, lineHeight: 22 },
  question: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: spacing.lg, marginTop: spacing.md },
  option: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg,
    borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder, marginBottom: spacing.sm,
  },
  optionSelected: { borderColor: colors.surfaceBorderStrong, backgroundColor: "rgba(255, 255, 255, 0.04)" },
  optionCorrect: { borderColor: colors.success, backgroundColor: "rgba(52, 211, 153, 0.08)" },
  optionWrong: { borderColor: colors.danger, backgroundColor: "rgba(248, 113, 113, 0.08)" },
  letterBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255, 255, 255, 0.06)", alignItems: "center", justifyContent: "center" },
  letterBadgeCorrect: { backgroundColor: colors.success },
  letterBadgeWrong: { backgroundColor: colors.danger },
  letter: { fontSize: 12, fontWeight: "700", color: colors.text },
  optionLabel: { flex: 1, fontSize: 14, fontWeight: "500", color: colors.textSecondary },
  optionLabelHighlighted: { color: colors.text },
  resultPanel: { padding: spacing.lg, marginTop: spacing.lg },
  resultText: { fontSize: 14, fontWeight: "400", color: colors.textSecondary, lineHeight: 22 },
  button: { paddingVertical: spacing.lg, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", marginTop: spacing.xl },
  buttonDisabled: { backgroundColor: "rgba(255, 255, 255, 0.06)" },
  buttonText: { fontSize: 16, fontWeight: "700", color: colors.bg, letterSpacing: 2 },
  buttonTextDisabled: { color: colors.textMuted },
});
