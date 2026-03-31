import React, { useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { QUIZ_QUESTIONS } from "../../../data/identity-quiz";

type Props = { onNext: () => void; onBack: () => void };

export function StepIdentity({ onNext, onBack }: Props) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const setQuizAnswer = useOnboardingStore((s) => s.setQuizAnswer);
  const computeQuizResult = useOnboardingStore((s) => s.computeQuizResult);

  const question = QUIZ_QUESTIONS[currentQ];
  const isLast = currentQ === QUIZ_QUESTIONS.length - 1;

  const handleSelect = useCallback((optionIndex: number) => {
    setSelected(optionIndex);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuizAnswer(currentQ, optionIndex);

    // Auto-advance after delay
    setTimeout(() => {
      if (isLast) {
        computeQuizResult();
        onNext();
      } else {
        setCurrentQ((q) => q + 1);
        setSelected(null);
      }
    }, 400);
  }, [currentQ, isLast, setQuizAnswer, computeQuizResult, onNext]);

  const handleBack = () => {
    if (currentQ === 0) {
      onBack();
    } else {
      setCurrentQ((q) => q - 1);
      setSelected(null);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Text style={styles.backText}>{currentQ === 0 ? "\u2190 BACK" : "\u2190 PREVIOUS"}</Text>
        </Pressable>

        {/* Progress */}
        <View style={styles.progressRow}>
          {QUIZ_QUESTIONS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i === currentQ && styles.progressDotActive,
                i < currentQ && styles.progressDotDone,
              ]}
            />
          ))}
        </View>

        <Text style={styles.kicker}>Q {currentQ + 1} OF {QUIZ_QUESTIONS.length}</Text>

        <Animated.View key={currentQ} entering={FadeIn.duration(300)}>
          <Text style={styles.title}>{question.question}</Text>

          <View style={styles.options}>
            {question.options.map((opt, i) => {
              const isSelected = selected === i;
              return (
                <Pressable
                  key={i}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => selected === null && handleSelect(i)}
                  disabled={selected !== null}
                >
                  <Text style={[styles.optionLetter, isSelected && styles.optionLetterSelected]}>
                    {String.fromCharCode(65 + i)}
                  </Text>
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {opt.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing["3xl"] },
  scroll: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  backText: { ...fonts.kicker, fontSize: 10, color: colors.textMuted, marginBottom: spacing.lg },

  progressRow: {
    flexDirection: "row", gap: 6, marginBottom: spacing.xl, alignItems: "center",
  },
  progressDot: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  progressDotActive: { backgroundColor: colors.primary, height: 4 },
  progressDotDone: { backgroundColor: "rgba(255,255,255,0.30)" },

  kicker: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.sm },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, lineHeight: 32, marginBottom: spacing.xl },

  options: { gap: spacing.md },
  option: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
  },
  optionSelected: {
    borderColor: colors.primary, backgroundColor: "rgba(255,255,255,0.06)",
  },
  optionLetter: {
    ...fonts.kicker, fontSize: 12, color: colors.textMuted,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    textAlign: "center", lineHeight: 24,
  },
  optionLetterSelected: { backgroundColor: colors.primary, color: "#000" },
  optionText: { fontSize: 15, color: colors.text, flex: 1, lineHeight: 21 },
  optionTextSelected: { fontWeight: "600" },
});
