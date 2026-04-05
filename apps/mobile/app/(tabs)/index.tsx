import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, RefreshControl, Pressable,
  ScrollView, useWindowDimensions, AppState, Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle, FadeInDown,
  withRepeat, withSequence, withTiming, Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { getJSON, setJSON } from "../../src/db/storage";
import { useSystemNotification } from "../../src/components/ui/SystemNotification";
import { QuestCard } from "../../src/components/ui/QuestCard";
import { SystemVoice } from "../../src/components/ui/SystemVoice";
import { LevelUpOverlay } from "../../src/components/ui/LevelUpOverlay";
import { colors, spacing, fonts, radius } from "../../src/theme";
import { XPBar } from "../../src/components/ui/XPBar";
import { StreakBadge } from "../../src/components/ui/StreakBadge";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { Panel } from "../../src/components/ui/Panel";
import { TitanProgress } from "../../src/components/ui/TitanProgress";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { RadarChart } from "../../src/components/ui/RadarChart";
import { SparklineChart } from "../../src/components/ui/SparklineChart";
import { useAnalyticsData } from "../../src/hooks/useAnalyticsData";
import { useEngineStore, selectAllTasksForDate, ENGINES, type TaskWithStatus } from "../../src/stores/useEngineStore";
import { useProfileStore, XP_REWARDS } from "../../src/stores/useProfileStore";
import { getMomentum, getMomentumColor } from "../../src/lib/momentum";
import { loadIntegrity, getIntegrityColor } from "../../src/lib/protocol-integrity";
import { useModeStore, IDENTITY_LABELS } from "../../src/stores/useModeStore";
import { useProtocolStore } from "../../src/stores/useProtocolStore";
import { useSkillTreeStore, SKILL_TREES } from "../../src/stores/useSkillTreeStore";
import { useIdentityStore, selectIdentityMeta } from "../../src/stores/useIdentityStore";
import { useHabitStore } from "../../src/stores/useHabitStore";
import { useFieldOpStore } from "../../src/stores/useFieldOpStore";
import { useStoryStore } from "../../src/stores/useStoryStore";
import { useProgressionStore } from "../../src/stores/useProgressionStore";
import { getTodayKey } from "../../src/lib/date";
import { getDailyRank } from "../../src/db/gamification";
import { getCurrentChapter, getDayNumber } from "../../src/data/chapters";
import { evaluateAllTrees, initializeAllTrees } from "../../src/lib/skill-tree-evaluator";
import { getStoryForDay, addEntry } from "../../src/lib/narrative-engine";
import { generateDailyOperation } from "../../src/lib/operation-engine";
import type { EngineKey } from "../../src/db/schema";

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

  const analytics = useAnalyticsData();

  // Initialize skill trees on first load
  useEffect(() => {
    initializeAllTrees();
    evaluateAllTrees();
  }, []);

  // Load habits
  useEffect(() => {
    useHabitStore.getState().load(today);
  }, [today]);

  // Load field ops
  useEffect(() => {
    useFieldOpStore.getState().load();
  }, []);

  // Load profile on mount so streak is up to date
  useEffect(() => {
    useProfileStore.getState().load();
  }, []);

  // Stores
  const storeTasks = useEngineStore((s) => s.tasks);
  const storeCompletions = useEngineStore((s) => s.completions);
  const toggleTask = useEngineStore((s) => s.toggleTask);
  const loadAllEngines = useEngineStore((s) => s.loadAllEngines);

  const profileXp = useProfileStore((s) => s.profile.xp);
  const profileLevel = useProfileStore((s) => s.profile.level);
  const profileStreak = useProfileStore((s) => s.profile.streak);
  const loadProfile = useProfileStore((s) => s.load);
  const awardXP = useProfileStore((s) => s.awardXP);
  const updateStreak = useProfileStore((s) => s.updateStreak);

  // Game systems
  const protocolStreak = useProtocolStore((s) => s.streakCurrent);

  const identity = useModeStore((s) => s.identity);
  const archetype = useIdentityStore((s) => s.archetype);
  const morningDone = useProtocolStore((s) => s.isMorningDone(today));
  const eveningDone = useProtocolStore((s) => s.isEveningDone(today));
  const protocolCompleted = morningDone && eveningDone;
  const protocolSession = useProtocolStore((s) => s.getSession(today));
  const skillProgress = useSkillTreeStore((s) => s.progress);

  // Habit store
  const habits = useHabitStore((s) => s.habits);
  const habitCompletedIds = useHabitStore((s) => s.completedIds);

  // Field op store
  const activeFieldOp = useFieldOpStore((s) => s.activeFieldOp);
  const fieldOpClearedCount = useFieldOpStore((s) => s.getClearedCount());

  // Story + Progression stores (for operation engine)
  const userName = useStoryStore((s) => s.userName);
  const phase = useProgressionStore((s) => s.currentPhase);

  // Task completion flash state
  const [lastCompletedId, setLastCompletedId] = useState<number | null>(null);

  // Derived data
  const tasks = useMemo(
    () => selectAllTasksForDate(storeTasks, storeCompletions, analytics.today),
    [storeTasks, storeCompletions, analytics.today]
  );
  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);
  const identityMeta = useMemo(() => selectIdentityMeta(archetype), [archetype]);
  const rank = getDailyRank(analytics.titanScore);

  // Chapter system
  const firstActiveDate = getJSON<string | null>("first_active_date", null);
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

  // Skill tree overall progress
  const skillTreeProgress = useMemo(() => {
    let claimed = 0;
    let total = 0;
    for (const engine of ENGINES) {
      const nodes = skillProgress[engine] ?? [];
      claimed += nodes.filter((n) => n.status === "claimed").length;
      total += nodes.length || SKILL_TREES[engine]?.reduce((acc, b) => acc + b.nodes.length, 0) || 0;
    }
    return total > 0 ? Math.round((claimed / total) * 100) : 0;
  }, [skillProgress]);

  // Habit stats for today
  const habitStats = useMemo(() => {
    const completedSet = habitCompletedIds[today] ?? [];
    return { done: completedSet.length, total: habits.length };
  }, [habits, habitCompletedIds, today]);

  // Narrative (latest entry)
  const latestNarrative = useMemo(() => {
    const entries = getJSON<{ date: string; text: string }[]>("narrative_entries", []);
    return entries.length > 0 ? entries[entries.length - 1] : null;
  }, [appActive]);

  // Refresh
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAllEngines(analytics.today);
    loadProfile();
    useHabitStore.getState().load(today);
    useFieldOpStore.getState().load();
    setRefreshing(false);
  }, [analytics.today]);

  // System notifications
  const notify = useSystemNotification();

  // Level-up detection
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState(0);
  const prevLevelRef = useRef(profileLevel);
  useEffect(() => {
    if (profileLevel > prevLevelRef.current && prevLevelRef.current > 0) {
      setLevelUpLevel(profileLevel);
      setShowLevelUp(true);
      notify({ type: "level_up", title: `LEVEL ${profileLevel}`, subtitle: "You leveled up!" });
    }
    prevLevelRef.current = profileLevel;
  }, [profileLevel]);

  // Mission toggle
  const handleToggle = useCallback((task: TaskWithStatus) => {
    const completed = toggleTask(task.engine, task.id!, analytics.today);
    const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
    if (completed) {
      // [Game-feel #2] Satisfying success haptic instead of plain medium
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // [Game-feel #2] Flash the completed row green
      setLastCompletedId(task.id!);
      setTimeout(() => setLastCompletedId(null), 600);

      awardXP(analytics.today, "task_complete", xp);
      updateStreak(analytics.today);
      evaluateAllTrees();
      // First-ever task voice line
      const firstTaskPlayed = getJSON<boolean>("first_task_voice_played", false);
      if (!firstTaskPlayed) {
        import("../../src/lib/protocol-audio").then(({ playVoiceLineAsync }) => {
          playVoiceLineAsync("FIRST-TASK");
        });
        setJSON("first_task_voice_played", true);
      }
      // System notification
      notify({
        type: "xp",
        title: `+${xp} XP`,
        subtitle: task.title,
      });

      // [Game-feel #4] All-tasks-complete celebration
      if (completedCount + 1 === tasks.length) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
        notify({ type: "system", title: "ALL TASKS COMPLETE", subtitle: "Protocol objectives cleared." });
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      awardXP(analytics.today, "task_uncomplete", -xp);
    }
  }, [analytics.today, toggleTask, awardXP, updateStreak, notify, completedCount, tasks.length]);

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
  }, [protocolCompleted]);
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
  }, [profileStreak]);
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
              <Text style={s.combatPowerValue}>{analytics.titanScore}</Text>
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
                  scores={analytics.engineScores}
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
                        value={analytics.engineScores[e]}
                        color={ENGINE_COLORS[e]}
                        height={6}
                        shimmer={false}
                      />
                    </View>
                    <Text style={s.engineBarPct}>{analytics.engineScores[e]}%</Text>
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
                  title={task.title}
                  xp={task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST}
                  completed={task.completed}
                  kind={task.kind}
                  engine={task.engine}
                  onToggle={() => handleToggle(task)}
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
                  const done = h.id != null && (habitCompletedIds[today] ?? []).includes(h.id);
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

      {/* Level-Up Overlay */}
      {showLevelUp && (
        <LevelUpOverlay
          newLevel={levelUpLevel}
          onDismiss={() => setShowLevelUp(false)}
        />
      )}
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
