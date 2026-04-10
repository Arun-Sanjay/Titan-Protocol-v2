import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  FadeIn, FadeInDown, FadeInUp,
  useSharedValue, useAnimatedStyle, withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { colors, spacing, fonts, radius } from "../src/theme";
import { HUDBackground } from "../src/components/ui/AnimatedBackground";
import { getTodayKey } from "../src/lib/date";
import { getJSON } from "../src/db/storage";
import { getDailyRank } from "../src/db/gamification";
import { getCurrentChapter, getDayNumber } from "../src/data/chapters";
import { getLatestNarrative } from "../src/lib/narrative-engine";
import { evaluateAllTrees } from "../src/lib/skill-tree-evaluator";

// Phase 3.5e: all subcomponents now derive task/score data from cloud
// hooks (useAllTasks + useAllCompletionsForDate + computeEngineScore).
// useEngineStore and useHabitStore removed — no MMKV reads remain.
// XP_REWARDS is a pure const export; no MMKV reads involved.
import { XP_REWARDS } from "../src/stores/useProfileStore";
import { useAllTasks, useAllCompletionsForDate } from "../src/hooks/queries/useTasks";
import { computeEngineScore, ENGINES } from "../src/services/tasks";
import { useAwardXP, useUpdateStreak } from "../src/hooks/queries/useProfile";
import { useEnqueueRankUp } from "../src/hooks/queries/useRankUps";
import { useProtocolSession, useSaveMorningSession, useSaveEveningSession } from "../src/hooks/queries/useProtocol";
import { useModeStore, type IdentityArchetype, IDENTITY_LABELS } from "../src/stores/useModeStore";
import { useIdentityStore, selectIdentityMeta, IDENTITIES } from "../src/stores/useIdentityStore";
import type { EngineKey } from "../src/db/schema";

// ─── Constants ───────────────────────────────────────────────────────────────

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

const ENGINE_LABELS: Record<EngineKey, string> = {
  body: "Body",
  mind: "Mind",
  money: "Money",
  charisma: "Charisma",
};

// ─── Morning Phases ──────────────────────────────────────────────────────────

function MorningIntentionPhase({
  value,
  onChange,
  onNext,
  identity,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  identity: IdentityArchetype | null;
}) {
  const meta = identity ? selectIdentityMeta(identity) : null;

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ flex: 1 }}>
      {meta && (
        <Animated.View entering={FadeIn.duration(300)} style={phaseStyles.identityBadge}>
          <Text style={phaseStyles.identityIcon}>
            {identity ? IDENTITY_ICONS[identity] : ""}
          </Text>
          <Text style={phaseStyles.identityName}>{meta.name}</Text>
        </Animated.View>
      )}

      <Text style={phaseStyles.kicker}>PHASE 1 OF 3 · MORNING</Text>
      <Text style={phaseStyles.title}>{"What's your\n#1 focus today?"}</Text>
      <Text style={phaseStyles.subtitle}>
        One sentence. Your single most important intention for today.
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
        onSubmitEditing={value.trim().length >= 3 ? onNext : undefined}
      />

      <Pressable
        style={[phaseStyles.nextBtn, value.trim().length < 3 && phaseStyles.nextBtnDisabled]}
        onPress={onNext}
        disabled={value.trim().length < 3}
      >
        <Text style={phaseStyles.nextBtnText}>NEXT</Text>
      </Pressable>
    </Animated.View>
  );
}

