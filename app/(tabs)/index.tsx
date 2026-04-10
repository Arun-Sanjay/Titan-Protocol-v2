import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, RefreshControl, Pressable,
  ScrollView, useWindowDimensions, AppState, Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle, FadeInDown,
  withRepeat, withSequence, withTiming, cancelAnimation, Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { getJSON, setJSON } from "../../src/db/storage";
import { useSystemNotification } from "../../src/components/ui/SystemNotification";
import { QuestCard } from "../../src/components/ui/QuestCard";
import { SystemVoice } from "../../src/components/ui/SystemVoice";
// Phase 2.4: LevelUpOverlay is mounted in app/_layout.tsx via
// RankUpOverlayMount, which subscribes to the cloud rank_up_events
// table (services/rank-ups.ts). The legacy MMKV queue
// (legacy pendingRankUps queue) was deleted as dead code.
import { colors, spacing, fonts, radius } from "../../src/theme";
import { XPBar } from "../../src/components/ui/XPBar";
import { StreakBadge } from "../../src/components/ui/StreakBadge";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { Panel } from "../../src/components/ui/Panel";
import { TitanProgress } from "../../src/components/ui/TitanProgress";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { RadarChart } from "../../src/components/ui/RadarChart";
import { SparklineChart } from "../../src/components/ui/SparklineChart";
// Wave 1: Full cloud migration — all data reads come from React Query hooks.
// Stores that STAY: useModeStore (UI mode), useIdentityStore (archetype UI),
// useStoryStore (cinematic playback state). Everything else → cloud hooks.
import { useAllTasks, useAllCompletionsForDate, useToggleCompletion } from "../../src/hooks/queries/useTasks";
import { computeEngineScore, ENGINES, type EngineKey } from "../../src/services/tasks";
import { useProfile, useAwardXP, useUpdateStreak } from "../../src/hooks/queries/useProfile";
import { useEnqueueRankUp } from "../../src/hooks/queries/useRankUps";
import { useProtocolSession } from "../../src/hooks/queries/useProtocol";
import { useHabits, useHabitLogsForDate } from "../../src/hooks/queries/useHabits";
import { useActiveFieldOp, useFieldOpHistory } from "../../src/hooks/queries/useFieldOps";
import { useSkillProgress } from "../../src/hooks/queries/useSkillTree";
import { useProgression } from "../../src/hooks/queries/useProgression";
import { getMomentum, getMomentumColor } from "../../src/lib/momentum";
import { loadIntegrity, getIntegrityColor } from "../../src/lib/protocol-integrity";
import { useModeStore, IDENTITY_LABELS } from "../../src/stores/useModeStore";
import { useIdentityStore, selectIdentityMeta } from "../../src/stores/useIdentityStore";
import { useStoryStore } from "../../src/stores/useStoryStore";
import { getTodayKey } from "../../src/lib/date";
import { getDailyRank } from "../../src/db/gamification";
import { getCurrentChapter, getDayNumber } from "../../src/data/chapters";
import { getStoryForDay, addEntry } from "../../src/lib/narrative-engine";
import { generateDailyOperation } from "../../src/lib/operation-engine";

// Pure constants that were previously imported from stores but have no
// MMKV dependency — inlined here to remove the store import.
const XP_REWARDS = {
  MAIN_TASK: 20, SIDE_QUEST: 10, HABIT_COMPLETE: 5, JOURNAL_ENTRY: 15,
  STREAK_BONUS_7: 50, STREAK_BONUS_30: 200, PERFECT_DAY: 100,
} as const;

// ─── Constants ────────────────────────────────────────────────────────────────

