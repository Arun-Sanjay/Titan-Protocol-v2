import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, FadeInDown, FadeInUp,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../src/theme";
import { Panel } from "../src/components/ui/Panel";
import { getTodayKey } from "../src/lib/date";
import { useHabitStore } from "../src/stores/useHabitStore";
import { useProtocolStore } from "../src/stores/useProtocolStore";
import { useModeStore, type IdentityArchetype, IDENTITY_LABELS } from "../src/stores/useModeStore";
import { useProfileStore, XP_REWARDS } from "../src/stores/useProfileStore";
import { useEngineStore, selectTotalScore } from "../src/stores/useEngineStore";

// ─── Hardcoded Bias Check Exercises ──────────────────────────────────────────

type BiasExercise = {
  id: string;
  bias: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

const BIAS_EXERCISES: BiasExercise[] = [
  {
    id: "confirmation_bias",
    bias: "Confirmation Bias",
    question: "You read a news article that confirms your existing view on a topic. What should you do?",
    options: [
      "Share it immediately — it proves your point",
      "Seek out a credible source with the opposing view",
      "Assume you're right and move on",
    ],
    correctIndex: 1,
    explanation: "Confirmation bias makes us seek info that confirms what we already believe. Actively seeking the counter-argument strengthens your thinking.",
  },
  {
    id: "sunk_cost",
    bias: "Sunk Cost Fallacy",
    question: "You've spent 2 hours on a project that clearly won't work. What's the rational move?",
    options: [
      "Keep going — you've already invested so much",
      "Stop now and redirect effort to something better",
      "Finish it out of respect for the time spent",
    ],
    correctIndex: 1,
    explanation: "Time already spent can't be recovered. The only thing that matters is future value. Stopping is rational, not wasteful.",
  },
  {
    id: "availability_heuristic",
    bias: "Availability Heuristic",
    question: "After seeing several plane crash news stories, you think flying is very dangerous. What's actually true?",
    options: [
      "You're right — if it's in the news, it must be common",
      "Flying is statistically far safer than driving",
      "News doesn't affect how we perceive risk",
    ],
    correctIndex: 1,
    explanation: "We overestimate the likelihood of vivid, memorable events. Plane crashes get news coverage precisely because they're rare.",
  },
  {
    id: "dunning_kruger",
    bias: "Dunning-Kruger Effect",
    question: "You've just started learning a new skill. When are you most likely to overestimate your ability?",
    options: [
      "After years of deep practice",
      "Right at the beginning, with just a little knowledge",
      "Never — more knowledge always means more confidence",
    ],
    correctIndex: 1,
    explanation: "Beginners often overestimate their competence because they don't yet know what they don't know. Experts are usually more humble.",
  },
  {
    id: "anchoring",
    bias: "Anchoring Bias",
    question: "A product is listed at $500, then 'discounted' to $300. You feel like you're getting a great deal. Why might this be misleading?",
    options: [
      "Because the original price anchors your perception of value",
      "Because $300 is always a good price",
      "Because discounts are never real",
    ],
    correctIndex: 0,
    explanation: "The anchor ($500) sets a reference point that makes $300 seem like a bargain — even if the real market value is $250.",
  },
];

function pickDailyExercise(dateKey: string): BiasExercise {
  // Deterministic pick based on date so it's consistent within a day
  const idx = dateKey.split("-").reduce((acc, p) => acc + parseInt(p, 10), 0) % BIAS_EXERCISES.length;
  return BIAS_EXERCISES[idx];
}

// ─── Phase types ──────────────────────────────────────────────────────────────

type Phase = "intention" | "mind_check" | "habit_check" | "score_reveal";

const PHASE_ORDER: Phase[] = ["intention", "mind_check", "habit_check", "score_reveal"];

// ─── ProgressDots ─────────────────────────────────────────────────────────────

function ProgressDots({ current }: { current: number }) {
  return (
    <View style={dotStyles.row}>
      {PHASE_ORDER.map((_, i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            i < current && dotStyles.done,
            i === current && dotStyles.active,
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, justifyContent: "center", marginBottom: spacing.xl },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  done: { backgroundColor: colors.success },
  active: { backgroundColor: colors.text, width: 20 },
});

// ─── Phase 1 — Intention ──────────────────────────────────────────────────────

function IntentionPhase({
  value,
  onChange,
  onNext,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ flex: 1 }}>
      <Text style={phaseStyles.kicker}>PHASE 1 OF 4</Text>
      <Text style={phaseStyles.title}>Set Your{"\n"}Intention</Text>
      <Text style={phaseStyles.subtitle}>
        One sentence. What is your single most important focus today?
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="e.g. Ship the feature without cutting corners"
        placeholderTextColor={colors.textMuted}
        style={phaseStyles.input}
        multiline
        autoFocus
        returnKeyType="done"
        onSubmitEditing={value.trim().length > 3 ? onNext : undefined}
      />
      <Pressable
        style={[phaseStyles.nextBtn, value.trim().length < 3 && phaseStyles.nextBtnDisabled]}
        onPress={onNext}
        disabled={value.trim().length < 3}
      >
        <Text style={phaseStyles.nextBtnText}>NEXT →</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Phase 2 — Mind Check ─────────────────────────────────────────────────────

function MindCheckPhase({
  exercise,
  onNext,
}: {
  exercise: BiasExercise;
  onNext: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const correct = selected === exercise.correctIndex;

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <Text style={phaseStyles.kicker}>PHASE 2 OF 4 · MIND CHECK</Text>
      <Text style={phaseStyles.title}>Bias{"\n"}Training</Text>
      <View style={mindStyles.biasTag}>
        <Text style={mindStyles.biasLabel}>{exercise.bias}</Text>
      </View>
      <Text style={mindStyles.question}>{exercise.question}</Text>

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        {exercise.options.map((opt, idx) => {
          let bg = "rgba(255,255,255,0.04)";
          let border = "rgba(255,255,255,0.12)";
          if (answered) {
            if (idx === exercise.correctIndex) {
              bg = colors.successDim;
              border = colors.success;
            } else if (idx === selected) {
              bg = colors.dangerDim;
              border = colors.danger;
            }
          }
          return (
            <Pressable
              key={idx}
              style={[mindStyles.option, { backgroundColor: bg, borderColor: border }]}
              onPress={() => handleSelect(idx)}
            >
              <Text style={mindStyles.optionText}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>

      {answered && (
        <Animated.View entering={FadeInUp.duration(300)} style={mindStyles.explanation}>
          <Text style={mindStyles.explanationTitle}>{correct ? "✓ Correct" : "Not quite"}</Text>
          <Text style={mindStyles.explanationText}>{exercise.explanation}</Text>
        </Animated.View>
      )}

      {answered && (
        <Animated.View entering={FadeInUp.delay(200).duration(300)}>
          <Pressable style={phaseStyles.nextBtn} onPress={() => onNext(correct)}>
            <Text style={phaseStyles.nextBtnText}>NEXT →</Text>
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const mindStyles = StyleSheet.create({
  biasTag: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryDim,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  biasLabel: { ...fonts.kicker, fontSize: 9, color: colors.textSecondary },
  question: { fontSize: 16, color: colors.text, lineHeight: 24, fontWeight: "500" },
  option: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  explanation: {
    marginTop: spacing.lg,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: spacing.lg,
  },
  explanationTitle: { ...fonts.kicker, fontSize: 10, color: colors.success, marginBottom: spacing.sm },
  explanationText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
});

// ─── Phase 3 — Habit Check ────────────────────────────────────────────────────

function HabitCheckPhase({
  habits,
  checked,
  onToggle,
  onNext,
  dateKey,
}: {
  habits: { id: number; title: string; icon: string }[];
  checked: Record<number, boolean>;
  onToggle: (id: number) => void;
  onNext: () => void;
  dateKey: string;
}) {
  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <Text style={phaseStyles.kicker}>PHASE 3 OF 4</Text>
      <Text style={phaseStyles.title}>Habit{"\n"}Check-In</Text>
      <Text style={phaseStyles.subtitle}>
        Which habits did you complete yesterday? Check them off.
      </Text>

      {habits.length === 0 ? (
        <View style={habitStyles.empty}>
          <Text style={habitStyles.emptyText}>No habits yet</Text>
          <Text style={habitStyles.emptyHint}>Add habits in the Track tab to see them here</Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {habits.map((h) => {
            const done = !!checked[h.id];
            return (
              <Pressable
                key={h.id}
                style={[habitStyles.row, done && habitStyles.rowDone]}
                onPress={() => onToggle(h.id)}
              >
                <View style={[habitStyles.check, done && habitStyles.checkDone]}>
                  {done && <Text style={habitStyles.checkMark}>✓</Text>}
                </View>
                <Text style={habitStyles.icon}>{h.icon}</Text>
                <Text style={[habitStyles.title, done && habitStyles.titleDone]}>
                  {h.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={habitStyles.count}>
        {checkedCount}/{habits.length} habits checked
      </Text>

      <Pressable style={phaseStyles.nextBtn} onPress={onNext}>
        <Text style={phaseStyles.nextBtnText}>SEE SCORE →</Text>
      </Pressable>
    </Animated.View>
  );
}

const habitStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowDone: {
    backgroundColor: colors.successDim,
    borderColor: colors.success + "30",
  },
  check: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { fontSize: 13, color: "#000", fontWeight: "700" },
  icon: { fontSize: 18 },
  title: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.text },
  titleDone: { color: colors.textMuted },
  empty: { alignItems: "center", paddingVertical: spacing["3xl"] },
  emptyText: { fontSize: 16, fontWeight: "600", color: colors.text },
  emptyHint: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, textAlign: "center" },
  count: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginTop: spacing.lg, textAlign: "right" },
});

// ─── Phase 4 — Score Reveal ───────────────────────────────────────────────────

const IDENTITY_ICONS: Record<IdentityArchetype, string> = {
  titan: "⚡",
  athlete: "🏆",
  scholar: "📚",
  hustler: "💰",
  showman: "🎤",
  warrior: "⚔️",
  founder: "🚀",
  charmer: "✨",
};

function ScoreRevealPhase({
  score,
  intention,
  identity,
  onVote,
  onFinish,
}: {
  score: number;
  intention: string;
  identity: IdentityArchetype | null;
  onVote: (id: IdentityArchetype) => void;
  onFinish: () => void;
}) {
  const [voted, setVoted] = useState<IdentityArchetype | null>(identity);

  const ARCHETYPES: IdentityArchetype[] = [
    "titan", "athlete", "scholar", "hustler", "showman", "warrior", "founder", "charmer",
  ];

  const handleVote = (id: IdentityArchetype) => {
    setVoted(id);
    onVote(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const scoreColor =
    score >= 85 ? colors.rankS :
    score >= 70 ? colors.rankA :
    score >= 50 ? colors.rankB :
    score >= 30 ? colors.rankC : colors.rankD;

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <Text style={phaseStyles.kicker}>PROTOCOL COMPLETE</Text>
      <Text style={phaseStyles.title}>Today's{"\n"}Score</Text>

      {/* Score ring */}
      <Animated.View entering={FadeInUp.delay(200).duration(500)} style={scoreStyles.ring}>
        <Text style={[scoreStyles.scoreValue, { color: scoreColor }]}>
          {score}
        </Text>
        <Text style={scoreStyles.scorePct}>%</Text>
      </Animated.View>

      {/* Intention echo */}
      <View style={scoreStyles.intentionWrap}>
        <Text style={scoreStyles.intentionLabel}>TODAY'S FOCUS</Text>
        <Text style={scoreStyles.intentionText}>"{intention}"</Text>
      </View>

      {/* Identity vote */}
      <Text style={scoreStyles.voteLabel}>I TRAINED AS</Text>
      <View style={scoreStyles.voteGrid}>
        {ARCHETYPES.map((id) => (
          <Pressable
            key={id}
            style={[
              scoreStyles.voteBtn,
              voted === id && { borderColor: colors.primary, backgroundColor: colors.primaryDim },
            ]}
            onPress={() => handleVote(id)}
          >
            <Text style={scoreStyles.voteIcon}>{IDENTITY_ICONS[id]}</Text>
            <Text style={[scoreStyles.voteName, voted === id && { color: colors.primary }]}>
              {id.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={[phaseStyles.nextBtn, { marginTop: spacing.xl }]} onPress={onFinish}>
        <Text style={phaseStyles.nextBtnText}>DONE ✓</Text>
      </Pressable>
    </Animated.View>
  );
}

const scoreStyles = StyleSheet.create({
  ring: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingVertical: spacing["2xl"],
  },
  scoreValue: { fontSize: 80, fontWeight: "200", fontFamily: "monospace", lineHeight: 84 },
  scorePct: { fontSize: 28, fontWeight: "300", color: colors.textSecondary, marginBottom: 12, marginLeft: 2 },
  intentionWrap: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  intentionLabel: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.xs },
  intentionText: { fontSize: 15, color: colors.textSecondary, fontStyle: "italic", lineHeight: 22 },
  voteLabel: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.md },
  voteGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  voteBtn: {
    flex: 1,
    minWidth: "28%",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 4,
  },
  voteIcon: { fontSize: 20 },
  voteName: { ...fonts.kicker, fontSize: 8, color: colors.textMuted },
});

// ─── Shared phase styles ──────────────────────────────────────────────────────

const phaseStyles = StyleSheet.create({
  kicker: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.sm },
  title: { fontSize: 36, fontWeight: "200", color: colors.text, lineHeight: 42, marginBottom: spacing.md },
  subtitle: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.xl },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: spacing.lg,
  },
  nextBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  nextBtnDisabled: { opacity: 0.3 },
  nextBtnText: { ...fonts.kicker, fontSize: 12, color: "#000", letterSpacing: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProtocolScreen() {
  const router = useRouter();
  const today = getTodayKey();

  const habits = useHabitStore((s) => s.habits);
  const loadHabits = useHabitStore((s) => s.load);
  const completeSession = useProtocolStore((s) => s.completeSession);
  const identity = useModeStore((s) => s.identity);
  const setIdentity = useModeStore((s) => s.setIdentity);
  const awardXP = useProfileStore((s) => s.awardXP);
  const updateStreak = useProfileStore((s) => s.updateStreak);
  const scores = useEngineStore((s) => s.scores);

  // Load habits on mount
  React.useEffect(() => {
    loadHabits(today);
  }, [today]);

  const [phaseIdx, setPhaseIdx] = useState(0);
  const phase = PHASE_ORDER[phaseIdx];

  // Phase 1
  const [intention, setIntention] = useState("");

  // Phase 2
  const exercise = React.useMemo(() => pickDailyExercise(today), [today]);
  const [mindCorrect, setMindCorrect] = useState(false);

  // Phase 3
  const [habitChecks, setHabitChecks] = useState<Record<number, boolean>>({});
  const toggleHabitCheck = useCallback((id: number) => {
    setHabitChecks((prev) => ({ ...prev, [id]: !prev[id] }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Phase 4
  const titanScore = React.useMemo(
    () => selectTotalScore(scores, today),
    [scores, today]
  );

  const [votedIdentity, setVotedIdentity] = useState<IdentityArchetype | null>(identity);

  const goNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhaseIdx((p) => Math.min(p + 1, PHASE_ORDER.length - 1));
  }, []);

  const handleMindNext = useCallback((correct: boolean) => {
    setMindCorrect(correct);
    goNext();
  }, [goNext]);

  const handleVote = useCallback((id: IdentityArchetype) => {
    setVotedIdentity(id);
    setIdentity(id);
  }, [setIdentity]);

  const handleFinish = useCallback(() => {
    // Save the session
    completeSession({
      dateKey: today,
      completedAt: Date.now(),
      intention: intention.trim(),
      habitChecks,
      titanScore,
      identityVote: votedIdentity,
    });

    // Award XP for completing the protocol
    awardXP(today, "protocol_complete", 30);
    updateStreak(today);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, [today, intention, habitChecks, titanScore, votedIdentity, completeSession, awardXP, updateStreak, router]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.closeBtn}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle}>DAILY PROTOCOL</Text>
        <View style={{ width: 32 }} />
      </View>

      <ProgressDots current={phaseIdx} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {phase === "intention" && (
            <IntentionPhase
              value={intention}
              onChange={setIntention}
              onNext={goNext}
            />
          )}

          {phase === "mind_check" && (
            <MindCheckPhase
              exercise={exercise}
              onNext={handleMindNext}
            />
          )}

          {phase === "habit_check" && (
            <HabitCheckPhase
              habits={habits.map((h) => ({ id: h.id!, title: h.title, icon: h.icon }))}
              checked={habitChecks}
              onToggle={toggleHabitCheck}
              onNext={goNext}
              dateKey={today}
            />
          )}

          {phase === "score_reveal" && (
            <ScoreRevealPhase
              score={titanScore}
              intention={intention}
              identity={votedIdentity}
              onVote={handleVote}
              onFinish={handleFinish}
            />
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  closeBtn: { fontSize: 18, color: colors.textMuted, fontWeight: "300", width: 32, textAlign: "center" },
  headerTitle: { ...fonts.kicker, fontSize: 10, color: colors.textMuted },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
});