function MorningMissionPreviewPhase({
  dateKey,
  onNext,
}: {
  dateKey: string;
  onNext: () => void;
}) {
  // Phase 3.5e: cloud-backed task list replaces useEngineStore reads.
  const { data: cloudTasks = [] } = useAllTasks();
  const { data: cloudCompletions = [] } = useAllCompletionsForDate(dateKey);

  const allTasks = useMemo(() => {
    const completedIds = new Set(cloudCompletions.map((c) => c.task_id));
    return cloudTasks.map((t) => ({ ...t, completed: completedIds.has(t.id) }));
  }, [cloudTasks, cloudCompletions]);

  // Group tasks by engine
  const grouped = useMemo(() => {
    const map: Record<EngineKey, typeof allTasks> = {
      body: [], mind: [], money: [], charisma: [],
    };
    for (const t of allTasks) {
      map[t.engine].push(t);
    }
    return map;
  }, [allTasks]);

  const engineCount = ENGINES.filter((e) => grouped[e].length > 0).length;

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <Text style={phaseStyles.kicker}>PHASE 2 OF 3 · MORNING</Text>
      <Text style={phaseStyles.title}>{"Today's\nMissions"}</Text>
      <Text style={phaseStyles.subtitle}>
        {allTasks.length} mission{allTasks.length !== 1 ? "s" : ""} loaded across{" "}
        {engineCount} engine{engineCount !== 1 ? "s" : ""}
      </Text>

      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        {ENGINES.map((engine) => {
          const engineTasks = grouped[engine];
          if (engineTasks.length === 0) return null;
          return (
            <Animated.View
              key={engine}
              entering={FadeInDown.delay(ENGINES.indexOf(engine) * 80).duration(300)}
              style={missionStyles.engineGroup}
            >
              <View style={missionStyles.engineHeader}>
                <View style={[missionStyles.engineDot, { backgroundColor: colors[engine] }]} />
                <Text style={missionStyles.engineLabel}>{ENGINE_LABELS[engine]}</Text>
              </View>
              {engineTasks.map((t) => (
                <View key={t.id} style={missionStyles.taskRow}>
                  <Text style={missionStyles.taskTitle}>{t.title}</Text>
                  <View
                    style={[
                      missionStyles.kindBadge,
                      t.kind === "main" ? missionStyles.kindMain : missionStyles.kindSecondary,
                    ]}
                  >
                    <Text style={missionStyles.kindText}>
                      {t.kind === "main" ? "MAIN" : "SIDE"}
                    </Text>
                  </View>
                </View>
              ))}
            </Animated.View>
          );
        })}
      </View>

      <Pressable style={[phaseStyles.nextBtn, { marginTop: spacing.xl }]} onPress={onNext}>
        <Text style={phaseStyles.nextBtnText}>NEXT</Text>
      </Pressable>
    </Animated.View>
  );
}

function MorningMotivationalPhase({
  identity,
  onFinish,
}: {
  identity: IdentityArchetype | null;
  onFinish: () => void;
}) {
  const firstActiveDate = getJSON<string | null>("first_active_date", null);
  const dayNumber = getDayNumber(firstActiveDate);
  const chapter = getCurrentChapter(dayNumber);
  const meta = identity ? selectIdentityMeta(identity) : null;

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: "center", flex: 1 }}>
      <Text style={phaseStyles.kicker}>PHASE 3 OF 3 · MORNING</Text>

      <Animated.View entering={FadeIn.delay(200).duration(400)} style={motivStyles.chapterCard}>
        <Text style={motivStyles.chapterNumber}>CHAPTER {chapter.number}</Text>
        <Text style={motivStyles.chapterName}>{chapter.name}</Text>
        <Text style={motivStyles.chapterSubtitle}>{chapter.subtitle}</Text>
      </Animated.View>

      {meta && (
        <Animated.View entering={FadeIn.delay(400).duration(400)} style={motivStyles.taglineWrap}>
          <Text style={motivStyles.tagline}>{meta.tagline}</Text>
        </Animated.View>
      )}

      <Animated.View entering={FadeInUp.delay(600).duration(400)} style={{ width: "100%", marginTop: spacing["2xl"] }}>
        <Pressable style={motivStyles.beginBtn} onPress={onFinish}>
          <Text style={motivStyles.beginBtnText}>BEGIN YOUR DAY</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Evening Phases ──────────────────────────────────────────────────────────