const ENGINE_LABELS: Record<EngineKey, string> = {
  body: "BODY", mind: "MIND", money: "MONEY", charisma: "CHARISMA",
};
const ENGINE_COLORS: Record<EngineKey, string> = {
  body: colors.body, mind: colors.mind, money: colors.money, charisma: colors.charisma,
};
const ARCHETYPE_ICONS: Record<string, string> = {
  titan: "\u26A1", athlete: "\uD83D\uDCAA", scholar: "\uD83D\uDCDA", hustler: "\uD83D\uDCB0",
  showman: "\uD83C\uDFA4", warrior: "\u2694\uFE0F", founder: "\uD83D\uDE80", charmer: "\u2728",
};

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
const MAX_VISIBLE_MISSIONS = 6;

// ─── HQScreen — Titan OS Dashboard ────────────────────────────────────────────

export default function HQScreen() {
  const router = useRouter();
  const today = getTodayKey();
  const { width: screenWidth } = useWindowDimensions();

  const [appActive, setAppActive] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setAppActive((c) => c + 1);
    });
    return () => sub.remove();
  }, []);

  // Wave 1: removed useAnalyticsData (legacy MMKV aggregation),
  // initializeAllTrees/evaluateAllTrees (MMKV writes), and store
  // load() effects. React Query auto-fetches on mount.

  // Phase 3.5d: Profile / tasks / completions / protocol / rank-ups
  // are now read from React Query (Supabase-backed). The old Zustand
  // stores are intentionally NOT touched here — every write that used
  // to go through them is routed through the mutation hooks below.
  const { data: profile } = useProfile();
  const { data: allTasks = [] } = useAllTasks();
  const { data: allCompletions = [] } = useAllCompletionsForDate(today);
  const { data: protocolSession = null } = useProtocolSession(today);

  const toggleCompletion = useToggleCompletion();
  const awardXPMutation = useAwardXP();
  const updateStreakMutation = useUpdateStreak();
  const enqueueRankUpMutation = useEnqueueRankUp();

  const profileXp = profile?.xp ?? 0;
  const profileLevel = profile?.level ?? 1;
  const profileStreak = profile?.streak_current ?? 0;

  // Streak lives on profile now; protocol streak == profile streak.
  const protocolStreak = profileStreak;

  const identity = useModeStore((s) => s.identity);
  const archetype = useIdentityStore((s) => s.archetype);
  const morningDone = Boolean(protocolSession?.morning_completed_at);
  const eveningDone = Boolean(protocolSession?.evening_completed_at);
  const protocolCompleted = morningDone && eveningDone;

  // Wave 1: cloud-backed reads replacing legacy store reads
  const { data: cloudSkillProgress = [] } = useSkillProgress();
  const { data: cloudHabits = [] } = useHabits();
  const { data: cloudHabitLogs = [] } = useHabitLogsForDate(today);
  const { data: cloudActiveFieldOp } = useActiveFieldOp();
  const { data: cloudFieldOpHistory = [] } = useFieldOpHistory();
  const { data: cloudProgression } = useProgression();

  // Derive legacy-compatible shapes from cloud data
  const habits = cloudHabits;
  const habitCompletedIds = useMemo(
    () => new Set(cloudHabitLogs.map((l) => l.habit_id)),
    [cloudHabitLogs],
  );
  const activeFieldOp = cloudActiveFieldOp ?? null;
  const fieldOpClearedCount = useMemo(
    () => cloudFieldOpHistory.filter((op) => op.status === "completed").length,
    [cloudFieldOpHistory],
  );

  // Skill tree progress grouped by engine for the ready-to-claim count
  const skillProgress = useMemo(() => {
    const grouped: Record<string, Array<{ nodeId: string; status: string }>> = {};
    for (const node of cloudSkillProgress) {
      if (!grouped[node.engine]) grouped[node.engine] = [];
      grouped[node.engine].push({ nodeId: node.node_id, status: node.state });
    }
    return grouped;
  }, [cloudSkillProgress]);

  // Story + Progression (story store stays — UI state; progression from cloud)
  const userName = useStoryStore((s) => s.userName);
  const phase = cloudProgression?.current_phase ?? "foundation";

  // Task completion flash state. String IDs because Supabase uses UUIDs.
  const [lastCompletedId, setLastCompletedId] = useState<string | null>(null);

  // Derive the same TaskWithStatus-shaped list the dashboard rendered
  // before, now sourced from the cloud cache.
  const completedIds = useMemo(
    () => new Set(allCompletions.map((c) => c.task_id)),
    [allCompletions],
  );
  const tasks = useMemo(
    () => allTasks.map((t) => ({ ...t, completed: completedIds.has(t.id) })),
    [allTasks, completedIds],
  );
  const identityMeta = useMemo(() => selectIdentityMeta(archetype), [archetype]);

  // Compute today's weighted Titan score from the cloud data rather than
  // reading the stale MMKV scores map. Average of the 4 per-engine
  // scores, rounded. When an engine has no tasks we skip it in the
  // average so the user isn't punished for not configuring it.
  const engineScoresFromCloud = useMemo(() => {
    const result: Record<(typeof ENGINES)[number], number> = {
      body: 0, mind: 0, money: 0, charisma: 0,
    };
    for (const e of ENGINES) {
      const engineTasks = allTasks.filter((t) => t.engine === e);
      result[e] = computeEngineScore(engineTasks, completedIds);
    }
    return result;
  }, [allTasks, completedIds]);

  const titanScoreFromCloud = useMemo(() => {
    const configured = ENGINES.filter((e) =>
      allTasks.some((t) => t.engine === e),
    );
    if (configured.length === 0) return 0;
    const sum = configured.reduce((acc, e) => acc + engineScoresFromCloud[e], 0);
    return Math.round(sum / configured.length);
  }, [allTasks, engineScoresFromCloud]);

  const rank = getDailyRank(titanScoreFromCloud);

  // Chapter system — read from cloud profile instead of MMKV
  const firstActiveDate = profile?.first_use_date ?? null;
  const dayNumber = getDayNumber(firstActiveDate);
  const chapter = getCurrentChapter(dayNumber);

  // Daily operation (for codename banner)
  const operation = useMemo(
    () => generateDailyOperation(userName, dayNumber, protocolStreak, phase),
    [dayNumber],
  );

  // Skill tree ready count
  const readyToClaimCount = useMemo(() => {
    let count = 0;
    for (const engine of ENGINES) {
      const nodes = skillProgress[engine] ?? [];
      count += nodes.filter((n) => n.status === "ready").length;
    }
    return count;
  }, [skillProgress]);

  // Skill tree overall progress — cloud-backed
  const skillTreeProgress = useMemo(() => {
    let claimed = 0;
    const total = cloudSkillProgress.length || 1; // avoid div by 0
    for (const node of cloudSkillProgress) {
      if (node.state === "claimed") claimed++;
    }
    return cloudSkillProgress.length > 0 ? Math.round((claimed / total) * 100) : 0;
  }, [cloudSkillProgress]);

  // Habit stats for today — cloud-backed
  const habitStats = useMemo(() => {
    return { done: habitCompletedIds.size, total: habits.length };
  }, [habits, habitCompletedIds]);

  // Narrative (latest entry) — TODO: replace with useNarrativeLog()
  // For now we keep the MMKV read as a low-priority v1.1 target
  const latestNarrative = useMemo(() => {
    const entries = getJSON<{ date: string; text: string }[]>("narrative_entries", []);
    return entries.length > 0 ? entries[entries.length - 1] : null;
  }, [appActive]);

  // Refresh — React Query handles its own refetching via invalidation.
  // No more legacy store.load() calls needed.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // React Query automatically refetches stale queries on focus/mount.
    // For pull-to-refresh, we'd call queryClient.invalidateQueries()
    // but the query client is already configured to refetch on mount.
    setRefreshing(false);
  }, []);

  // System notifications
  const notify = useSystemNotification();

  // Phase 2.4: Level-up detection now happens inside the cloud
  // useAwardXP mutation (hooks/queries/useProfile.ts), which calls
  // useEnqueueRankUp on the cloud rank_up_events table. The overlay is
  // mounted in the root layout via RankUpOverlayMount, which reads
  // from the cloud queue. This is cross-device and survives screen
  // unmounts, app backgrounding, and rapid XP awards — all the edge
  // cases the original useRef-based detection missed.

  // Phase 3.5d: Mission toggle now routes through the cloud mutation
  // hooks. MissionRow receives the Supabase UUID directly — no
  // number-coercion bridge anymore. We keep the callback shape
  // (taskId: string) stable so React.memo on MissionRow still does its
  // job, and we look up the task from the cloud cache via the closure
  // over `allTasks` (which is already stable-by-reference from React
  // Query until the underlying data changes).
  const handleToggle = useCallback(
    async (taskId: string) => {
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;

      const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;

      try {
        const { completed } = await toggleCompletion.mutateAsync({
          task: { id: task.id, engine: task.engine },
          dateKey: today,
        });

        if (completed) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setLastCompletedId(taskId);
          setTimeout(() => setLastCompletedId(null), 600);

          const xpResult = await awardXPMutation.mutateAsync(xp);
          await updateStreakMutation.mutateAsync(today);
          // Wave 1: removed evaluateAllTrees() — skill tree evaluation
          // now happens via cloud upserts, not MMKV writes.

          if (xpResult.leveledUp) {
            await enqueueRankUpMutation.mutateAsync({
              fromLevel: xpResult.fromLevel,
              toLevel: xpResult.toLevel,
            });
          }

          // First-ever task voice line
          const firstTaskPlayed = getJSON<boolean>("first_task_voice_played", false);
          if (!firstTaskPlayed) {
            import("../../src/lib/protocol-audio").then(({ playVoiceLineAsync }) => {
              playVoiceLineAsync("FIRST-TASK");
            });
            setJSON("first_task_voice_played", true);
          }

          notify({
            type: "xp",
            title: `+${xp} XP`,
            subtitle: task.title,
          });

          // All-tasks-complete celebration. We check the closure's
          // `tasks` list — it's one tick stale (the React Query cache
          // hasn't re-rendered us yet) so we simulate the toggle
          // manually: every other task must already be completed.
          const othersComplete = tasks
            .filter((t) => t.id !== taskId)
            .every((t) => t.completed);
          if (othersComplete && tasks.length > 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(
              () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
              200,
            );
            notify({
              type: "system",
              title: "ALL TASKS COMPLETE",
              subtitle: "Protocol objectives cleared.",
            });
          }
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await awardXPMutation.mutateAsync(-xp);
        }
      } catch (_e) {
        // Mutation hooks already handle optimistic rollback + error log.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [
      allTasks,
      tasks,
      today,
      toggleCompletion,
      awardXPMutation,
      updateStreakMutation,
      enqueueRankUpMutation,
      notify,
    ],
  );

  // Protocol pulse animation
  const protocolPulse = useSharedValue(0.4);
  useEffect(() => {
    if (!protocolCompleted) {
      protocolPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      );
    }
    return () => {
      cancelAnimation(protocolPulse);
    };
  }, [protocolCompleted, protocolPulse]);
  const protocolBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(247, 250, 255, ${protocolPulse.value})`,
  }));

  // [Game-feel #3] Streak glow animation (streak >= 30 pulses)
  const streakGlowOpacity = useSharedValue(0.6);
  useEffect(() => {
    if (profileStreak >= 30) {
      streakGlowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      );
    }
    return () => {
      cancelAnimation(streakGlowOpacity);
    };
  }, [profileStreak, streakGlowOpacity]);
  const streakGlowStyle = useAnimatedStyle(() => {
    if (profileStreak < 7) return {};
    const intensity = profileStreak >= 14 ? 12 : 8;
    return {
      shadowColor: colors.warning,
      shadowRadius: intensity,
      shadowOpacity: profileStreak >= 30 ? streakGlowOpacity.value : 0.6,
      shadowOffset: { width: 0, height: 0 },
    };
  });

  // Mission expand state
  const [missionsExpanded, setMissionsExpanded] = useState(false);

  // ── DEV ONLY: Skip day for story testing ──
  const [devDay, setDevDay] = useState(getJSON<number>("dev_day_offset", 0));
  const handleDevSkipDay = () => {
    const newDay = devDay + 1;
    setDevDay(newDay);
    setJSON("dev_day_offset", newDay);
    const simulatedDayNumber = (dayNumber ?? 1) + 1;
    const story = getStoryForDay(archetype ?? identity, simulatedDayNumber);
    if (story) {
      addEntry({ date: today, text: story.text, type: "story" });
    }
    // Clear today's briefing flag so it shows again on next app open
    setJSON(`briefing_seen_${today}`, false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      `Day ${simulatedDayNumber} Simulated`,
      "Close and reopen the app to see the briefing and missions for this day.",
      [{ text: "OK" }],
    );
  };

  // Per-engine completed tasks today
  const engineTaskStats = useMemo(() => {
    const stats: Record<EngineKey, { done: number; total: number }> = {
      body: { done: 0, total: 0 },
      mind: { done: 0, total: 0 },
      money: { done: 0, total: 0 },
      charisma: { done: 0, total: 0 },
    };
    for (const t of tasks) {
      stats[t.engine].total++;
      if (t.completed) stats[t.engine].done++;
    }
    return stats;
  }, [tasks]);

  // Radar chart size (smaller for side-by-side layout)
  const radarSize = Math.min(screenWidth * 0.38, 150);

  // Half-width for side-by-side cards
  const halfCardWidth = (screenWidth - 48) / 2;

  // Visible missions
  const visibleTasks = missionsExpanded ? tasks : tasks.slice(0, MAX_VISIBLE_MISSIONS);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <HUDBackground />

      {/* DEV ONLY: Skip day bar */}
      {__DEV__ && (
        <View style={s.devBar}>
          <Pressable onPress={handleDevSkipDay} style={s.devBtn}>
            <Text style={s.devBtnText}>DEV: Skip Day (+{devDay})</Text>
          </Pressable>
          <Text style={s.devDayText}>Simulated Day {(dayNumber ?? 1) + devDay}</Text>
        </View>
      )}

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }
      >
        {/* ══════════════ SECTION 1: CHARACTER HUD ══════════════ */}
        <Animated.View entering={FadeInDown.delay(0).duration(500).springify().damping(20)} style={s.hudSection}>
          <Text style={s.hudKicker}>
            DAY {dayNumber} {"\u00B7"} CH.{chapter.number}: {chapter.name.toUpperCase()}
          </Text>
          <View style={s.hudIdentityRow}>
            <Pressable
              style={s.avatarCircle}
              onPress={() => router.push("/(tabs)/profile")}
              hitSlop={8}
            >
              <Text style={s.avatarInitials}>
                {(identityMeta?.name ?? "T").charAt(0).toUpperCase()}
              </Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.hudArchetypeName}>
                {identityMeta?.name ?? (identity ? IDENTITY_LABELS[identity] : "TITAN PROTOCOL")}
              </Text>
              <View style={s.hudMetaRow}>
                <Text style={s.hudMetaText}>Lv.{profileLevel}</Text>
                <View style={s.hudMetaDot} />
                <Text style={[s.hudMetaText, { color: rank.color }]}>{rank.letter}</Text>
                <View style={s.hudMetaDot} />
                <Animated.View style={[profileStreak >= 7 && s.streakGlowWrap, streakGlowStyle]}>
                  <Text style={[s.hudStreakText, { color: getIntegrityColor(loadIntegrity().level) }]}>
                    {"\uD83D\uDD25"}{profileStreak}
                  </Text>
                </Animated.View>
                {getMomentum(profileStreak).multiplier > 1 && (
                  <>
                    <View style={s.hudMetaDot} />
                    <Text style={[s.hudMetaText, { color: getMomentumColor(getMomentum(profileStreak).tier) }]}>
                      {getMomentum(profileStreak).multiplier}x
                    </Text>
                  </>
                )}
              </View>
            </View>
            <View style={s.combatPowerWrap}>
              <Text style={s.combatPowerLabel}>COMBAT POWER</Text>
              <Text style={s.combatPowerValue}>{titanScoreFromCloud}</Text>
            </View>
          </View>
        </Animated.View>

        {/* ══════════════ OPERATION CODENAME BANNER ══════════════ */}
        <Animated.View entering={FadeInDown.delay(30).duration(500).springify().damping(20)}>
          <View style={s.operationBanner}>
            <Text style={s.operationKicker}>ACTIVE OPERATION</Text>
            <Text style={s.operationName}>{operation.displayName}</Text>
            <Text style={s.operationSubtitle}>{operation.subtitle}</Text>
          </View>
        </Animated.View>

        {/* ══════════════ SECTION 2: RADAR + ENGINE STATS (merged) ══════════════ */}
        <Animated.View entering={FadeInDown.delay(90).duration(500).springify().damping(20)}>
          <Panel style={s.card} tone="hero" delay={60}>
            <Text style={s.kicker}>ENGINE OVERVIEW</Text>
            <View style={s.radarEngineRow}>
              {/* Left: Radar Chart */}
              <View style={s.radarCol}>
                <RadarChart
                  scores={engineScoresFromCloud}
                  size={radarSize}
                />
              </View>

              {/* Right: Engine stat bars */}
              <View style={s.engineStatsCol}>
                {ENGINES.map((e) => (
                  <View key={e} style={s.engineBarRow}>
                    <View style={[s.engineColorDot, { backgroundColor: ENGINE_COLORS[e] }]} />
                    <Text style={[s.engineBarLabel, { color: ENGINE_COLORS[e] }]}>
                      {ENGINE_LABELS[e]}
                    </Text>
                    <View style={s.engineBarTrack}>
                      <TitanProgress
                        value={engineScoresFromCloud[e]}
                        color={ENGINE_COLORS[e]}
                        height={6}
                        shimmer={false}
                      />
                    </View>
                    <Text style={s.engineBarPct}>{engineScoresFromCloud[e]}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </Panel>
        </Animated.View>

        {/* ══════════════ SECTION 3: DAILY QUEST ══════════════ */}
        <QuestCard delay={150} />

        {/* ══════════════ SECTION 4: TODAY'S MISSIONS ══════════════ */}
        <Animated.View entering={FadeInDown.delay(210).duration(500).springify().damping(20)}>
          <View style={s.missionHeader}>
            <Text style={s.kicker}>TODAY'S MISSIONS</Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/engines");
              }}
              hitSlop={8}
            >
              <Text style={s.missionHeaderLink}>ALL ENGINES {"\u2192"}</Text>
            </Pressable>
          </View>

          {tasks.length === 0 ? (
            <Panel style={s.card}>
              <Text style={s.emptyMissions}>No missions set for today. Add tasks in each engine.</Text>
            </Panel>
          ) : (
            <View style={s.missionList}>
              {visibleTasks.map((task) => (
                <MissionRow
                  key={`${task.engine}-${task.id}`}
                  taskId={task.id}
                  title={task.title}
                  xp={task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST}
                  completed={task.completed}
                  kind={task.kind}
                  engine={task.engine}
                  onToggle={handleToggle}
                  highlighted={task.id === lastCompletedId}
                />
              ))}

              {tasks.length > MAX_VISIBLE_MISSIONS && !missionsExpanded && (
                <Pressable
                  style={s.showAllBtn}
                  onPress={() => setMissionsExpanded(true)}
                >
                  <Text style={s.showAllText}>Show all ({tasks.length})</Text>
                </Pressable>
              )}
            </View>
          )}
        </Animated.View>

        {/* ══════════════ SECTION 5: HABITS + SKILL TREES (side-by-side) ══════════════ */}
        <Animated.View entering={FadeInDown.delay(270).duration(500).springify().damping(20)}>
          <View style={s.sideBySideRow}>
            {/* Left: Habits card */}
            <Pressable
              style={[s.halfCard, { width: halfCardWidth }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/track");
              }}
            >
              <Text style={s.halfCardKicker}>HABITS</Text>
              <View style={s.habitDotsRow}>
                {habits.slice(0, 7).map((h, i) => {
                  const done = h.id != null && habitCompletedIds.has(h.id);
                  return (
                    <View
                      key={h.id ?? i}
                      style={[
                        s.habitDot,
                        done ? s.habitDotDone : s.habitDotPending,
                      ]}
                    />
                  );
                })}
                {habits.length === 0 && (
                  <Text style={s.halfCardMuted}>No habits yet</Text>
                )}
              </View>
              <Text style={s.halfCardStat}>
                {habitStats.done}/{habitStats.total} today
              </Text>
              <Text style={s.halfCardArrow}>{"\u2192"}</Text>
            </Pressable>

            {/* Right: Skill Trees card */}
            <Pressable
              style={[s.halfCard, { width: halfCardWidth }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/skill-tree");
              }}
            >
              <Text style={s.halfCardKicker}>SKILL TREES</Text>
              <View style={s.skillTreeBarWrap}>
                <TitanProgress
                  value={skillTreeProgress}
                  color={colors.text}
                  height={5}
                  shimmer={false}
                />
              </View>
              <Text style={s.halfCardStat}>
                {readyToClaimCount > 0
                  ? `${readyToClaimCount} ready to claim`
                  : `${skillTreeProgress}% mastered`}
              </Text>
              <Text style={s.halfCardArrow}>{"\u2192"}</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* ══════════════ SECTION 6: BOTTOM NAV ROW ══════════════ */}
        <Animated.View entering={FadeInDown.delay(330).duration(500).springify().damping(20)}>
          <View style={s.bottomNavRow}>
            <Pressable
              style={s.bottomNavCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/field-ops");
              }}
            >
              <Text style={s.bottomNavLabel}>FIELD OPS</Text>
              <Text style={s.bottomNavValue}>
                {activeFieldOp ? "1 active" : `${fieldOpClearedCount} cleared`}
              </Text>
            </Pressable>

            <Pressable
              style={s.bottomNavCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/track");
              }}
            >
              <Text style={s.bottomNavLabel}>JOURNAL</Text>
              <Text style={s.bottomNavValue}>
                {protocolCompleted ? "logged" : "pending"}
              </Text>
            </Pressable>

            <Pressable
              style={s.bottomNavCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/hub");
              }}
            >
              <Text style={s.bottomNavLabel}>HUB</Text>
              <Text style={s.bottomNavValue}>tools</Text>
            </Pressable>
          </View>
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Phase 2.1E: LevelUpOverlay now lives in app/_layout.tsx. */}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },

  // ── DEV BAR ──
  devBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: "rgba(248,113,113,0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(248,113,113,0.2)",
  },
  devBtn: {
    backgroundColor: "rgba(248,113,113,0.2)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  devBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#f87171",
    letterSpacing: 1,
  },
  devDayText: {
    fontSize: 10,
    color: "#f87171",
    opacity: 0.7,
  },

  // ── SHARED ──
  card: {
    marginBottom: 16,
  },
  kicker: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(233,240,255,0.72)",
    textTransform: "uppercase" as const,
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  mutedText: {
    fontSize: 11,
    color: "rgba(233,240,255,0.52)",
    marginTop: 2,
  },

  // ══════════════ SECTION 1: CHARACTER HUD ══════════════
  hudSection: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  hudKicker: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(233,240,255,0.52)",
    textTransform: "uppercase" as const,
    letterSpacing: 2.5,
    marginBottom: 10,
  },
  hudIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(247,250,255,0.96)",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  hudArchetypeName: {
    fontSize: 17,
    fontWeight: "700",
    color: "rgba(247,250,255,0.96)",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  hudMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hudMetaText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(233,240,255,0.72)",
    letterSpacing: 1,
  },
  hudMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(233,240,255,0.32)",
  },
  hudStreakText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(233,240,255,0.72)",
    letterSpacing: 1,
  },
  combatPowerWrap: {
    alignItems: "flex-end",
  },
  combatPowerLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: "rgba(233,240,255,0.42)",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  combatPowerValue: {
    fontSize: 28,
    fontWeight: "200",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    color: "rgba(247,250,255,0.96)",
    fontVariant: ["tabular-nums"] as any,
  },

  // ══════════════ OPERATION CODENAME BANNER ══════════════
  operationBanner: {
    backgroundColor: "rgba(0,255,136,0.04)",
    borderLeftWidth: 3,
    borderLeftColor: "#00FF88",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderRadius: 0,
  },
  operationKicker: {
    fontSize: 9,
    fontWeight: "700",
    color: "#00FF88",
    letterSpacing: 2.5,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    marginBottom: 4,
  },
  operationName: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(247,250,255,0.96)",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  operationSubtitle: {
    fontSize: 12,
    color: "rgba(247,250,255,0.50)",
  },

  // ══════════════ STREAK GLOW ══════════════
  streakGlowWrap: {
    borderRadius: 4,
    paddingHorizontal: 2,
  },

  // ══════════════ SECTION 2: RADAR + ENGINE STATS ══════════════
  radarEngineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  radarCol: {
    alignItems: "center",
    justifyContent: "center",
  },
  engineStatsCol: {
    flex: 1,
    gap: 10,
  },
  engineBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  engineColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  engineBarLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    width: 56,
    textTransform: "uppercase" as const,
  },
  engineBarTrack: {
    flex: 1,
  },
  engineBarPct: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    color: "rgba(233,240,255,0.72)",
    width: 32,
    textAlign: "right",
    fontVariant: ["tabular-nums"] as any,
  },

  // ══════════════ SECTION 4: TODAY'S MISSIONS ══════════════
  missionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  missionHeaderLink: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(233,240,255,0.52)",
    letterSpacing: 1.5,
  },
  missionList: {
    marginBottom: 16,
  },
  emptyMissions: {
    fontSize: 12,
    color: "rgba(233,240,255,0.42)",
    textAlign: "center",
    paddingVertical: 16,
  },
  showAllBtn: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  showAllText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(233,240,255,0.52)",
    letterSpacing: 1,
  },

  // ══════════════ SECTION 5: HABITS + SKILL TREES ══════════════
  sideBySideRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  halfCard: {
    backgroundColor: "rgba(0,0,0,0.97)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    padding: 14,
    minHeight: 120,
    justifyContent: "space-between",
  },
  halfCardKicker: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(233,240,255,0.52)",
    letterSpacing: 2,
    marginBottom: 10,
  },
  habitDotsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  habitDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  habitDotDone: {
    backgroundColor: "#5cc9a0",
  },
  habitDotPending: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  skillTreeBarWrap: {
    marginBottom: 8,
    marginTop: 4,
  },
  halfCardStat: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(247,250,255,0.96)",
    marginBottom: 4,
  },
  halfCardMuted: {
    fontSize: 10,
    color: "rgba(233,240,255,0.32)",
  },
  halfCardArrow: {
    fontSize: 12,
    color: "rgba(233,240,255,0.42)",
    alignSelf: "flex-end",
  },

  // ══════════════ SECTION 6: BOTTOM NAV ROW ══════════════
  bottomNavRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  bottomNavCard: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.97)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  bottomNavLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(233,240,255,0.52)",
    letterSpacing: 2,
    marginBottom: 4,
  },
  bottomNavValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(247,250,255,0.96)",
  },
});
