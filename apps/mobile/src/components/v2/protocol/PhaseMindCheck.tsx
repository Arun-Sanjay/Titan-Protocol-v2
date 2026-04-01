import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors, fonts } from "../../../theme";
import { useProtocolStore } from "../../../stores/useProtocolStore";
import { useMindTrainingStore, type Exercise } from "../../../stores/useMindTrainingStore";
import { BiasCheck } from "../mind-training/BiasCheck";
import { DecisionDrill } from "../mind-training/DecisionDrill";
import { RecallChallenge } from "../mind-training/RecallChallenge";
import type { SRSCard } from "../../../lib/srs";
import biasChecks from "../../../data/exercises/bias-checks.json";
import decisionDrills from "../../../data/exercises/decision-drills.json";

const ALL_EXERCISES: Exercise[] = [
  ...(biasChecks as Exercise[]),
  ...(decisionDrills as Exercise[]),
];

export function PhaseMindCheck() {
  const completePhase = useProtocolStore((s) => s.completePhase);
  const submitAnswer = useMindTrainingStore((s) => s.submitAnswer);
  const updateSRSCard = useMindTrainingStore((s) => s.updateSRSCard);
  const seenIds = useMindTrainingStore((s) => s.seenIds);
  const srsCards = useMindTrainingStore((s) => s.srsCards);
  const getDueCards = useMindTrainingStore((s) => s.getDueCards);

  // Determine mode: recall (30% chance if due cards exist) or new exercise
  const { mode, exercise, dueCard } = useMemo<{
    mode: "new" | "recall";
    exercise: Exercise | null;
    dueCard: SRSCard | null;
  }>(() => {
    const due = getDueCards();

    // 30% chance of recall if there are due cards
    if (due.length > 0 && Math.random() < 0.3) {
      const card = due[0];
      const ex = ALL_EXERCISES.find((e) => e.id === card.exerciseId) ?? null;
      if (ex) return { mode: "recall", exercise: ex, dueCard: card };
    }

    // Pick unseen exercise (alternating bias/drill based on day)
    const dayParity = new Date().getDate() % 2;
    const primaryPool = dayParity === 0 ? biasChecks as Exercise[] : decisionDrills as Exercise[];
    const fallbackPool = dayParity === 0 ? decisionDrills as Exercise[] : biasChecks as Exercise[];

    let unseen = primaryPool.filter((e) => !seenIds.includes(e.id));
    if (unseen.length === 0) unseen = fallbackPool.filter((e) => !seenIds.includes(e.id));
    if (unseen.length === 0) unseen = ALL_EXERCISES; // All seen, just pick any

    return {
      mode: "new",
      exercise: unseen[Math.floor(Math.random() * unseen.length)] ?? null,
      dueCard: null,
    };
  }, [seenIds, srsCards]);

  function handleNewComplete(selectedId: string, correct: boolean) {
    if (!exercise) return;
    submitAnswer(exercise.id, selectedId, correct, exercise.type, exercise.category);
    completePhase("mind_check", { exerciseId: exercise.id, correct, isRecall: false });
  }

  function handleRecallComplete(selectedId: string, correct: boolean, quality: number, updatedCard: SRSCard) {
    if (!exercise) return;
    updateSRSCard(updatedCard);
    submitAnswer(exercise.id, selectedId, correct, exercise.type, exercise.category);
    completePhase("mind_check", { exerciseId: exercise.id, correct, isRecall: true });
  }

  if (!exercise) {
    return (
      <View style={styles.empty}>
        <Animated.Text entering={FadeIn.duration(400)} style={styles.emptyText}>
          No exercises available
        </Animated.Text>
      </View>
    );
  }

  // Recall mode
  if (mode === "recall" && dueCard) {
    return <RecallChallenge exercise={exercise} card={dueCard} onComplete={handleRecallComplete} />;
  }

  // New exercise — render based on type
  if (exercise.type === "decision_drill") {
    return <DecisionDrill exercise={exercise} onComplete={handleNewComplete} />;
  }

  return <BiasCheck exercise={exercise} onComplete={handleNewComplete} />;
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    ...fonts.body,
    color: colors.textMuted,
  },
});