function EveningScoreRevealPhase({
  score,
  dateKey,
  onNext,
}: {
  score: number;
  dateKey: string;
  onNext: () => void;
}) {
  // Phase 3.5e: engine scores derived from cloud hooks instead of
  // useEngineStore.scores. The parent already fetches allTasks +
  // allCompletions, but this component needs per-engine breakdowns
  // so it runs its own queries (React Query deduplicates the fetch).
  const { data: cloudTasks = [] } = useAllTasks();
  const { data: cloudCompletions = [] } = useAllCompletionsForDate(dateKey);
  const completedIds = useMemo(
    () => new Set(cloudCompletions.map((c) => c.task_id)),
    [cloudCompletions],
  );
  const engineScores = useMemo(() => {
    const out: Record<EngineKey, number> = { body: 0, mind: 0, money: 0, charisma: 0 };
    for (const e of ENGINES) {
      const engineTasks = cloudTasks.filter((t) => t.engine === e);
      out[e] = engineTasks.length > 0 ? Math.round(computeEngineScore(engineTasks, completedIds)) : 0;
    }
    return out;
  }, [cloudTasks, completedIds]);
  const rank = getDailyRank(score);

  // Animated counter
  const animatedScore = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    // This style is applied to a wrapper; actual text is rendered separately
    opacity: 1,
  }));

  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    animatedScore.value = withTiming(score, { duration: 1000 });
    // JS-side counter for display
    const start = Date.now();
    const duration = 1000;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayScore(Math.round(progress * score));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [score]);

  const scoreColor =
    score >= 85 ? colors.rankS :
    score >= 70 ? colors.rankA :
    score >= 50 ? colors.rankB :
    score >= 30 ? colors.rankC : colors.rankD;

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: "center" }}>
      <Text style={phaseStyles.kicker}>PHASE 1 OF 4 · EVENING</Text>
      <Text style={[phaseStyles.title, { textAlign: "center" }]}>{"Today's\nScore"}</Text>

      {/* Large score */}
      <Animated.View entering={FadeInUp.delay(200).duration(500)} style={animStyle}>
        <View style={scoreRevealStyles.ring}>
          <Text style={[scoreRevealStyles.scoreValue, { color: scoreColor }]}>
            {displayScore}
          </Text>
          <Text style={scoreRevealStyles.scorePct}>%</Text>
        </View>
      </Animated.View>

      {/* Rank badge */}
      <Animated.View entering={FadeIn.delay(800).duration(400)} style={scoreRevealStyles.rankBadge}>
        <Text style={[scoreRevealStyles.rankLetter, { color: rank.color }]}>{rank.letter}</Text>
        <Text style={scoreRevealStyles.rankLabel}>RANK</Text>
      </Animated.View>

      {/* Engine scores */}
      <View style={scoreRevealStyles.enginesWrap}>
        {ENGINES.map((engine, idx) => {
          const engineScore = engineScores[engine];
          return (
            <Animated.View
              key={engine}
              entering={FadeInDown.delay(1000 + idx * 100).duration(300)}
              style={scoreRevealStyles.engineRow}
            >
              <View style={scoreRevealStyles.engineLabelRow}>
                <View style={[scoreRevealStyles.engineDot, { backgroundColor: colors[engine] }]} />
                <Text style={scoreRevealStyles.engineName}>{ENGINE_LABELS[engine]}</Text>
                <Text style={scoreRevealStyles.enginePct}>{engineScore}%</Text>
              </View>
              <View style={scoreRevealStyles.barBg}>
                <View
                  style={[
                    scoreRevealStyles.barFill,
                    { width: `${engineScore}%`, backgroundColor: colors[engine] },
                  ]}
                />
              </View>
            </Animated.View>
          );
        })}
      </View>

      <Pressable style={[phaseStyles.nextBtn, { width: "100%", marginTop: spacing.xl }]} onPress={onNext}>
        <Text style={phaseStyles.nextBtnText}>NEXT</Text>
      </Pressable>
    </Animated.View>
  );
}

function EveningReflectionPhase({
  morningIntention,
  wentWell,
  onChangeWentWell,
  differently,
  onChangeDifferently,
  onNext,
}: {
  morningIntention: string;
  wentWell: string;
  onChangeWentWell: (v: string) => void;
  differently: string;
  onChangeDifferently: (v: string) => void;
  onNext: () => void;
}) {
  const canProceed = wentWell.trim().length >= 3 && differently.trim().length >= 3;

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <Text style={phaseStyles.kicker}>PHASE 2 OF 4 · EVENING</Text>
      <Text style={phaseStyles.title}>Reflect</Text>

      {morningIntention.length > 0 && (
        <View style={reflectStyles.intentionReminder}>
          <Text style={reflectStyles.reminderLabel}>THIS MORNING YOU SET</Text>
          <Text style={reflectStyles.reminderText}>"{morningIntention}"</Text>
        </View>
      )}

      <Text style={reflectStyles.questionLabel}>What went well today?</Text>
      <TextInput
        value={wentWell}
        onChangeText={onChangeWentWell}
        placeholder="Something I'm proud of..."
        placeholderTextColor={colors.textMuted}
        style={phaseStyles.input}
        multiline
        autoFocus
      />

      <Text style={reflectStyles.questionLabel}>What will you do differently tomorrow?</Text>
      <TextInput
        value={differently}
        onChangeText={onChangeDifferently}
        placeholder="Tomorrow I will..."
        placeholderTextColor={colors.textMuted}
        style={phaseStyles.input}
        multiline
      />

      <Pressable
        style={[phaseStyles.nextBtn, !canProceed && phaseStyles.nextBtnDisabled]}
        onPress={onNext}
        disabled={!canProceed}
      >
        <Text style={phaseStyles.nextBtnText}>NEXT</Text>
      </Pressable>
    </Animated.View>
  );
}

