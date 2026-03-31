import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, RefreshControl, Pressable,
  ScrollView, useWindowDimensions, AppState,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle, FadeInDown,
  withRepeat, withSequence, withTiming, Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { getJSON, setJSON } from "../../src/db/storage";
import { colors, spacing, fonts, radius } from "../../src/theme";
import { XPBar } from "../../src/components/ui/XPBar";
import { StreakBadge } from "../../src/components/ui/StreakBadge";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { Panel } from "../../src/components/ui/Panel";
import { TitanProgress } from "../../src/components/ui/TitanProgress";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { useAnalyticsData } from "../../src/hooks/useAnalyticsData";
import { useEngineStore, selectAllTasksForDate, ENGINES, type TaskWithStatus } from "../../src/stores/useEngineStore";
import { useProfileStore, XP_REWARDS } from "../../src/stores/useProfileStore";
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

// ─── HQScreen — GTA Mission Select ──────────────────────────────────────────

export default function HQScreen() {
  const router = useRouter();
  const today = getTodayKey();

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

  // Mission toggle
  const handleToggle = useCallback((task: TaskWithStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const completed = toggleTask(task.engine, task.id!, analytics.today);
    const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
    if (completed) {
      awardXP(analytics.today, "task_complete", xp);
      updateStreak(analytics.today);
      // Re-evaluate skill trees after task completion
      evaluateAllTrees();
    } else {
      awardXP(analytics.today, "task_uncomplete", -xp);
    }
  }, [analytics.today, toggleTask, awardXP, updateStreak]);

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
  const [devDay, setDevDay] = useState(0);
  const handleDevSkipDay = () => {
    const newDay = devDay + 1;
    setDevDay(newDay);
    // Store the simulated day offset
    setJSON("dev_day_offset", newDay);
    // Inject archetype story for the simulated day
    const simulatedDayNumber = (dayNumber ?? 1) + newDay;
    const story = getStoryForDay(archetype ?? identity, simulatedDayNumber);
    if (story) {
      addEntry({ date: today, text: story.text, type: "story" });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HUDBackground />

      {/* DEV ONLY: Skip day button for story testing */}
      <View style={styles.devBar}>
        <Pressable onPress={handleDevSkipDay} style={styles.devBtn}>
          <Text style={styles.devBtnText}>DEV: Skip Day (+{devDay})</Text>
        </Pressable>
        <Text style={styles.devDayText}>Simulated Day {(dayNumber ?? 1) + devDay}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }
      >
        {/* ═══ CHARACTER HUD ═══ */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.hud}>
          <View style={styles.hudTop}>
            <View style={styles.hudIdentity}>
              <Text style={styles.hudIcon}>
                {ARCHETYPE_ICONS[archetype ?? identity ?? "titan"] ?? "\u26A1"}
              </Text>
              <View>
                <Text style={styles.hudName}>
                  {identityMeta?.name ?? (identity ? IDENTITY_LABELS[identity] : "TITAN PROTOCOL")}
                </Text>
                <Text style={styles.hudLevel}>LEVEL {profileLevel} {"\u00B7"} DAY {dayNumber}</Text>
              </View>
            </View>
            <View style={styles.hudStreak}>
              <Text style={styles.streakFire}>{"\uD83D\uDD25"}</Text>
              <Text style={styles.streakCount}>{profileStreak}</Text>
            </View>
          </View>
          {/* Chapter badge */}
          <View style={styles.chapterBadge}>
            <Text style={styles.chapterText}>
              CH.{chapter.number}: {chapter.name.toUpperCase()}
            </Text>
          </View>

          <XPBar xp={profileXp} level={profileLevel} />

          {/* Titan Score + Rank */}
          <View style={styles.scoreRow}>
            <View>
              <Text style={styles.scoreLabel}>TITAN SCORE</Text>
              <Text style={styles.scoreValue}>{analytics.titanScore}%</Text>
            </View>
            <View style={[styles.rankBadge, { borderColor: rank.color + "60" }]}>
              <Text style={[styles.rankLetter, { color: rank.color }]}>{rank.letter}</Text>
            </View>
            <View style={styles.engineDots}>
              {ENGINES.map((e) => (
                <View key={e} style={styles.engineDot}>
                  <View style={[styles.dot, { backgroundColor: ENGINE_COLORS[e] }]} />
                  <Text style={styles.dotValue}>{analytics.engineScores[e]}%</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* ═══ MISSION CARDS ═══ */}

        {/* Card 1: Daily Protocol */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          {protocolCompleted ? (
            <Panel style={styles.missionCard} delay={0}>
              <View style={styles.missionCardRow}>
                <Text style={styles.missionCardCheck}>{"\u2713"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.missionCardKicker}>DAILY PROTOCOL</Text>
                  <Text style={styles.missionCardTitle}>Protocol Complete</Text>
                  <Text style={styles.missionCardSub}>
                    Score: {protocolSession?.titanScore ?? analytics.titanScore}%
                    {identity ? ` \u00B7 ${IDENTITY_LABELS[identity]}` : ""}
                  </Text>
                </View>
              </View>
            </Panel>
          ) : (
            <Animated.View style={protocolBorderStyle}>
              <Pressable
                style={styles.protocolCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push("/protocol");
                }}
              >
                <Text style={styles.protocolKicker}>
                  {!morningDone ? "MORNING PROTOCOL" : "EVENING PROTOCOL"}
                </Text>
                <Text style={styles.protocolTitle}>
                  {!morningDone ? "Start Your Day" : "End Your Day"}
                </Text>
                <Text style={styles.protocolSub}>
                  {!morningDone
                    ? "Set your intention \u2022 Preview missions \u2022 Lock in focus"
                    : "Review score \u2022 Reflect \u2022 Cast identity vote"}
                </Text>
                <View style={styles.protocolBtn}>
                  <Text style={styles.protocolBtnText}>
                    {!morningDone ? "BEGIN MORNING" : "BEGIN EVENING"}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>

        {/* Card 2: Today's Missions */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)}>
          <Pressable
            onPress={() => setMissionsExpanded(!missionsExpanded)}
            style={styles.missionCardOuter}
          >
            <Panel style={styles.missionCard} delay={0}>
              <View style={styles.missionCardRow}>
                <View style={[styles.missionIcon, { backgroundColor: "rgba(52,211,153,0.15)" }]}>
                  <Text style={{ fontSize: 20 }}>{"\uD83C\uDFAF"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.missionCardKicker}>TODAY'S MISSIONS</Text>
                  <Text style={styles.missionCardTitle}>
                    {completedCount}/{tasks.length} completed
                  </Text>
                </View>
                <Text style={styles.expandArrow}>{missionsExpanded ? "\u25B2" : "\u25BC"}</Text>
              </View>

              {/* Engine progress bars */}
              <View style={styles.engineMiniBar}>
                {ENGINES.map((e) => (
                  <View key={e} style={{ flex: 1 }}>
                    <TitanProgress value={analytics.engineScores[e]} color={ENGINE_COLORS[e]} height={3} />
                  </View>
                ))}
              </View>
            </Panel>
          </Pressable>
        </Animated.View>

        {/* Expanded missions list */}
        {missionsExpanded && (
          <View style={styles.missionsExpanded}>
            {tasks.length === 0 ? (
              <Text style={styles.emptyText}>No missions yet. Go to an engine to add tasks.</Text>
            ) : (
              tasks.map((task) => (
                <MissionRow
                  key={task.id}
                  title={task.title}
                  xp={task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST}
                  completed={task.completed}
                  kind={task.kind}
                  engine={task.engine}
                  onToggle={() => handleToggle(task)}
                />
              ))
            )}
          </View>
        )}

        {/* Card 3: War Room */}
        <Animated.View entering={FadeInDown.delay(220).duration(400)}>
          <Pressable onPress={() => router.push("/war-room")}>
            <Panel style={styles.missionCard} delay={0}>
              <View style={styles.missionCardRow}>
                <View style={[styles.missionIcon, { backgroundColor: "rgba(248,113,113,0.15)" }]}>
                  <Text style={{ fontSize: 20 }}>{"\u2694\uFE0F"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.missionCardKicker}>WAR ROOM</Text>
                  <Text style={styles.missionCardTitle}>Operations Board</Text>
                  <Text style={styles.missionCardSub}>
                    Missions {"\u00B7"} Side Quests {"\u00B7"} Boss Challenge
                  </Text>
                </View>
                <Text style={styles.expandArrow}>{"\u2192"}</Text>
              </View>
            </Panel>
          </Pressable>
        </Animated.View>

        {/* Card 4: Skill Trees */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)}>
          <Panel style={styles.missionCard} delay={0}>
            <View style={styles.missionCardRow}>
              <View style={[styles.missionIcon, { backgroundColor: "rgba(167,139,250,0.15)" }]}>
                <Text style={{ fontSize: 20 }}>{"\uD83C\uDF33"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.missionCardKicker}>SKILL TREES</Text>
                <Text style={styles.missionCardTitle}>
                  {readyToClaimCount > 0
                    ? `${readyToClaimCount} node${readyToClaimCount > 1 ? "s" : ""} ready to claim`
                    : "Earn mastery through performance"}
                </Text>
              </View>
            </View>

            {/* 4 engine navigation rows — proper tap targets */}
            <View style={styles.skillEngineList}>
              {ENGINES.map((e) => {
                const nodes = skillProgress[e] ?? [];
                const claimed = nodes.filter((n) => n.status === "claimed").length;
                const ready = nodes.filter((n) => n.status === "ready").length;
                const total = nodes.length || SKILL_TREES[e]?.reduce((s, b) => s + b.nodes.length, 0) || 0;
                const pct = total > 0 ? (claimed / total) * 100 : 0;
                return (
                  <Pressable
                    key={e}
                    style={styles.skillEngineRow}
                    onPress={() => router.push(`/skill-tree/${e}`)}
                  >
                    <View style={[styles.skillEngineDot, { backgroundColor: ENGINE_COLORS[e] }]} />
                    <Text style={[styles.skillEngineName, { color: ENGINE_COLORS[e] }]}>
                      {ENGINE_LABELS[e]}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <TitanProgress value={pct} color={ENGINE_COLORS[e]} height={3} />
                    </View>
                    <Text style={styles.skillEngineCount}>{claimed}/{total}</Text>
                    {ready > 0 && (
                      <View style={[styles.skillReadyBadge, { backgroundColor: ENGINE_COLORS[e] + "25", borderColor: ENGINE_COLORS[e] + "50" }]}>
                        <Text style={[styles.skillReadyText, { color: ENGINE_COLORS[e] }]}>{ready}</Text>
                      </View>
                    )}
                    <Text style={styles.expandArrow}>{"\u2192"}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Panel>
        </Animated.View>

        {/* Card 4: Analytics */}
        <Animated.View entering={FadeInDown.delay(320).duration(400)}>
          <Pressable onPress={() => router.push("/hub/analytics")}>
            <Panel style={styles.missionCard} delay={0}>
              <View style={styles.missionCardRow}>
                <View style={[styles.missionIcon, { backgroundColor: "rgba(96,165,250,0.15)" }]}>
                  <Text style={{ fontSize: 20 }}>{"\uD83D\uDCCA"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.missionCardKicker}>ANALYTICS</Text>
                  <Text style={styles.missionCardTitle}>Deep dive into your data</Text>
                </View>
                <Text style={styles.expandArrow}>{"\u2192"}</Text>
              </View>
            </Panel>
          </Pressable>
        </Animated.View>

        {/* ═══ STORY FEED ═══ */}
        {latestNarrative && (
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            <Pressable onPress={() => router.push("/narrative")}>
              <View style={styles.storyCard}>
                <Text style={styles.storyKicker}>STORY</Text>
                <Text style={styles.storyText} numberOfLines={2}>
                  {latestNarrative.text}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },

  // DEV ONLY
  devBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.xs,
    backgroundColor: "rgba(248,113,113,0.1)", borderBottomWidth: 1,
    borderBottomColor: "rgba(248,113,113,0.2)",
  },
  devBtn: {
    backgroundColor: "rgba(248,113,113,0.2)", borderRadius: 6,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  devBtnText: { fontSize: 10, fontWeight: "700", color: "#f87171", letterSpacing: 1 },
  devDayText: { fontSize: 10, color: "#f87171", opacity: 0.7 },

  // HUD
  hud: { paddingTop: spacing.md, marginBottom: spacing.lg },
  hudTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  hudIdentity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  hudIcon: { fontSize: 32 },
  hudName: { fontSize: 16, fontWeight: "700", color: colors.text, letterSpacing: 0.5 },
  hudLevel: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginTop: 2 },
  hudStreak: { flexDirection: "row", alignItems: "center", gap: 4 },
  streakFire: { fontSize: 18 },
  streakCount: { ...fonts.mono, fontSize: 18, fontWeight: "800", color: colors.text },

  // Chapter
  chapterBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius.sm, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  chapterText: { ...fonts.kicker, fontSize: 8, color: colors.textMuted, letterSpacing: 2 },

  // Score
  scoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.md },
  scoreLabel: { ...fonts.kicker, fontSize: 9, color: colors.textMuted },
  scoreValue: { ...fonts.monoValue, fontSize: 36, color: colors.text },
  rankBadge: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  rankLetter: { fontSize: 20, fontWeight: "900" },
  engineDots: { flex: 1, gap: 4 },
  engineDot: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotValue: { ...fonts.mono, fontSize: 10, color: colors.textMuted },

  // Mission cards
  missionCard: { marginBottom: 0 },
  missionCardOuter: { marginBottom: 0 },
  missionCardRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  missionCardKicker: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: 2 },
  missionCardTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  missionCardSub: { ...fonts.mono, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  missionCardCheck: { fontSize: 28, color: colors.success, marginRight: spacing.xs },
  missionIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center",
  },
  expandArrow: { fontSize: 14, color: colors.textMuted },

  // Engine mini bars (in missions card)
  engineMiniBar: { flexDirection: "row", gap: 6, marginTop: spacing.md },

  // Expanded missions
  missionsExpanded: { marginBottom: spacing.sm },

  // Protocol card
  protocolCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.md, borderWidth: 1.5,
    padding: spacing.lg, marginBottom: spacing.sm,
  },
  protocolKicker: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.sm },
  protocolTitle: { fontSize: 22, fontWeight: "200", color: colors.text, marginBottom: spacing.xs },
  protocolSub: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.lg },
  protocolBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: "center",
  },
  protocolBtnText: { ...fonts.kicker, fontSize: 12, color: "#000", letterSpacing: 2 },

  // Skill tree engine list
  skillEngineList: { marginTop: spacing.md, gap: spacing.sm },
  skillEngineRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    minHeight: 40,
  },
  skillEngineDot: { width: 8, height: 8, borderRadius: 4 },
  skillEngineName: { ...fonts.kicker, fontSize: 9, width: 60, letterSpacing: 1 },
  skillEngineCount: { ...fonts.mono, fontSize: 11, color: colors.textMuted, width: 36, textAlign: "right" },
  skillReadyBadge: {
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 6, paddingVertical: 2, marginLeft: 2,
  },
  skillReadyText: { ...fonts.mono, fontSize: 9, fontWeight: "700" },

  // Story feed
  storyCard: {
    marginTop: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: radius.md, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: spacing.md,
  },
  storyKicker: { ...fonts.kicker, fontSize: 8, color: colors.textMuted, marginBottom: spacing.xs, letterSpacing: 2 },
  storyText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, fontStyle: "italic" },

  // Empty
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.xl },
});
