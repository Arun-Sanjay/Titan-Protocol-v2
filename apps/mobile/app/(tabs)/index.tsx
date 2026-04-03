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
import { getTodayKey } from "../../src/lib/date";
import { getDailyRank } from "../../src/db/gamification";
import { getCurrentChapter, getDayNumber } from "../../src/data/chapters";
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
const ARCHETYPE_ICONS: Record<string, string> = {
  titan: "\u26A1", athlete: "\uD83D\uDCAA", scholar: "\uD83D\uDCDA", hustler: "\uD83D\uDCB0",
  showman: "\uD83C\uDFA4", warrior: "\u2694\uFE0F", founder: "\uD83D\uDE80", charmer: "\u2728",
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
  const protocolSession = useProtocolStore((s) => s.getSession(today));
  const skillProgress = useSkillTreeStore((s) => s.progress);

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

  // Skill tree ready count
  const readyToClaimCount = useMemo(() => {
    let count = 0;
    for (const engine of ENGINES) {
      const nodes = skillProgress[engine] ?? [];
      count += nodes.filter((n) => n.status === "ready").length;
    }
    return count;
  }, [skillProgress]);

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
      // System notification
      notify({
        type: "xp",
        title: `+${xp} XP`,
        subtitle: task.title,
      });
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
          withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      );
    }
  }, [protocolCompleted]);
  const protocolBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(247, 250, 255, ${protocolPulse.value})`,
  }));

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      `Day ${simulatedDayNumber} Simulated`,
      "Close and reopen the app to see the cinematic for this day.",
      [{ text: "OK" }],
    );
  };

  // ── Derived metrics for new dashboard sections ──
  const sparklineCardWidth = (screenWidth - 48 - 12) / 2; // 2 columns with gap

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

  // VS Last Week comparison arrows
  const vsLastWeek = useMemo(() => {
    return ENGINES.map((e) => {
      const thisW = analytics.thisWeekEngines[e];
      const lastW = analytics.lastWeek[e];
      const diff = thisW - lastW;
      return { engine: e, thisWeek: thisW, lastWeek: lastW, diff };
    });
  }, [analytics.thisWeekEngines, analytics.lastWeek]);

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

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }
      >
        {/* ══════════════ SECTION 1: CHARACTER HUD ══════════════ */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={s.hudSection}>
          <Text style={s.hudKicker}>
            DAY {dayNumber} {"\u00B7"} CH.{chapter.number}: {chapter.name.toUpperCase()}
          </Text>
          <View style={s.hudIdentityRow}>
            <Text style={s.hudArchetypeIcon}>
              {ARCHETYPE_ICONS[archetype ?? identity ?? "titan"] ?? "\u26A1"}
            </Text>
            <Text style={s.hudArchetypeName}>
              {identityMeta?.name ?? (identity ? IDENTITY_LABELS[identity] : "TITAN PROTOCOL")}
            </Text>
          </View>
          <View style={s.hudMetaRow}>
            <Text style={s.hudMetaText}>LVL {profileLevel}</Text>
            <View style={s.hudMetaDot} />
            <Text style={[s.hudStreakText, { color: getIntegrityColor(loadIntegrity().level) }]}>
              {"\uD83D\uDD25"} {protocolStreak} {"\u00B7"} {loadIntegrity().level}
            </Text>
            {getMomentum(protocolStreak).multiplier > 1 && (
              <>
                <View style={s.hudMetaDot} />
                <Text style={[s.hudMetaText, { color: getMomentumColor(getMomentum(protocolStreak).tier) }]}>
                  {getMomentum(protocolStreak).multiplier}x
                </Text>
              </>
            )}
          </View>
        </Animated.View>

        {/* ══════════════ PLAYER HUD ROW ══════════════ */}
        <Animated.View entering={FadeInDown.delay(20).duration(400)} style={s.playerHudRow}>
          <Pressable style={s.statusBtn} onPress={() => router.push("/status")}>
            <Text style={s.statusBtnText}>STATUS</Text>
          </Pressable>
          <Pressable style={s.statusBtn} onPress={() => router.push("/field-ops")}>
            <Text style={s.statusBtnText}>FIELD OPS</Text>
          </Pressable>
          <Pressable style={s.statusBtn} onPress={() => router.push("/titles")}>
            <Text style={s.statusBtnText}>TITLES</Text>
          </Pressable>
        </Animated.View>

        {/* ══════════════ SYSTEM VOICE ══════════════ */}
        <SystemVoice delay={40} />

        {/* ══════════════ SECTION 2: TITAN SCORE HERO ══════════════ */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <Panel style={s.card} tone="hero" delay={60}>
            <Text style={s.kicker}>TITAN SCORE</Text>
            <Text style={s.heroScore}>{analytics.titanScore}%</Text>
            <Text style={s.heroSub}>
              {analytics.activeEngines}/4 engines active today
            </Text>

            {/* 4 engine progress bars */}
            <View style={s.engineBarsWrap}>
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
          </Panel>
        </Animated.View>

        {/* ══════════════ SECTION 3: ENGINE OVERVIEW (Radar) ══════════════ */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)}>
          <Panel style={s.card} delay={120}>
            <Text style={s.kicker}>ENGINE OVERVIEW</Text>
            <View style={s.radarWrap}>
              <RadarChart
                scores={analytics.engineScores}
                size={Math.min(screenWidth - 80, 240)}
              />
            </View>
          </Panel>
        </Animated.View>

        {/* ══════════════ SECTION 4: PROTOCOL CARD ══════════════ */}
        <Animated.View entering={FadeInDown.delay(180).duration(400)}>
          {protocolCompleted ? (
            <Panel style={s.card} delay={180}>
              <View style={s.protocolDoneRow}>
                <Text style={s.protocolCheckMark}>{"\u2713"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.kicker}>DAILY PROTOCOL</Text>
                  <Text style={s.protocolDoneTitle}>Protocol Complete</Text>
                  <Text style={s.mutedText}>
                    Score: {protocolSession?.titanScore ?? analytics.titanScore}%
                    {identity ? ` \u00B7 ${IDENTITY_LABELS[identity]}` : ""}
                  </Text>
                </View>
              </View>
            </Panel>
          ) : (
            <Animated.View style={protocolBorderStyle}>
              <Pressable
                style={s.protocolCardActive}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push("/protocol");
                }}
              >
                <Text style={s.kicker}>
                  {!morningDone ? "MORNING PROTOCOL" : "EVENING PROTOCOL"}
                </Text>
                <Text style={s.protocolActiveTitle}>
                  {!morningDone ? "Start Your Day" : "End Your Day"}
                </Text>
                <Text style={s.protocolActiveSub}>
                  {!morningDone
                    ? "Set your intention \u2022 Preview missions \u2022 Lock in focus"
                    : "Review score \u2022 Reflect \u2022 Cast identity vote"}
                </Text>
                <View style={s.protocolCTA}>
                  <Text style={s.protocolCTAText}>
                    {!morningDone ? "BEGIN MORNING" : "BEGIN EVENING"}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>

        {/* ══════════════ DAILY QUEST ══════════════ */}
        <QuestCard delay={200} />

        {/* ══════════════ SECTION 5: ENGINE SPARKLINE GRID (2x2) ══════════════ */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)}>
          <Text style={[s.kicker, { marginBottom: 12 }]}>ENGINES</Text>
          <View style={s.sparkGrid}>
            {ENGINES.map((e) => {
              const score = analytics.engineScores[e];
              const stats = engineTaskStats[e];
              return (
                <View key={e} style={[s.sparkCard, { width: sparklineCardWidth }]}>
                  {/* Header */}
                  <View style={s.sparkCardHeader}>
                    <Text style={[s.sparkEngineName, { color: ENGINE_COLORS[e] }]}>
                      {ENGINE_LABELS[e]}
                    </Text>
                    <Text style={s.sparkScore}>{score}%</Text>
                  </View>

                  {/* Sparkline */}
                  <View style={s.sparkChartWrap}>
                    <SparklineChart
                      data={analytics.sparklineData[e]}
                      width={sparklineCardWidth - 24}
                      height={44}
                      color={ENGINE_COLORS[e]}
                    />
                  </View>

                  {/* Footer */}
                  <View style={s.sparkCardFooter}>
                    <Text style={s.sparkFooterText}>
                      Today: {score}%
                    </Text>
                    <Text style={s.sparkFooterPts}>
                      {stats.done}/{stats.total} pts
                    </Text>
                  </View>

                  {/* Enter button */}
                  <Pressable
                    style={[s.sparkEnterBtn, { borderColor: ENGINE_COLORS[e] + "40" }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(`/engine/${e}`);
                    }}
                  >
                    <Text style={[s.sparkEnterText, { color: ENGINE_COLORS[e] }]}>ENTER</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* ══════════════ SECTION 6: VS LAST WEEK ══════════════ */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Panel style={s.card} delay={300}>
            <Text style={s.kicker}>VS LAST WEEK</Text>
            <View style={s.vsRow}>
              {vsLastWeek.map(({ engine, thisWeek: tw, lastWeek: lw, diff }) => {
                const isUp = diff > 0;
                const isDown = diff < 0;
                const arrowColor = isUp ? "#5cc9a0" : isDown ? "#de6b7d" : "rgba(247,250,255,0.96)";
                const arrow = isUp ? "\u2191" : isDown ? "\u2193" : "\u2013";
                return (
                  <View key={engine} style={s.vsCol}>
                    <Text style={[s.vsEngineName, { color: ENGINE_COLORS[engine] }]}>
                      {ENGINE_LABELS[engine]}
                    </Text>
                    <View style={s.vsArrowRow}>
                      <Text style={[s.vsArrow, { color: arrowColor }]}>{arrow}</Text>
                      <Text style={[s.vsDiff, { color: arrowColor }]}>
                        {Math.abs(diff)}%
                      </Text>
                    </View>
                    <Text style={s.vsComparison}>{tw}% vs {lw}%</Text>
                  </View>
                );
              })}
            </View>
          </Panel>
        </Animated.View>

        {/* ══════════════ SECTION 7: THIS WEEK STATS ══════════════ */}
        <Animated.View entering={FadeInDown.delay(360).duration(400)}>
          <Panel style={s.card} delay={360}>
            <Text style={s.kicker}>THIS WEEK</Text>
            <View style={s.weekStatsRow}>
              <View style={s.weekStatCell}>
                <Text style={s.weekStatNumber}>{analytics.thisWeek.avgScore}%</Text>
                <Text style={s.weekStatLabel}>AVG TITAN{"\n"}SCORE</Text>
              </View>
              <View style={s.weekStatDivider} />
              <View style={s.weekStatCell}>
                <Text style={s.weekStatNumber}>{analytics.thisWeek.tasksCompleted}</Text>
                <Text style={s.weekStatLabel}>TASKS{"\n"}COMPLETED</Text>
              </View>
              <View style={s.weekStatDivider} />
              <View style={s.weekStatCell}>
                <Text style={s.weekStatNumber}>{analytics.thisWeek.bestDayScore}%</Text>
                <Text style={s.weekStatLabel}>BEST{"\n"}DAY</Text>
              </View>
            </View>
          </Panel>
        </Animated.View>

        {/* ══════════════ SECTION 8: SKILL TREES ══════════════ */}
        <Animated.View entering={FadeInDown.delay(420).duration(400)}>
          <Panel style={s.card} delay={420}>
            <View style={s.skillHeader}>
              <View style={s.skillHeaderLeft}>
                <Text style={{ fontSize: 20 }}>{"\uD83C\uDF33"}</Text>
                <View>
                  <Text style={s.kicker}>SKILL TREES</Text>
                  <Text style={s.skillSubtitle}>
                    {readyToClaimCount > 0
                      ? `${readyToClaimCount} node${readyToClaimCount > 1 ? "s" : ""} ready to claim`
                      : "Earn mastery through performance"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={s.skillEngineList}>
              {ENGINES.map((e) => {
                const nodes = skillProgress[e] ?? [];
                const claimed = nodes.filter((n) => n.status === "claimed").length;
                const ready = nodes.filter((n) => n.status === "ready").length;
                const total = nodes.length || SKILL_TREES[e]?.reduce((acc, b) => acc + b.nodes.length, 0) || 0;
                const pct = total > 0 ? (claimed / total) * 100 : 0;
                return (
                  <Pressable
                    key={e}
                    style={s.skillEngineRow}
                    onPress={() => router.push(`/skill-tree/${e}`)}
                  >
                    <View style={[s.skillEngineDot, { backgroundColor: ENGINE_COLORS[e] }]} />
                    <Text style={[s.skillEngineName, { color: ENGINE_COLORS[e] }]}>
                      {ENGINE_LABELS[e]}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <TitanProgress value={pct} color={ENGINE_COLORS[e]} height={3} />
                    </View>
                    <Text style={s.skillEngineCount}>{claimed}/{total}</Text>
                    {ready > 0 && (
                      <View style={[s.skillReadyBadge, {
                        backgroundColor: ENGINE_COLORS[e] + "25",
                        borderColor: ENGINE_COLORS[e] + "50",
                      }]}>
                        <Text style={[s.skillReadyText, { color: ENGINE_COLORS[e] }]}>{ready}</Text>
                      </View>
                    )}
                    <Text style={s.chevron}>{"\u2192"}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Panel>
        </Animated.View>

        {/* ══════════════ SECTION 9: WAR ROOM ══════════════ */}
        <Animated.View entering={FadeInDown.delay(480).duration(400)}>
          <Panel
            style={s.card}
            delay={480}
            onPress={() => router.push("/war-room")}
          >
            <View style={s.warRoomRow}>
              <View style={s.warRoomIcon}>
                <Text style={{ fontSize: 20 }}>{"\u2694\uFE0F"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kicker}>WAR ROOM</Text>
                <Text style={s.warRoomTitle}>Operations Board</Text>
                <Text style={s.mutedText}>
                  Missions {"\u00B7"} Side Quests {"\u00B7"} Boss Challenge
                </Text>
              </View>
              <Text style={s.chevron}>{"\u2192"}</Text>
            </View>
          </Panel>
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
  chevron: {
    fontSize: 14,
    color: "rgba(233,240,255,0.52)",
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
    marginBottom: 8,
  },
  hudIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  hudArchetypeIcon: {
    fontSize: 28,
  },
  hudArchetypeName: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(247,250,255,0.96)",
    letterSpacing: 0.5,
  },
  hudMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
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

  // ══════════════ PLAYER HUD ROW ══════════════
  playerHudRow: {
    flexDirection: "row" as const,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statusBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: "center" as const,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  statusBtnText: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: "700" as const,
    color: colors.textMuted,
    letterSpacing: 2,
  },

  // ══════════════ SECTION 2: TITAN SCORE HERO ══════════════
  heroScore: {
    fontSize: 48,
    fontWeight: "200",
    fontFamily: MONO,
    color: "rgba(247,250,255,0.96)",
    fontVariant: ["tabular-nums"] as any,
    marginBottom: 2,
  },
  heroSub: {
    fontSize: 11,
    color: "rgba(233,240,255,0.52)",
    marginBottom: 16,
  },
  engineBarsWrap: {
    gap: 10,
  },
  engineBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  engineColorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  engineBarLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    width: 70,
    textTransform: "uppercase" as const,
  },
  engineBarTrack: {
    flex: 1,
  },
  engineBarPct: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: MONO,
    color: "rgba(233,240,255,0.72)",
    width: 32,
    textAlign: "right",
    fontVariant: ["tabular-nums"] as any,
  },

  // ══════════════ SECTION 3: RADAR ══════════════
  radarWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },

  // ══════════════ SECTION 4: PROTOCOL ══════════════
  protocolDoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  protocolCheckMark: {
    fontSize: 28,
    color: "#5cc9a0",
  },
  protocolDoneTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(247,250,255,0.96)",
    marginTop: 2,
  },
  protocolCardActive: {
    backgroundColor: "rgba(0,0,0,0.97)",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 16,
    overflow: "hidden",
  },
  protocolActiveTitle: {
    fontSize: 22,
    fontWeight: "200",
    color: "rgba(247,250,255,0.96)",
    marginBottom: 4,
    marginTop: 4,
  },
  protocolActiveSub: {
    fontSize: 12,
    color: "rgba(233,240,255,0.52)",
    marginBottom: 20,
  },
  protocolCTA: {
    backgroundColor: "rgba(247,250,255,0.96)",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  protocolCTAText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000000",
    letterSpacing: 2,
  },

  // ══════════════ SECTION 5: ENGINE SPARKLINE GRID ══════════════
  sparkGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  sparkCard: {
    backgroundColor: "rgba(0,0,0,0.97)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    padding: 14,
    overflow: "hidden",
  },
  sparkCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  sparkEngineName: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  sparkScore: {
    fontSize: 22,
    fontWeight: "200",
    fontFamily: MONO,
    color: "rgba(247,250,255,0.96)",
    fontVariant: ["tabular-nums"] as any,
  },
  sparkChartWrap: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.86)",
    padding: 4,
    alignItems: "center",
    marginBottom: 8,
  },
  sparkCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sparkFooterText: {
    fontSize: 10,
    color: "rgba(233,240,255,0.52)",
  },
  sparkFooterPts: {
    fontSize: 10,
    fontFamily: MONO,
    color: "rgba(233,240,255,0.52)",
    fontVariant: ["tabular-nums"] as any,
  },
  sparkEnterBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center",
  },
  sparkEnterText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },

  // ══════════════ SECTION 6: VS LAST WEEK ══════════════
  vsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  vsCol: {
    flex: 1,
    alignItems: "center",
  },
  vsEngineName: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    marginBottom: 6,
  },
  vsArrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 4,
  },
  vsArrow: {
    fontSize: 16,
    fontWeight: "700",
  },
  vsDiff: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: MONO,
    fontVariant: ["tabular-nums"] as any,
  },
  vsComparison: {
    fontSize: 9,
    color: "rgba(233,240,255,0.42)",
    fontFamily: MONO,
    fontVariant: ["tabular-nums"] as any,
  },

  // ══════════════ SECTION 7: THIS WEEK STATS ══════════════
  weekStatsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginTop: 8,
  },
  weekStatCell: {
    flex: 1,
    alignItems: "center",
  },
  weekStatNumber: {
    fontSize: 28,
    fontWeight: "200",
    fontFamily: MONO,
    color: "rgba(247,250,255,0.96)",
    fontVariant: ["tabular-nums"] as any,
    marginBottom: 4,
  },
  weekStatLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(233,240,255,0.52)",
    textTransform: "uppercase" as const,
    letterSpacing: 1.5,
    textAlign: "center",
    lineHeight: 13,
  },
  weekStatDivider: {
    width: 1,
    height: 48,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginTop: 4,
  },

  // ══════════════ SECTION 8: SKILL TREES ══════════════
  skillHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  skillHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  skillSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(247,250,255,0.96)",
    marginTop: 2,
  },
  skillEngineList: {
    gap: 8,
  },
  skillEngineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    minHeight: 40,
  },
  skillEngineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  skillEngineName: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    width: 60,
    textTransform: "uppercase" as const,
  },
  skillEngineCount: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: MONO,
    color: "rgba(233,240,255,0.52)",
    width: 36,
    textAlign: "right",
    fontVariant: ["tabular-nums"] as any,
  },
  skillReadyBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 2,
  },
  skillReadyText: {
    fontSize: 9,
    fontWeight: "700",
    fontFamily: MONO,
  },

  // ══════════════ SECTION 9: WAR ROOM ══════════════
  warRoomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  warRoomIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(248,113,113,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  warRoomTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(247,250,255,0.96)",
    marginTop: 2,
  },
});