function EveningIdentityVotePhase({
  identity,
  onVoteYes,
  onVoteNo,
}: {
  identity: IdentityArchetype | null;
  onVoteYes: () => void;
  onVoteNo: () => void;
}) {
  const meta = identity ? selectIdentityMeta(identity) : null;
  const label = identity ? IDENTITY_LABELS[identity] : "your archetype";

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: "center", flex: 1 }}>
      <Text style={phaseStyles.kicker}>PHASE 3 OF 4 · EVENING</Text>
      <Text style={[phaseStyles.title, { textAlign: "center" }]}>
        {"Did you show up as\n"}{label}{" today?"}
      </Text>

      {meta && (
        <Animated.View entering={FadeIn.delay(200).duration(400)} style={voteStyles.iconWrap}>
          <Text style={voteStyles.bigIcon}>
            {identity ? IDENTITY_ICONS[identity] : ""}
          </Text>
          <Text style={voteStyles.archetypeName}>{meta.name}</Text>
        </Animated.View>
      )}

      <View style={voteStyles.buttonRow}>
        <Pressable style={voteStyles.yesBtn} onPress={onVoteYes}>
          <Text style={voteStyles.yesBtnText}>YES, I DID</Text>
        </Pressable>
        <Pressable style={voteStyles.noBtn} onPress={onVoteNo}>
          <Text style={voteStyles.noBtnText}>I'LL DO BETTER TOMORROW</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function EveningNarrativePhase({
  onFinish,
}: {
  onFinish: () => void;
}) {
  const narrative = getLatestNarrative();
  const firstActiveDate = getJSON<string | null>("first_active_date", null);
  const dayNumber = getDayNumber(firstActiveDate);
  const chapter = getCurrentChapter(dayNumber);

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: "center", flex: 1 }}>
      <Text style={phaseStyles.kicker}>PHASE 4 OF 4 · EVENING</Text>
      <Text style={[phaseStyles.title, { textAlign: "center" }]}>{"Your Story\nContinues"}</Text>

      <Animated.View entering={FadeIn.delay(200).duration(400)} style={narrativeStyles.card}>
        <Text style={narrativeStyles.dayLabel}>DAY {dayNumber} · {chapter.name.toUpperCase()}</Text>
        <Text style={narrativeStyles.storyText}>
          {narrative?.text ?? "Your journey is being written. Every action adds a line to your legend."}
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(500).duration(400)} style={{ width: "100%", marginTop: spacing["2xl"] }}>
        <Pressable style={motivStyles.beginBtn} onPress={onFinish}>
          <Text style={motivStyles.beginBtnText}>END YOUR DAY</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Phase Counter ───────────────────────────────────────────────────────────

