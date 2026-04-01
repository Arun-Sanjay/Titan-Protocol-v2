import React, { useState, useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn, FadeOut, SlideInRight, SlideOutLeft,
  useSharedValue, useAnimatedStyle, withSequence, withTiming,
} from "react-native-reanimated";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { QUIZ_QUESTIONS } from "../../../data/identity-quiz";

type Props = { onNext: () => void; onBack: () => void };

export function StepIdentity({ onNext, onBack }: Props) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const setQuizAnswer = useOnboardingStore((s) => s.setQuizAnswer);
  const computeQuizResult = useOnboardingStore((s) => s.computeQuizResult);

  const question = QUIZ_QUESTIONS[currentQ];
  const isLast = currentQ === QUIZ_QUESTIONS.length - 1;

  // Card pulse animation
  const pulseScale = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handleSelect = useCallback((optionIndex: number) => {
    setSelected(optionIndex);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuizAnswer(currentQ, optionIndex);

    // Pulse the selected card
    pulseScale.value = withSequence(
      withTiming(1.03, { duration: 100 }),
      withTiming(1.0, { duration: 150 }),
    );
  }, [currentQ, setQuizAnswer, pulseScale]);

  const handleNext = () => {
    if (selected === null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isLast) {
      computeQuizResult();
      onNext();
    } else {
      setDirection("forward");
      setCurrentQ((q) => q + 1);
      setSelected(null);
    }
  };

  const handleBack = () => {
    if (currentQ === 0) {
      onBack();
    } else {
      setDirection("back");
      setCurrentQ((q) => q - 1);
      setSelected(null);
    }
  };

  const entering = direction === "forward"
    ? SlideInRight.duration(250)
    : undefined;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Top bar: back + progress */}
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} hitSlop={12}>
            <Text style={styles.backText}>{currentQ === 0 ? "\u2190 BACK" : "\u2190"}</Text>
          </Pressable>
          <Text style={styles.progressText}>{currentQ + 1} / {QUIZ_QUESTIONS.length}</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((currentQ + 1) / QUIZ_QUESTIONS.length) * 100}%` }]} />
        </View>

        <Animated.View key={currentQ} entering={entering}>
          <Text style={styles.title}>{question.question}</Text>

          <View style={styles.options}>
            {question.options.map((opt, i) => {
              const isSelected = selected === i;
              return (
                <Animated.View key={i} style={isSelected ? pulseStyle : undefined}>
                  <Pressable
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => handleSelect(i)}
                  >
                    <Text style={[styles.optionLetter, isSelected && styles.optionLetterSelected]}>
                      {String.fromCharCode(65 + i)}
                    </Text>
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {opt.text}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Next button */}
      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.btn, selected === null && styles.btnDisabled]}
          onPress={handleNext}
          disabled={selected === null}
        >
          <Text style={[styles.btnText, selected === null && styles.btnTextDisabled]}>
            {isLast ? "SEE MY RESULT" : "NEXT"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 },

  topBar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: spacing.md,
  },
  backText: { ...fonts.kicker, fontSize: 11, color: colors.textMuted },
  progressText: { ...fonts.mono, fontSize: 12, color: colors.textMuted },

  progressTrack: {
    height: 2, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 1, marginBottom: spacing.xl, overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 1 },

  title: {
    fontSize: 22, fontWeight: "700", color: colors.text, lineHeight: 30,
    marginBottom: spacing["2xl"], textAlign: "center",
  },

  options: { gap: spacing.md },
  option: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
  },
  optionSelected: {
    borderColor: "rgba(255,255,255,0.24)", backgroundColor: "rgba(255,255,255,0.06)",
  },
  optionLetter: {
    ...fonts.kicker, fontSize: 12, color: colors.textMuted,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.06)",
    textAlign: "center", lineHeight: 26, overflow: "hidden",
  },
  optionLetterSelected: { backgroundColor: colors.primary, color: "#000" },
  optionText: { fontSize: 15, color: colors.text, flex: 1, lineHeight: 21 },
  optionTextSelected: { fontWeight: "600" },

  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg, paddingBottom: spacing["3xl"], paddingTop: spacing.md,
    backgroundColor: colors.bg,
  },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.lg, alignItems: "center",
  },
  btnDisabled: { backgroundColor: "rgba(255,255,255,0.08)" },
  btnText: { ...fonts.kicker, fontSize: 13, color: "#000", letterSpacing: 2 },
  btnTextDisabled: { color: colors.textMuted },
});
