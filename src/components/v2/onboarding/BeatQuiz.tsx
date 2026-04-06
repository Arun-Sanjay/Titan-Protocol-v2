import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutRight,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { playVoiceLineAsync, stopCurrentAudio } from "../../../lib/protocol-audio";
import { QUIZ_QUESTIONS } from "../../../data/identity-quiz";
import { scoreQuiz } from "../../../lib/quiz-scoring";
import type { EngineKey } from "../../../db/schema";

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  onComplete: (archetype: string) => void;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const AUTO_ADVANCE_MS = 600;
const TRANSITION_MS = 300;
const ANALYSIS_DURATION_MS = 3000;
const SLOT_INTERVAL_MS = 120;

const ENGINE_COLORS: Record<string, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  charisma: colors.charisma,
};

const ARCHETYPE_NAMES = [
  "TITAN", "ATHLETE", "SCHOLAR", "HUSTLER",
  "SHOWMAN", "WARRIOR", "FOUNDER", "CHARMER",
];

// ─── Component ───────────────────────────────────────────────────────────────

export function BeatQuiz({ onComplete }: Props) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>(
    Array(QUIZ_QUESTIONS.length).fill(-1),
  );
  const [phase, setPhase] = useState<"quiz" | "analyzing">("quiz");
  const [transitioning, setTransitioning] = useState(false);
  const [slotText, setSlotText] = useState(ARCHETYPE_NAMES[0]);
  const slotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Loading ring progress
  const ringProgress = useSharedValue(0);

  const ringStyle = useAnimatedStyle(() => {
    // Represents a clockwise fill as a right-clipping mask width
    const degrees = ringProgress.value * 360;
    return { opacity: 1 };
  });

  // Play intro voice on mount
  useEffect(() => {
    playVoiceLineAsync("ONBO-007");
    return () => {
      stopCurrentAudio();
      if (slotIntervalRef.current) clearInterval(slotIntervalRef.current);
    };
  }, []);

  const question = QUIZ_QUESTIONS[currentQ];
  const isLast = currentQ === QUIZ_QUESTIONS.length - 1;

  // Handle option selection
  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (selectedOption !== null || transitioning) return;

      setSelectedOption(optionIndex);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Record answer
      const newAnswers = [...answers];
      newAnswers[currentQ] = optionIndex;
      setAnswers(newAnswers);

      // Auto-advance after delay
      setTimeout(() => {
        if (isLast) {
          // Enter analysis phase
          startAnalysis(newAnswers);
        } else {
          setTransitioning(true);
          setTimeout(() => {
            setCurrentQ((q) => q + 1);
            setSelectedOption(null);
            setTransitioning(false);
          }, TRANSITION_MS);
        }
      }, AUTO_ADVANCE_MS);
    },
    [selectedOption, transitioning, answers, currentQ, isLast],
  );

  // Analysis phase: loading ring + slot machine
  const startAnalysis = useCallback(
    (finalAnswers: number[]) => {
      setPhase("analyzing");
      playVoiceLineAsync("ONBO-008");

      // Animate ring fill over ANALYSIS_DURATION_MS
      ringProgress.value = withTiming(1, {
        duration: ANALYSIS_DURATION_MS,
        easing: Easing.linear,
      });

      // Slot machine text cycling - starts fast, slows down
      let tick = 0;
      const totalTicks = Math.floor(ANALYSIS_DURATION_MS / SLOT_INTERVAL_MS);
      slotIntervalRef.current = setInterval(() => {
        tick++;
        // Slow down toward end
        const idx = tick % ARCHETYPE_NAMES.length;
        setSlotText(ARCHETYPE_NAMES[idx]);

        if (tick >= totalTicks) {
          if (slotIntervalRef.current) clearInterval(slotIntervalRef.current);
          // Compute result and complete
          const result = scoreQuiz(finalAnswers);
          setSlotText(result.archetype.toUpperCase());
          setTimeout(() => {
            onComplete(result.archetype);
          }, 300);
        }
      }, SLOT_INTERVAL_MS);
    },
    [onComplete, ringProgress],
  );

  // ─── Analysis Phase Render ─────────────────────────────────────────────

  if (phase === "analyzing") {
    return (
      <View style={styles.container}>
        <Animated.View
          entering={FadeIn.duration(400)}
          style={styles.analysisCenter}
        >
          {/* Circular loading ring */}
          <View style={styles.ringContainer}>
            <RingProgress progress={ringProgress} />
            {/* Slot machine text inside ring */}
            <Text style={styles.slotText}>{slotText}</Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  // ─── Quiz Phase Render ─────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>DIAGNOSTIC SCAN</Text>
        <Text style={styles.headerProgress}>
          {String(currentQ + 1).padStart(2, "0")}/{String(QUIZ_QUESTIONS.length).padStart(2, "0")}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${((currentQ + 1) / QUIZ_QUESTIONS.length) * 100}%` },
          ]}
        />
      </View>

      {/* Question + Options */}
      <View style={styles.questionArea}>
        <Animated.View
          key={currentQ}
          entering={SlideInRight.duration(TRANSITION_MS)}
          exiting={SlideOutRight.duration(TRANSITION_MS)}
        >
          <Text style={styles.questionText}>{question.question}</Text>

          <View style={styles.optionsContainer}>
            {question.options.map((opt, i) => {
              const isSelected = selectedOption === i;
              const isFaded = selectedOption !== null && !isSelected;
              const engineColor = ENGINE_COLORS[opt.engine] ?? colors.text;

              return (
                <Pressable
                  key={i}
                  style={[
                    styles.optionCard,
                    isSelected && { borderColor: engineColor },
                    isFaded && styles.optionFaded,
                  ]}
                  onPress={() => handleSelect(i)}
                  disabled={selectedOption !== null}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isFaded && styles.optionTextFaded,
                    ]}
                  >
                    {opt.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Ring Progress Sub-component ─────────────────────────────────────────────
// Renders a circular ring that fills clockwise using 4 quadrant clipping masks.

function RingProgress({
  progress,
}: {
  progress: Animated.SharedValue<number>;
}) {
  const RING_SIZE = 160;
  const RING_WIDTH = 3;
  const HALF = RING_SIZE / 2;

  // We approximate a clockwise fill using opacity on 8 arc segments
  // Each segment covers 45 degrees worth of the ring
  const segments = 8;

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE }}>
      {/* Background ring (dim) */}
      <View
        style={{
          position: "absolute",
          width: RING_SIZE,
          height: RING_SIZE,
          borderRadius: HALF,
          borderWidth: RING_WIDTH,
          borderColor: "rgba(255, 255, 255, 0.08)",
        }}
      />
      {/* Animated fill ring - use a simple rotating approach */}
      {Array.from({ length: segments }).map((_, i) => {
        const segmentFraction = (i + 1) / segments;
        return (
          <RingSegment
            key={i}
            index={i}
            progress={progress}
            threshold={segmentFraction}
            size={RING_SIZE}
            width={RING_WIDTH}
            segments={segments}
          />
        );
      })}
    </View>
  );
}

function RingSegment({
  index,
  progress,
  threshold,
  size,
  width,
  segments,
}: {
  index: number;
  progress: Animated.SharedValue<number>;
  threshold: number;
  size: number;
  width: number;
  segments: number;
}) {
  const half = size / 2;
  const startAngle = (index / segments) * 360 - 90; // Start from top
  const endAngle = ((index + 1) / segments) * 360 - 90;

  const animStyle = useAnimatedStyle(() => {
    const show = progress.value >= (index / segments);
    const segProgress = Math.min(
      1,
      Math.max(0, (progress.value - index / segments) * segments),
    );
    return {
      opacity: show ? Math.min(1, segProgress * 2 + 0.3) : 0,
    };
  });

  // Position a small arc segment using rotation
  const midAngle = (startAngle + endAngle) / 2;
  const radians = (midAngle * Math.PI) / 180;
  const dotX = half + Math.cos(radians) * (half - width / 2);
  const dotY = half + Math.sin(radians) * (half - width / 2);

  // We use a series of small circles to approximate the arc
  const arcPoints = 4;
  return (
    <>
      {Array.from({ length: arcPoints }).map((_, j) => {
        const t = j / arcPoints;
        const angle = startAngle + t * (endAngle - startAngle);
        const rad = (angle * Math.PI) / 180;
        const x = half + Math.cos(rad) * (half - width / 2);
        const y = half + Math.sin(rad) * (half - width / 2);

        return (
          <Animated.View
            key={`${index}-${j}`}
            style={[
              {
                position: "absolute",
                left: x - width,
                top: y - width,
                width: width * 2,
                height: width * 2,
                borderRadius: width,
                backgroundColor: colors.body,
              },
              animStyle,
            ]}
          />
        );
      })}
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const monoFont = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  headerLabel: {
    fontFamily: monoFont,
    fontSize: 11,
    color: colors.body,
    letterSpacing: 3,
    fontWeight: "700",
  },
  headerProgress: {
    fontFamily: monoFont,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.50)",
    letterSpacing: 1,
  },

  // Progress bar
  progressTrack: {
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 1,
    marginBottom: spacing["2xl"],
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.body,
    borderRadius: 1,
  },

  // Question area
  questionArea: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: spacing["5xl"],
  },
  questionText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 26,
    textAlign: "center",
    marginBottom: spacing["2xl"],
  },

  // Option cards
  optionsContainer: {
    gap: spacing.md,
  },
  optionCard: {
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    width: "100%",
  },
  optionFaded: {
    opacity: 0.3,
  },
  optionText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
    textAlign: "left",
  },
  optionTextFaded: {
    color: colors.textMuted,
  },

  // Analysis phase
  analysisCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  ringContainer: {
    width: 160,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
  },
  slotText: {
    position: "absolute",
    fontFamily: monoFont,
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 2,
    textAlign: "center",
  },
});