function PhaseCounter({ current, total }: { current: number; total: number }) {
  return (
    <View style={counterStyles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            counterStyles.dot,
            i < current && counterStyles.done,
            i === current && counterStyles.active,
          ]}
        />
      ))}
      <Text style={counterStyles.label}>{current + 1} / {total}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ProtocolScreen() {
  const router = useRouter();
  const today = getTodayKey();

  // Phase 3.5d: cloud-backed session state. The single protocol_sessions
  // row per (user, date_key) holds both morning and evening data, so a
  // morning save and an evening save both upsert the same row. No more
  // Phase 2.2A multi-key write race.
  const { data: session = null } = useProtocolSession(today);
  const morningDone = Boolean(session?.morning_completed_at);
  const eveningDone = Boolean(session?.evening_completed_at);
  const morningIntention = session?.morning_intention ?? "";

  const saveMorningMutation = useSaveMorningSession();
  const saveEveningMutation = useSaveEveningSession();
  const awardXPMutation = useAwardXP();
  const updateStreakMutation = useUpdateStreak();
  const enqueueRankUpMutation = useEnqueueRankUp();

  const identity = useModeStore((s) => s.identity);
  const castVote = useIdentityStore((s) => s.castVote);

  // Compute today's Titan score from the cloud task list for the evening
  // reveal. Mirrors the dashboard derivation so the two screens agree.
  const { data: allTasks = [] } = useAllTasks();
  const { data: allCompletions = [] } = useAllCompletionsForDate(today);
  const titanScore = useMemo(() => {
    const completedIds = new Set(allCompletions.map((c) => c.task_id));
    const configured = ENGINES.filter((e) =>
      allTasks.some((t) => t.engine === e),
    );
    if (configured.length === 0) return 0;
    const sum = configured.reduce((acc, e) => {
      const engineTasks = allTasks.filter((t) => t.engine === e);
      return acc + computeEngineScore(engineTasks, completedIds);
    }, 0);
    return Math.round(sum / configured.length);
  }, [allTasks, allCompletions]);

  // Auto-detect mode
  const mode: "morning" | "evening" = !morningDone ? "morning" : "evening";
  const totalPhases = mode === "morning" ? 3 : 4;

  const [phaseIdx, setPhaseIdx] = useState(0);

  // Morning state
  const [intention, setIntention] = useState("");

  // Evening state
  const [wentWell, setWentWell] = useState("");
  const [differently, setDifferently] = useState("");

  // Navigation helpers
  const goNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhaseIdx((p) => Math.min(p + 1, totalPhases - 1));
  }, [totalPhases]);

  const goBack = useCallback(() => {
    if (phaseIdx === 0) {
      router.back();
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhaseIdx((p) => p - 1);
    }
  }, [phaseIdx, router]);

  // ─── Morning finish ──────────────────────────────────────────────────────

  const handleMorningFinish = useCallback(async () => {
    try {
      await saveMorningMutation.mutateAsync({
        dateKey: today,
        intention: intention.trim(),
      });
      const xpResult = await awardXPMutation.mutateAsync(15);
      await updateStreakMutation.mutateAsync(today);
      if (xpResult.leveledUp) {
        await enqueueRankUpMutation.mutateAsync({
          fromLevel: xpResult.fromLevel,
          toLevel: xpResult.toLevel,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (_e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [
    intention,
    saveMorningMutation,
    awardXPMutation,
    updateStreakMutation,
    enqueueRankUpMutation,
    today,
    router,
  ]);

  // ─── Evening finish ──────────────────────────────────────────────────────

  const [identityVoted, setIdentityVoted] = useState(false);

  const handleVoteYes = useCallback(() => {
    setIdentityVoted(true);
    castVote();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    goNext();
  }, [castVote, goNext]);

  const handleVoteNo = useCallback(() => {
    setIdentityVoted(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    goNext();
  }, [goNext]);

  const handleEveningFinish = useCallback(async () => {
    const reflection = [wentWell.trim(), differently.trim()].filter(Boolean).join("\n\n");
    try {
      await saveEveningMutation.mutateAsync({
        dateKey: today,
        reflection,
        titanScore,
        identityVote: identityVoted ? identity : null,
      });
      const xpResult = await awardXPMutation.mutateAsync(15);
      if (xpResult.leveledUp) {
        await enqueueRankUpMutation.mutateAsync({
          fromLevel: xpResult.fromLevel,
          toLevel: xpResult.toLevel,
        });
      }
      evaluateAllTrees();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (_e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [
    wentWell,
    differently,
    saveEveningMutation,
    awardXPMutation,
    enqueueRankUpMutation,
    identityVoted,
    identity,
    titanScore,
    today,
    router,
  ]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <HUDBackground />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={12}>
          <Text style={styles.closeBtn}>{phaseIdx === 0 ? "✕" : "←"}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {mode === "morning" ? "MORNING PROTOCOL" : "EVENING PROTOCOL"}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <PhaseCounter current={phaseIdx} total={totalPhases} />

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
          {/* ─── MORNING ─── */}
          {mode === "morning" && phaseIdx === 0 && (
            <MorningIntentionPhase
              value={intention}
              onChange={setIntention}
              onNext={goNext}
              identity={identity}
            />
          )}
          {mode === "morning" && phaseIdx === 1 && (
            <MorningMissionPreviewPhase dateKey={today} onNext={goNext} />
          )}
          {mode === "morning" && phaseIdx === 2 && (
            <MorningMotivationalPhase identity={identity} onFinish={handleMorningFinish} />
          )}

          {/* ─── EVENING ─── */}
          {mode === "evening" && phaseIdx === 0 && (
            <EveningScoreRevealPhase score={titanScore} dateKey={today} onNext={goNext} />
          )}
          {mode === "evening" && phaseIdx === 1 && (
            <EveningReflectionPhase
              morningIntention={morningIntention}
              wentWell={wentWell}
              onChangeWentWell={setWentWell}
              differently={differently}
              onChangeDifferently={setDifferently}
              onNext={goNext}
            />
          )}
          {mode === "evening" && phaseIdx === 2 && (
            <EveningIdentityVotePhase
              identity={identity}
              onVoteYes={handleVoteYes}
              onVoteNo={handleVoteNo}
            />
          )}
          {mode === "evening" && phaseIdx === 3 && (
            <EveningNarrativePhase onFinish={handleEveningFinish} />
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  identityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  identityIcon: { fontSize: 16 },
  identityName: { ...fonts.kicker, fontSize: 9, color: colors.textSecondary },
});

const counterStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  done: { backgroundColor: colors.success },
  active: { backgroundColor: colors.text, width: 20 },
  label: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginLeft: spacing.sm },
});

const missionStyles = StyleSheet.create({
  engineGroup: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: spacing.md,
  },
  engineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  engineDot: { width: 8, height: 8, borderRadius: 4 },
  engineLabel: { ...fonts.kicker, fontSize: 9, color: colors.textSecondary },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  taskTitle: { flex: 1, fontSize: 14, color: colors.text, fontWeight: "500" },
  kindBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  kindMain: { backgroundColor: colors.successDim },
  kindSecondary: { backgroundColor: "rgba(255,255,255,0.06)" },
  kindText: { ...fonts.kicker, fontSize: 7, color: colors.textMuted },
});

const motivStyles = StyleSheet.create({
  chapterCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: spacing.xl,
    alignItems: "center",
    width: "100%",
    marginTop: spacing.xl,
  },
  chapterNumber: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.xs },
  chapterName: { fontSize: 28, fontWeight: "200", color: colors.text, textAlign: "center" },
  chapterSubtitle: {
    fontSize: 14, color: colors.textSecondary, textAlign: "center",
    marginTop: spacing.sm, lineHeight: 20, fontStyle: "italic",
  },
  taglineWrap: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  tagline: {
    fontSize: 15, color: colors.textSecondary, textAlign: "center",
    lineHeight: 22, fontStyle: "italic",
  },
  beginBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg + 4,
    alignItems: "center",
  },
  beginBtnText: { ...fonts.kicker, fontSize: 13, color: "#000", letterSpacing: 3 },
});

const scoreRevealStyles = StyleSheet.create({
  ring: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  scoreValue: { fontSize: 80, fontWeight: "200", fontFamily: "monospace", lineHeight: 84 },
  scorePct: { fontSize: 28, fontWeight: "300", color: colors.textSecondary, marginBottom: 12, marginLeft: 2 },
  rankBadge: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  rankLetter: { fontSize: 32, fontWeight: "700" },
  rankLabel: { ...fonts.kicker, fontSize: 9, color: colors.textMuted },
  enginesWrap: { gap: spacing.md, width: "100%" },
  engineRow: { gap: 4 },
  engineLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  engineDot: { width: 8, height: 8, borderRadius: 4 },
  engineName: { ...fonts.kicker, fontSize: 9, color: colors.textSecondary, flex: 1 },
  enginePct: { ...fonts.kicker, fontSize: 9, color: colors.textMuted },
  barBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  barFill: { height: 6, borderRadius: 3 },
});

const reflectStyles = StyleSheet.create({
  intentionReminder: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  reminderLabel: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.xs },
  reminderText: { fontSize: 14, color: colors.textSecondary, fontStyle: "italic", lineHeight: 20 },
  questionLabel: {
    ...fonts.kicker, fontSize: 10, color: colors.textSecondary,
    marginBottom: spacing.sm, marginTop: spacing.sm,
  },
});

const voteStyles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  bigIcon: { fontSize: 64 },
  archetypeName: {
    ...fonts.kicker, fontSize: 12, color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  buttonRow: { gap: spacing.md, width: "100%", marginTop: spacing.xl },
  yesBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg + 2,
    alignItems: "center",
  },
  yesBtnText: { ...fonts.kicker, fontSize: 13, color: "#000", letterSpacing: 2 },
  noBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  noBtnText: { ...fonts.kicker, fontSize: 11, color: colors.textMuted, letterSpacing: 1 },
});

const narrativeStyles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: spacing.xl,
    width: "100%",
    marginTop: spacing.xl,
  },
  dayLabel: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.md },
  storyText: {
    fontSize: 15, color: colors.textSecondary, lineHeight: 24,
    fontStyle: "italic",
  },
});
