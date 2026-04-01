import React, { useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fonts } from "../src/theme";
import { Panel } from "../src/components/ui/Panel";
import { PageHeader } from "../src/components/ui/PageHeader";
import { useMindTrainingStore, type Exercise } from "../src/stores/useMindTrainingStore";
import { BiasCheck } from "../src/components/v2/mind-training/BiasCheck";
import { DecisionDrill } from "../src/components/v2/mind-training/DecisionDrill";
import { KnowledgeDrop } from "../src/components/v2/mind-training/KnowledgeDrop";

import biasChecks from "../src/data/exercises/bias-checks.json";
import decisionDrills from "../src/data/exercises/decision-drills.json";
import knowledgeDrops from "../src/data/exercises/knowledge-drops.json";

type TrainingMode = "menu" | "bias_check" | "decision_drill" | "knowledge_drop";

const ALL_EXERCISES = [
  ...(biasChecks as Exercise[]),
  ...(decisionDrills as Exercise[]),
  ...(knowledgeDrops as Exercise[]),
];

export default function MindTrainingScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<TrainingMode>("menu");
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);

  const stats = useMindTrainingStore((s) => s.stats);
  const seenIds = useMindTrainingStore((s) => s.seenIds);
  const submitAnswer = useMindTrainingStore((s) => s.submitAnswer);

  const biasStats = stats.byType["bias_check"];
  const drillStats = stats.byType["decision_drill"];
  const dropStats = stats.byType["knowledge_drop"];

  function startPractice(type: TrainingMode) {
    const pool = type === "bias_check"
      ? biasChecks as Exercise[]
      : type === "decision_drill"
        ? decisionDrills as Exercise[]
        : knowledgeDrops as Exercise[];

    const unseen = pool.filter((e) => !seenIds.includes(e.id));
    const exercise = unseen.length > 0
      ? unseen[Math.floor(Math.random() * unseen.length)]
      : pool[Math.floor(Math.random() * pool.length)];

    setCurrentExercise(exercise);
    setMode(type);
  }

  function handleComplete(selectedId: string, correct: boolean) {
    if (!currentExercise) return;
    submitAnswer(currentExercise.id, selectedId, correct, currentExercise.type, currentExercise.category);
    setCurrentExercise(null);
    setMode("menu");
  }

  // Exercise in progress
  if (mode !== "menu" && currentExercise) {
    const Component = mode === "bias_check"
      ? BiasCheck
      : mode === "decision_drill"
        ? DecisionDrill
        : KnowledgeDrop;

    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.exerciseHeader}>
          <Pressable onPress={() => { setMode("menu"); setCurrentExercise(null); }} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.exerciseHeaderTitle}>
            {mode === "bias_check" ? "BIAS CHECK" : mode === "decision_drill" ? "DECISION DRILL" : "KNOWLEDGE DROP"}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.exerciseContent}>
          <Component exercise={currentExercise} onComplete={handleComplete} />
        </View>
      </SafeAreaView>
    );
  }

  // Menu
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.backRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <PageHeader kicker="MIND ENGINE" title="MIND TRAINING" subtitle="Sharpen your thinking. Build mental models." />

        {/* Overall stats */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.totalCompleted}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.accuracy}%</Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{seenIds.length}</Text>
            <Text style={styles.statLabel}>Concepts</Text>
          </View>
        </Animated.View>

        {/* Section cards */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <Panel style={styles.sectionCard} onPress={() => startPractice("bias_check")}>
            <View style={styles.sectionRow}>
              <View style={[styles.sectionIcon, { backgroundColor: "rgba(167, 139, 250, 0.12)" }]}>
                <Ionicons name="eye-outline" size={24} color={colors.mind} />
              </View>
              <View style={styles.sectionText}>
                <Text style={styles.sectionTitle}>Bias Check</Text>
                <Text style={styles.sectionDesc}>
                  {biasStats ? `${biasStats.completed} done · ${biasStats.accuracy}% accuracy` : `${(biasChecks as Exercise[]).length} exercises`}
                </Text>
              </View>
              <Text style={styles.practiceText}>Practice</Text>
            </View>
          </Panel>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(180).duration(400)}>
          <Panel style={styles.sectionCard} onPress={() => startPractice("decision_drill")}>
            <View style={styles.sectionRow}>
              <View style={[styles.sectionIcon, { backgroundColor: "rgba(96, 165, 250, 0.12)" }]}>
                <Ionicons name="git-branch-outline" size={24} color={colors.charisma} />
              </View>
              <View style={styles.sectionText}>
                <Text style={styles.sectionTitle}>Decision Drill</Text>
                <Text style={styles.sectionDesc}>
                  {drillStats ? `${drillStats.completed} done · ${drillStats.accuracy}% accuracy` : `${(decisionDrills as Exercise[]).length} exercises`}
                </Text>
              </View>
              <Text style={styles.practiceText}>Practice</Text>
            </View>
          </Panel>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(260).duration(400)}>
          <Panel style={styles.sectionCard} onPress={() => startPractice("knowledge_drop")}>
            <View style={styles.sectionRow}>
              <View style={[styles.sectionIcon, { backgroundColor: "rgba(251, 191, 36, 0.12)" }]}>
                <Ionicons name="bulb-outline" size={24} color={colors.warning} />
              </View>
              <View style={styles.sectionText}>
                <Text style={styles.sectionTitle}>Knowledge Drop</Text>
                <Text style={styles.sectionDesc}>
                  {dropStats ? `${dropStats.completed} done · ${dropStats.accuracy}% accuracy` : `${(knowledgeDrops as Exercise[]).length} micro-lessons`}
                </Text>
              </View>
              <Text style={styles.practiceText}>Practice</Text>
            </View>
          </Panel>
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  backRow: { paddingVertical: spacing.md },
  exerciseHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  exerciseHeaderTitle: { ...fonts.kicker, letterSpacing: 3 },
  exerciseContent: { flex: 1, paddingHorizontal: spacing.lg },
  statsRow: {
    flexDirection: "row", justifyContent: "space-around",
    paddingVertical: spacing.xl, marginBottom: spacing.lg,
  },
  statBox: { alignItems: "center", gap: spacing.xs },
  statValue: { ...fonts.monoValue, fontSize: 24 },
  statLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  sectionCard: { marginBottom: spacing.md, padding: spacing.lg },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  sectionIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sectionText: { flex: 1, gap: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  sectionDesc: { fontSize: 12, color: colors.textMuted },
  practiceText: { fontSize: 13, fontWeight: "600", color: colors.mind },
});
