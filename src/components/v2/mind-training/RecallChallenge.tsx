import React, { useState, useRef } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fonts } from "../../../theme";
import { Panel } from "../../ui/Panel";
import type { Exercise } from "../../../stores/useMindTrainingStore";
import type { SRSCard } from "../../../lib/srs";
import { calculateNextReview, qualityFromResult } from "../../../lib/srs";

const LETTERS = ["A", "B", "C", "D"];

type Props = {
  exercise: Exercise;
  card: SRSCard;
  onComplete: (selectedId: string, correct: boolean, quality: number, updatedCard: SRSCard) => void;
};

export function RecallChallenge({ exercise, card, onComplete }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const startTime = useRef(Date.now());

  const isCorrect = selectedId === exercise.correct;

  function handleConfirm() {
    if (!selectedId) return;
    setRevealed(true);
  }

  function handleNext() {
    if (!selectedId) return;
    const timeSpentMs = Date.now() - startTime.current;
    const quality = qualityFromResult(isCorrect, timeSpentMs);
    const result = calculateNextReview(card, quality);

    const updatedCard: SRSCard = {
      ...card,
      interval: result.interval,
      easeFactor: result.easeFactor,
      repetitions: result.repetitions,
      nextReview: result.nextReview,
      lastReview: new Date().toISOString().slice(0, 10),
    };

    onComplete(selectedId, isCorrect, quality, updatedCard);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Recall badge */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.recallBadge}>
        <Ionicons name="refresh-outline" size={14} color={colors.warning} />
        <Text style={styles.recallText}>RECALL CHALLENGE</Text>
      </Animated.View>

      {/* Scenario */}
      <Animated.View entering={FadeIn.delay(100).duration(400)}>
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
      {exercise.options.map((opt, idx) => {
        const isSelected = selectedId === opt.id;
        const isCorrectOpt = opt.id === exercise.correct;
        const showCorrect = revealed && isCorrectOpt;
        const showWrong = revealed && isSelected && !isCorrectOpt;

        return (
          <Animated.View key={opt.id} entering={FadeInUp.delay(300 + idx * 80).duration(400)}>
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
                showCorrect && styles.letterBadgeCorrect,
                showWrong && styles.letterBadgeWrong,
              ]}>
                <Text style={styles.letter}>{LETTERS[idx]}</Text>
              </View>
              <Text style={[styles.optionLabel, (isSelected || showCorrect) && styles.optionLabelHighlighted]}>
                {opt.text}
              </Text>
            </Pressable>
          </Animated.View>
        );
      })}

      {/* Result */}
      {revealed && (
        <Animated.View entering={FadeIn.duration(400)}>
          <Panel style={styles.resultPanel}>
            <Text style={styles.resultTitle}>{isCorrect ? "Still sharp!" : "Time to review."}</Text>
            <Text style={styles.resultText}>{exercise.explanation}</Text>
          </Panel>
        </Animated.View>
      )}

      {/* Button */}
      {!revealed ? (
        <Pressable style={[styles.button, !selectedId && styles.buttonDisabled]} onPress={handleConfirm} disabled={!selectedId}>
          <Text style={[styles.buttonText, !selectedId && styles.buttonTextDisabled]}>CONFIRM</Text>
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
  container: { flex: 1 },
  scrollContent: { paddingBottom: spacing["2xl"] },
  recallBadge: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    alignSelf: "center", paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
    borderRadius: 999, borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.30)",
    backgroundColor: "rgba(251, 191, 36, 0.06)", marginBottom: spacing.lg,
  },
  recallText: { fontSize: 10, fontWeight: "700", color: colors.warning, letterSpacing: 2 },
  scenarioPanel: {
    flexDirection: "row", backgroundColor: "rgba(251, 191, 36, 0.06)",
    borderRadius: 12, padding: spacing.lg, marginBottom: spacing.xl, overflow: "hidden",
  },
  scenarioBorder: { width: 3, backgroundColor: colors.warning, borderRadius: 2, marginRight: spacing.md },
  scenarioText: { flex: 1, fontSize: 14, fontWeight: "400", color: colors.text, lineHeight: 22 },
  question: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: spacing.lg },
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
  resultTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  resultText: { fontSize: 14, fontWeight: "400", color: colors.textSecondary, lineHeight: 22 },
  button: { paddingVertical: spacing.lg, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", marginTop: spacing.xl },
  buttonDisabled: { backgroundColor: "rgba(255, 255, 255, 0.06)" },
  buttonText: { fontSize: 16, fontWeight: "700", color: colors.bg, letterSpacing: 2 },
  buttonTextDisabled: { color: colors.textMuted },
});
