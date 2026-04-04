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
import { playVoiceLineAsync } from "../../src/lib/protocol-audio";
import { useSystemNotification } from "../../src/components/ui/SystemNotification";
import { QuestCard } from "../../src/components/ui/QuestCard";
import { LevelUpOverlay } from "../../src/components/ui/LevelUpOverlay";
import { colors, spacing, fonts, radius } from "../../src/theme";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { Panel } from "../../src/components/ui/Panel";
import { TitanProgress } from "../../src/components/ui/TitanProgress";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { RadarChart } from "../../src/components/ui/RadarChart";
import { useAnalyticsData } from "../../src/hooks/useAnalyticsData";
import { useEngineStore, selectAllTasksForDate, ENGINES, type TaskWithStatus } from "../../src/stores/useEngineStore";
import { useProfileStore, XP_REWARDS } from "../../src/stores/useProfileStore";
import { useModeStore, IDENTITY_LABELS } from "../../src/stores/useModeStore";
import { useProtocolStore } from "../../src/stores/useProtocolStore";
import { useSkillTreeStore, SKILL_TREES } from "../../src/stores/useSkillTreeStore";
import { useIdentityStore, selectIdentityMeta } from "../../src/stores/useIdentityStore";
import { useRankStore } from "../../src/stores/useRankStore";
import { useStoryStore } from "../../src/stores/useStoryStore";
import { useHabitStore } from "../../src/stores/useHabitStore";
import { useStatStore } from "../../src/stores/useStatStore";
import { RankBadge } from "../../src/components/ui/RankBadge";
import { RANK_NAMES, RANK_COLORS } from "../../src/lib/ranks-v2";
import { getTodayKey } from "../../src/lib/date";
import { getDailyRank } from "../../src/db/gamification";
import { getDayNumber } from "../../src/data/chapters";
import { evaluateAllTrees, initializeAllTrees } from "../../src/lib/skill-tree-evaluator";
import { getStoryForDay, addEntry } from "../../src/lib/narrative-engine";
import type { EngineKey } from "../../src/db/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const ENGINE_LABELS: Record<EngineKey, string> = {
  body: "BODY", mind: "MIND", money: "MONEY", charisma: "CHARISMA",
};
const ENGINE_COLORS: Record<EngineKey, string> = {
  body: colors.body, mind: colors.mind, money: colors.money, charisma: colors.charisma,
};

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

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
  const skillProgress = useSkillTreeStore((s) => s.progress);

  // New stores
  const rank = useRankStore((s) => s.rank);
  const userName = useStoryStore((s) => s.userName);
  const habits = useHabitStore((s) => s.habits);
  const habitCompletedIds = useHabitStore((s) => s.completedIds);
  const totalOutput = useStatStore((s) => s.totalOutput);

  // Derived data
  const tasks = useMemo(
    () => selectAllTasksForDate(storeTasks, storeCompletions, analytics.today),
    [storeTasks, storeCompletions, analytics.today]
  );
  const identityMeta = useMemo(() => selectIdentityMeta(archetype), [archetype]);

  // Chapter system
  const firstActiveDate = getJSON<string | null>("first_active_date", null);
  const dayNumber = getDayNumber(firstActiveDate);

  // Skill tree ready count + overall progress
  const { readyToClaimCount, skillOverallPct } = useMemo(() => {
    let readyCount = 0;
    let totalClaimed = 0;
    let totalNodes = 0;
    for (const engine of ENGINES) {
      const nodes = skillProgress[engine] ?? [];
      readyCount += nodes.filter((n) => n.status === "ready").length;
      totalClaimed += nodes.filter((n) => n.status === "claimed").length;
      totalNodes += nodes.length || SKILL_TREES[engine]?.reduce((acc, b) => acc + b.nodes.length, 0) || 0;
    }
    return {
      readyToClaimCount: readyCount,
      skillOverallPct: totalNodes > 0 ? Math.round((totalClaimed / totalNodes) * 100) : 0,
    };
  }, [skillProgress]);

  // Habit stats for today
  const habitStats = useMemo(() => {
    const completedSet = new Set(habitCompletedIds[today] ?? []);
    const done = habits.filter((h) => completedSet.has(h.id!)).length;
    return { done, total: habits.length, completedSet };
  }, [habits, habitCompletedIds, today]);

  // Refresh
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAllEngines(analytics.today);
    loadProfile();
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const completed = toggleTask(task.engine, task.id!, analytics.today);
    const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
    if (completed) {
      awardXP(analytics.today, "task_complete", xp);
      updateStreak(analytics.today);
      evaluateAllTrees();
      notify({
        type: "xp",
        title: `+${xp} XP`,
        subtitle: task.title,
      });

      // Play voice line on the user's very first task completion ever
      const firstTaskPlayed = getJSON<boolean>("first_task_voice_played", false);
      if (!firstTaskPlayed) {
        playVoiceLineAsync("FIRST-TASK");
        setJSON("first_task_voice_played", true);
      }
    } else {
      awardXP(analytics.today, "task_uncomplete", -xp);
    }
  }, [analytics.today, toggleTask, awardXP, updateStreak, notify]);

  // Protocol pulse animation
  const protocolPulse = useSharedValue(0.4);
  useEffect(() => {
    if (!protocolCompleted) {
      protocolPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      );
    }
  }, [protocolCompleted]);
  const protocolBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(251, 191, 36, ${protocolPulse.value})`,
  }));

  // Mission expand state
  const [missionsExpanded, setMissionsExpanded] = useState(false);
  const MISSION_LIMIT = 6;
  const visibleTasks = missionsExpanded ? tasks : tasks.slice(0, MISSION_LIMIT);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      `Day ${simulatedDayNumber} Simulated`,
      "Close and reopen the app to see the cinematic for this day.",
      [{ text: "OK" }],
    );
  };

  // Derived widths
  const halfCardWidth = (screenWidth - 48) / 2;

  // Avatar initials
  const initials = useMemo(() => {
    if (!userName) return "TP";
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return userName.slice(0, 2).toUpperCase();
  }, [userName]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <HUDBackground />

      {/* DEV ONLY: Skip day bar */}
      <View style={s.devBar}>
        <Pressable onPress={handleDevSkipDay} style={s.devBtn}>
          <Text style={s.devBtnText}>DEV: Skip Day (+{devDay})</Text>
        </Pressable>
        <Text style={s.devDayText}>Simulated Day {(dayNumber ?? 1) + devDay}</Text>
      </View>

      {/* ══════════════ SECTION 1: PROTOCOL BANNER (sticky) ══════════════ */}
      {!protocolCompleted && (
        <Animated.View style={[s.protocolBanner, protocolBorderStyle]}>
          <Pressable
            style={s.protocolBannerInner}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/protocol");
            }}
          >
            <Text style={s.protocolBannerText}>
              {!morningDone ? "BEGIN MORNING" : "BEGIN EVENING"}
            </Text>
            <Text style={s.protocolBannerArrow}>{"\u2192"}</Text>
          </Pressable>
        </Animated.View>
      )}

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }
      >
        {/* ══════════════ SECTION 2: CHARACTER HUD ══════════════ */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={s.hudSection}>
          <View style={s.hudRow}>
            {/* Avatar */}
            <Pressable
              style={s.avatar}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <Text style={s.avatarText}>{initials}</Text>
            </Pressable>

            {/* Center: Archetype + Level/Rank/Streak */}
            <View style={s.hudCenter}>
              <Text style={s.hudArchetypeName}>
                {identityMeta?.name ?? (identity ? IDENTITY_LABELS[identity] : "Titan Protocol")}
              </Text>
              <View style={s.hudMetaRow}>
                <Text style={s.hudMetaText}>Lv.{profileLevel}</Text>
                <Text style={s.hudMetaDot}>{"\u00B7"}</Text>
                <Text style={[s.hudMetaText, { color: RANK_COLORS[rank] }]}>
                  {RANK_NAMES[rank]}
                </Text>
                <Text style={s.hudMetaDot}>{"\u00B7"}</Text>
                <Text style={s.hudMetaText}>{"\uD83D\uDD25"}{protocolStreak}</Text>
              </View>
            </View>

            {/* Right: Total Output */}
            <View style={s.hudRight}>
              <Text style={s.hudOutputKicker}>TOTAL OUTPUT</Text>
              <Text style={s.hudOutputNumber}>{totalOutput}</Text>
            </View>
          </View>
        </Animated.View>

        {/* ══════════════ SECTION 3: RADAR + ENGINE STATS ══════════════ */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <Panel style={s.card} delay={60}>
            <View style={s.radarStatsRow}>
              {/* Left: Radar */}
              <View style={s.radarContainer}>
                <RadarChart
                  scores={analytics.engineScores}
                  size={Math.min(screenWidth * 0.38, 150)}
                />
              </View>

              {/* Right: Engine stat rows */}
              <View style={s.engineStatsCol}>
                {ENGINES.map((e) => (
                  <View key={e} style={s.engineStatRow}>
                    <View style={[s.engineDot, { backgroundColor: ENGINE_COLORS[e] }]} />
                    <Text style={[s.engineStatLabel, { color: ENGINE_COLORS[e] }]}>
                      {ENGINE_LABELS[e]}
                    </Text>
                    <View style={s.engineBarTrack}>
                      <TitanProgress
                        value={analytics.engineScores[e]}
                        color={ENGINE_COLORS[e]}
                        height={5}
                        shimmer={false}
                      />
                    </View>
                    <Text style={s.engineStatPct}>{analytics.engineScores[e]}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </Panel>
        </Animated.View>

        {/* ══════════════ SECTION 4: DAILY QUEST ══════════════ */}
        <QuestCard delay={120} />

        {/* ══════════════ SECTION 5: TODAY'S MISSIONS ══════════════ */}
        <Animated.View entering={FadeInDown.delay(180).duration(400)}>
          <View style={s.missionHeader}>
            <Text style={s.kicker}>TODAY'S MISSIONS</Text>
            <Pressable onPress={() => router.push("/(tabs)/engines")}>
              <Text style={s.missionHeaderLink}>ALL ENGINES {"\u2192"}</Text>
            </Pressable>
          </View>

          {visibleTasks.map((task) => (
            <MissionRow
              key={`${task.engine}-${task.id}`}
              title={task.title}
              xp={task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST}
              completed={task.completed}
              kind={task.kind}
              engine={task.engine}
              onToggle={() => handleToggle(task)}
            />
          ))}

          {tasks.length > MISSION_LIMIT && !missionsExpanded && (
            <Pressable
              style={s.showMoreBtn}
              onPress={() => setMissionsExpanded(true)}
            >
              <Text style={s.showMoreText}>
                Show {tasks.length - MISSION_LIMIT} more
              </Text>
            </Pressable>
          )}

          {tasks.length === 0 && (
            <View style={s.emptyMissions}>
              <Text style={s.emptyMissionsText}>No missions today. Add tasks in your engines.</Text>
            </View>
          )}
        </Animated.View>

        {/* ══════════════ SECTION 6: HABITS + SKILL TREES (side by side) ══════════════ */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)} style={s.sideBySideRow}>
          {/* Habits card */}
          <Pressable
            style={[s.halfCard, { width: halfCardWidth }]}
            onPress={() => router.push("/(tabs)/track")}
          >
            <Text style={s.kicker}>HABITS</Text>
            <View style={s.habitDotsRow}>
              {habits.slice(0, 10).map((h) => (
                <View
                  key={h.id}
                  style={[
                    s.habitDot,
                    {
                      backgroundColor: habitStats.completedSet.has(h.id!)
                        ? colors.success
                        : "rgba(255,255,255,0.15)",
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={s.halfCardSub}>
              {habitStats.done}/{habitStats.total} today
            </Text>
          </Pressable>

          {/* Skill Trees card */}
          <Pressable
            style={[s.halfCard, { width: halfCardWidth }]}
            onPress={() => router.push("/skill-tree/body")}
          >
            <Text style={s.kicker}>SKILL TREES</Text>
            <View style={s.skillProgressWrap}>
              <TitanProgress value={skillOverallPct} color={colors.text} height={5} shimmer={false} />
            </View>
            <Text style={s.halfCardSub}>
              {readyToClaimCount > 0
                ? `${readyToClaimCount} ready to claim`
                : "Earn mastery"}
            </Text>
          </Pressable>
        </Animated.View>

        {/* ══════════════ SECTION 7: BOTTOM NAV ROW ══════════════ */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={s.bottomNavRow}>
          <Pressable
            style={s.bottomNavBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/field-ops");
            }}
          >
            <Text style={s.bottomNavKicker}>FIELD OPS</Text>
            <Text style={s.bottomNavSub}>available</Text>
          </Pressable>

          <Pressable
            style={s.bottomNavBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/track");
            }}
          >
            <Text style={s.bottomNavKicker}>JOURNAL</Text>
            <Text style={s.bottomNavSub}>reflect</Text>
          </Pressable>

          <Pressable
            style={s.bottomNavBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/hub");
            }}
          >
            <Text style={s.bottomNavKicker}>HUB</Text>
            <Text style={s.bottomNavSub}>tools</Text>
          </Pressable>
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

  // ══════════════ SECTION 1: PROTOCOL BANNER ══════════════
  protocolBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1.5,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  protocolBannerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(251,191,36,0.06)",
  },
  protocolBannerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FBBF24",
    letterSpacing: 2,
  },
  protocolBannerArrow: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FBBF24",
  },

  // ══════════════ SECTION 2: CHARACTER HUD ══════════════
  hudSection: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  hudRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(247,250,255,0.96)",
    letterSpacing: 0.5,
  },
  hudCenter: {
    flex: 1,
  },
  hudArchetypeName: {
    ...fonts.subheading,
    fontWeight: "700",
    color: "rgba(247,250,255,0.96)",
  },
  hudMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  hudMetaText: {
    ...fonts.caption,
    fontSize: 11,
    color: colors.textSecondary,
  },
  hudMetaDot: {
    fontSize: 11,
    color: "rgba(233,240,255,0.32)",
  },
  hudRight: {
    alignItems: "flex-end",
  },
  hudOutputKicker: {
    fontSize: 8,
    fontWeight: "700",
    color: "rgba(233,240,255,0.52)",
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    marginBottom: 2,
  },
  hudOutputNumber: {
    fontSize: 22,
    fontWeight: "200",
    fontFamily: MONO,
    color: "rgba(247,250,255,0.96)",
    fontVariant: ["tabular-nums"] as any,
  },

  // ══════════════ SECTION 3: RADAR + ENGINE STATS ══════════════
  radarStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radarContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  engineStatsCol: {
    flex: 1,
    gap: 10,
  },
  engineStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  engineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  engineStatLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    width: 52,
    textTransform: "uppercase" as const,
  },
  engineBarTrack: {
    flex: 1,
  },
  engineStatPct: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: MONO,
    color: "rgba(233,240,255,0.72)",
    width: 30,
    textAlign: "right",
    fontVariant: ["tabular-nums"] as any,
  },

  // ══════════════ SECTION 5: TODAY'S MISSIONS ══════════════
  missionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 4,
  },
  missionHeaderLink: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 1.5,
  },
  showMoreBtn: {
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 8,
  },
  showMoreText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  emptyMissions: {
    paddingVertical: 20,
    alignItems: "center",
    marginBottom: 8,
  },
  emptyMissionsText: {
    fontSize: 12,
    color: "rgba(233,240,255,0.42)",
  },

  // ══════════════ SECTION 6: HABITS + SKILL TREES ══════════════
  sideBySideRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    marginTop: 8,
  },
  halfCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: 14,
  },
  habitDotsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    marginBottom: 10,
  },
  habitDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  halfCardSub: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  skillProgressWrap: {
    marginTop: 10,
    marginBottom: 10,
  },

  // ══════════════ SECTION 7: BOTTOM NAV ROW ══════════════
  bottomNavRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  bottomNavBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  bottomNavKicker: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(233,240,255,0.72)",
    letterSpacing: 2,
    marginBottom: 4,
  },
  bottomNavSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});
