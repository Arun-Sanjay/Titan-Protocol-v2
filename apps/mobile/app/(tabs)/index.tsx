import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, RefreshControl, Pressable,
  ScrollView, useWindowDimensions, AppState, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { getJSON, setJSON } from "../../src/db/storage";
import { colors, spacing, fonts, shadows, radius } from "../../src/theme";
import { XPBar } from "../../src/components/ui/XPBar";
import { StreakBadge } from "../../src/components/ui/StreakBadge";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { PageHeader } from "../../src/components/ui/PageHeader";
import { Panel } from "../../src/components/ui/Panel";
import { RadarChart } from "../../src/components/ui/RadarChart";
import { SparklineChart } from "../../src/components/ui/SparklineChart";
import { HeatmapGrid } from "../../src/components/ui/HeatmapGrid";
import { WeekComparison } from "../../src/components/ui/WeekComparison";
import { WeeklySummary } from "../../src/components/ui/WeeklySummary";
import { TitanProgress } from "../../src/components/ui/TitanProgress";
import { ScoreGauge } from "../../src/components/ui/ScoreGauge";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { FloatingActionButton } from "../../src/components/ui/FloatingActionButton";
import { useAnalyticsData } from "../../src/hooks/useAnalyticsData";
import { useEngineStore, selectAllTasksForDate, ENGINES, type TaskWithStatus } from "../../src/stores/useEngineStore";
import { useProfileStore, XP_REWARDS } from "../../src/stores/useProfileStore";
import { useModeStore, IDENTITY_LABELS } from "../../src/stores/useModeStore";
import { useProtocolStore } from "../../src/stores/useProtocolStore";
import { useHabitStore } from "../../src/stores/useHabitStore";
import { useJournalStore } from "../../src/stores/useJournalStore";
import { useSkillTreeStore } from "../../src/stores/useSkillTreeStore";
import { getTodayKey } from "../../src/lib/date";
import type { EngineKey } from "../../src/db/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const ENGINE_LABELS: Record<EngineKey, string> = {
  body: "BODY", mind: "MIND", money: "MONEY", general: "GENERAL",
};
const ENGINE_COLORS: Record<EngineKey, string> = {
  body: colors.body, mind: colors.mind, money: colors.money, general: colors.general,
};
const ENGINE_BORDER_COLORS: Record<EngineKey, string> = {
  body: "#00FF88", mind: "#A78BFA", money: "#FBBF24", general: "#60A5FA",
};

// ─── Suggested Missions ───────────────────────────────────────────────────────

type SuggestedMission = {
  id: string;
  engine: EngineKey;
  title: string;
  type: "mission" | "side_quest";
};

const SUGGESTION_POOL: SuggestedMission[] = [
  { id: "body_workout", engine: "body", title: "Complete a workout session", type: "mission" },
  { id: "body_sleep",   engine: "body", title: "Get 8 hours of sleep",        type: "mission" },
  { id: "body_walk",    engine: "body", title: "Walk 10,000 steps today",     type: "side_quest" },
  { id: "body_water",   engine: "body", title: "Drink 2L of water",           type: "side_quest" },
  { id: "mind_focus",   engine: "mind", title: "Complete a focus session",    type: "mission" },
  { id: "mind_read",    engine: "mind", title: "Read for 30 minutes",         type: "mission" },
  { id: "mind_meditate",engine: "mind", title: "Meditate for 10 minutes",    type: "side_quest" },
  { id: "mind_journal", engine: "mind", title: "Write in your journal",       type: "side_quest" },
  { id: "money_review", engine: "money", title: "Review expenses and budget", type: "mission" },
  { id: "money_deepwork",engine:"money", title: "Complete a deep work session",type:"mission" },
  { id: "money_save",   engine: "money", title: "Log your savings progress",  type: "side_quest" },
  { id: "general_plan", engine: "general", title: "Plan tomorrow's tasks",    type: "mission" },
  { id: "general_tidy", engine: "general", title: "Tidy your workspace",      type: "side_quest" },
  { id: "general_learn",engine: "general", title: "Learn something new today",type: "side_quest" },
];

const DISMISSED_KEY = "dismissed_suggestions";

function SuggestionRow({
  mission,
  onAdd,
  onDismiss,
}: {
  mission: SuggestedMission;
  onAdd: (m: SuggestedMission) => void;
  onDismiss: (id: string) => void;
}) {
  const pts = mission.type === "mission" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
  return (
    <View style={[suggStyles.row, { borderLeftColor: ENGINE_BORDER_COLORS[mission.engine] }]}>
      <View style={suggStyles.info}>
        <Text style={suggStyles.suggTitle} numberOfLines={1}>{mission.title}</Text>
        <View style={suggStyles.meta}>
          <Text style={[suggStyles.engineLabel, { color: ENGINE_COLORS[mission.engine] }]}>
            {ENGINE_LABELS[mission.engine]}
          </Text>
          <Text style={suggStyles.typeSep}>·</Text>
          <Text style={suggStyles.typeLabel}>
            {mission.type === "mission" ? "MISSION" : "SIDE QUEST"}
          </Text>
          <View style={suggStyles.badge}>
            <Text style={suggStyles.badgeText}>+{pts} XP</Text>
          </View>
        </View>
      </View>
      <Pressable style={suggStyles.addBtn} onPress={() => onAdd(mission)} hitSlop={8}>
        <Text style={suggStyles.addBtnText}>ADD</Text>
      </Pressable>
      <Pressable style={suggStyles.dismissBtn} onPress={() => onDismiss(mission.id)} hitSlop={8}>
        <Text style={suggStyles.dismissBtnText}>✕</Text>
      </Pressable>
    </View>
  );
}

const suggStyles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.84)", borderRadius: radius.md,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderLeftWidth: 3,
    paddingHorizontal: 11, paddingVertical: 9, marginBottom: spacing.sm, gap: spacing.sm,
  },
  info: { flex: 1 },
  suggTitle: { fontSize: 15, fontWeight: "500", color: colors.text },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  engineLabel: { ...fonts.kicker, fontSize: 9 },
  typeSep: { ...fonts.kicker, fontSize: 9, color: colors.textMuted },
  typeLabel: { ...fonts.kicker, fontSize: 9, color: colors.textMuted },
  badge: {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.sm,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 5, paddingVertical: 2, marginLeft: 2,
  },
  badgeText: { ...fonts.mono, fontSize: 10, color: colors.textSecondary },
  addBtn: {
    backgroundColor: colors.accent, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 6, minWidth: 44, alignItems: "center",
  },
  addBtnText: { ...fonts.kicker, fontSize: 11, color: "#000", fontWeight: "700", letterSpacing: 1 },
  dismissBtn: { padding: spacing.xs, alignItems: "center", justifyContent: "center" },
  dismissBtnText: { ...fonts.mono, fontSize: 13, color: colors.textMuted },
});

// ─── Protocol Card ────────────────────────────────────────────────────────────

function ProtocolCard({
  completed,
  score,
  identity,
  onStart,
}: {
  completed: boolean;
  score: number;
  identity: string | null;
  onStart: () => void;
}) {
  // Pulsing border animation for the button
  const borderOpacity = useSharedValue(0.4);
  useEffect(() => {
    if (!completed) {
      borderOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
  }, [completed]);

  const pulseStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(247, 250, 255, ${borderOpacity.value})`,
  }));

  if (completed) {
    return (
      <Panel tone="hero" style={pcStyles.panel} delay={0}>
        <View style={pcStyles.completedRow}>
          <Text style={pcStyles.completedCheck}>✓</Text>
          <View style={{ flex: 1 }}>
            <Text style={pcStyles.completedTitle}>PROTOCOL COMPLETE</Text>
            <Text style={pcStyles.completedScore}>Today's score: {score}%</Text>
            {identity && (
              <Text style={pcStyles.completedVote}>
                Vote cast as {identity}
              </Text>
            )}
          </View>
        </View>
      </Panel>
    );
  }

  return (
    <Panel tone="hero" style={pcStyles.panel} delay={0}>
      <Text style={pcStyles.kicker}>DAILY PROTOCOL READY</Text>
      <Text style={pcStyles.title}>3-minute{"\n"}guided session</Text>
      <Text style={pcStyles.subtitle}>
        Set your intention · Train your mind · Check your habits
      </Text>
      <Animated.View style={[pcStyles.startBtnWrap, pulseStyle]}>
        <Pressable
          style={pcStyles.startBtn}
          onPress={onStart}
          onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
        >
          <Text style={pcStyles.startBtnText}>START PROTOCOL</Text>
        </Pressable>
      </Animated.View>
    </Panel>
  );
}

const pcStyles = StyleSheet.create({
  panel: { marginTop: spacing.md },
  kicker: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.sm },
  title: { fontSize: 32, fontWeight: "200", color: colors.text, lineHeight: 38, marginBottom: spacing.sm },
  subtitle: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.xl },
  startBtnWrap: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  startBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md - 2,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  startBtnText: { ...fonts.kicker, fontSize: 13, color: "#000", letterSpacing: 2 },
  completedRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  completedCheck: { fontSize: 36, color: colors.success },
  completedTitle: { ...fonts.kicker, fontSize: 10, color: colors.success, marginBottom: 4 },
  completedScore: { fontSize: 15, fontWeight: "600", color: colors.text },
  completedVote: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginTop: 4 },
});

// ─── Zen Mode: Intention + Habit + Journal panel ──────────────────────────────

function ZenDashboard({
  dateKey,
}: {
  dateKey: string;
}) {
  const habits = useHabitStore((s) => s.habits);
  const completedIds = useHabitStore((s) => s.completedIds);
  const toggleHabit = useHabitStore((s) => s.toggleHabit);
  const loadHabits = useHabitStore((s) => s.load);
  const saveEntry = useJournalStore((s) => s.saveEntry);
  const loadEntry = useJournalStore((s) => s.loadEntry);
  const getEntry = useJournalStore((s) => s.getEntry);
  const awardXP = useProfileStore((s) => s.awardXP);

  const [intention, setIntention] = useState("");
  const [journalText, setJournalText] = useState("");
  const [journalSaved, setJournalSaved] = useState(false);

  useEffect(() => {
    loadHabits(dateKey);
    loadEntry(dateKey);
    const existing = getEntry(dateKey);
    if (existing) setJournalText(existing.content);
  }, [dateKey]);

  const completedSet = new Set(completedIds[dateKey] ?? []);

  const handleToggle = (id: number) => {
    const done = toggleHabit(id, dateKey);
    if (done) awardXP(dateKey, "habit_complete", XP_REWARDS.HABIT_COMPLETE);
    else awardXP(dateKey, "habit_uncomplete", -XP_REWARDS.HABIT_COMPLETE);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveJournal = () => {
    if (!journalText.trim()) return;
    saveEntry(dateKey, journalText.trim());
    awardXP(dateKey, "journal_entry", XP_REWARDS.JOURNAL_ENTRY);
    setJournalSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <>
      {/* Intention */}
      <Panel tone="hero" style={{ marginTop: spacing.md }}>
        <Text style={zenStyles.label}>TODAY'S INTENTION</Text>
        <TextInput
          value={intention}
          onChangeText={setIntention}
          placeholder="What is your one focus today?"
          placeholderTextColor={colors.textMuted}
          style={zenStyles.input}
          multiline
        />
      </Panel>

      {/* Habits */}
      {habits.length > 0 && (
        <>
          <SectionHeader title="HABITS" />
          {habits.map((h) => {
            const done = completedSet.has(h.id!);
            return (
              <Pressable
                key={h.id}
                style={[zenStyles.habitRow, done && zenStyles.habitDone]}
                onPress={() => handleToggle(h.id!)}
              >
                <View style={[zenStyles.check, done && zenStyles.checkDone]}>
                  {done && <Text style={zenStyles.checkMark}>✓</Text>}
                </View>
                <Text style={zenStyles.habitIcon}>{h.icon}</Text>
                <Text style={[zenStyles.habitTitle, done && zenStyles.habitTitleDone]}>
                  {h.title}
                </Text>
              </Pressable>
            );
          })}
        </>
      )}

      {/* Journal prompt */}
      <SectionHeader title="REFLECTION" />
      <Panel>
        <Text style={zenStyles.label}>TODAY'S REFLECTION</Text>
        <TextInput
          value={journalText}
          onChangeText={(t) => { setJournalText(t); setJournalSaved(false); }}
          placeholder="What happened today? What are you grateful for?"
          placeholderTextColor={colors.textMuted}
          style={zenStyles.journal}
          multiline
        />
        <Pressable
          style={[zenStyles.saveBtn, journalSaved && zenStyles.saveBtnDone]}
          onPress={handleSaveJournal}
        >
          <Text style={zenStyles.saveBtnText}>
            {journalSaved ? "SAVED ✓" : "SAVE"}
          </Text>
        </Pressable>
      </Panel>
    </>
  );
}

const zenStyles = StyleSheet.create({
  label: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.sm },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: radius.sm,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, fontSize: 15, minHeight: 60,
    textAlignVertical: "top",
  },
  habitRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: radius.md,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  habitDone: { backgroundColor: colors.successDim, borderColor: colors.success + "30" },
  check: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { fontSize: 13, color: "#000", fontWeight: "700" },
  habitIcon: { fontSize: 18 },
  habitTitle: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.text },
  habitTitleDone: { color: colors.textMuted },
  journal: {
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: radius.sm,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, fontSize: 15, minHeight: 100,
    textAlignVertical: "top", marginBottom: spacing.md,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingVertical: spacing.sm, alignItems: "center",
  },
  saveBtnDone: { backgroundColor: colors.successDim, borderColor: colors.success },
  saveBtnText: { ...fonts.kicker, fontSize: 10, color: "#000" },
});

// ─── Skill Tree Section ───────────────────────────────────────────────────────

function SkillTreeSection() {
  const router = useRouter();
  const unlockedNodes = useSkillTreeStore((s) => s.unlockedNodes);
  const getProgress = useSkillTreeStore((s) => s.getProgress);
  const getNextUnlockable = useSkillTreeStore((s) => s.getNextUnlockable);

  return (
    <>
      <SectionHeader title="SKILL TREES" />
      <View style={stStyles.grid}>
        {ENGINES.map((engine, i) => {
          const { unlocked, total } = getProgress(engine);
          const next = getNextUnlockable(engine);
          const color = ENGINE_COLORS[engine];
          const pct = total > 0 ? unlocked / total : 0;

          return (
            <Panel
              key={engine}
              onPress={() => router.push(`/skill-tree/${engine}`)}
              style={stStyles.card}
              delay={i * 60 + 200}
            >
              {/* Engine label + progress count */}
              <View style={stStyles.cardHeader}>
                <Text style={[stStyles.engineLabel, { color }]}>
                  {ENGINE_LABELS[engine]}
                </Text>
                <Text style={stStyles.progressCount}>
                  {unlocked}/{total}
                </Text>
              </View>

              {/* Progress bar */}
              <View style={stStyles.track}>
                <View
                  style={[
                    stStyles.fill,
                    { width: `${pct * 100}%` as any, backgroundColor: color },
                  ]}
                />
              </View>

              {/* Next unlockable */}
              <Text style={stStyles.nextLabel} numberOfLines={1}>
                {next
                  ? `Next: ${next.name}`
                  : "All nodes unlocked"}
              </Text>
              {next && (
                <Text style={stStyles.nextCondition} numberOfLines={1}>
                  {next.conditionText}
                </Text>
              )}
            </Panel>
          );
        })}
      </View>
    </>
  );
}

const stStyles = StyleSheet.create({
  grid: {
    flexDirection: "row", flexWrap: "wrap", gap: spacing.sm,
    marginBottom: spacing.md,
  },
  card: {
    width: "47.5%",
    flexGrow: 0, flexShrink: 0,
  },
  cardHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: spacing.sm,
  },
  engineLabel: { ...fonts.kicker, fontSize: 10, letterSpacing: 1.5 },
  progressCount: { ...fonts.mono, fontSize: 12, fontWeight: "700", color: colors.text },
  track: {
    height: 3, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2, marginBottom: spacing.sm, overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 2 },
  nextLabel: { fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 2 },
  nextCondition: { ...fonts.kicker, fontSize: 8, color: colors.textMuted },
});

// ─── HQScreen ─────────────────────────────────────────────────────────────────

export default function HQScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const today = getTodayKey();

  // AppState listener for midnight crossing
  const [appActive, setAppActive] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setAppActive((c) => c + 1);
    });
    return () => sub.remove();
  }, []);

  const analytics = useAnalyticsData();

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

  // Mode + Protocol
  const mode = useModeStore((s) => s.mode);
  const identity = useModeStore((s) => s.identity);
  const checkFeatureVisible = useModeStore((s) => s.checkFeatureVisible);
  const protocolCompleted = useProtocolStore((s) => s.isCompletedToday(today));
  const protocolSession = useProtocolStore((s) => s.getSession(today));

  const tasks = useMemo(
    () => selectAllTasksForDate(storeTasks, storeCompletions, analytics.today),
    [storeTasks, storeCompletions, analytics.today]
  );
  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAllEngines(analytics.today);
    loadProfile();
    setRefreshing(false);
  }, [analytics.today]);

  const handleToggle = useCallback((task: TaskWithStatus) => {
    const completed = toggleTask(task.engine, task.id!, analytics.today);
    const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
    if (completed) {
      awardXP(analytics.today, "task_complete", xp);
      updateStreak(analytics.today);
    } else {
      awardXP(analytics.today, "task_uncomplete", -xp);
    }
  }, [analytics.today, toggleTask, awardXP, updateStreak]);

  // ─── Suggested Missions ─────────────────────────────────────────────────────
  const [dismissed, setDismissed] = useState<Set<string>>(
    () => new Set(getJSON<string[]>(DISMISSED_KEY, []))
  );

  const suggestions = useMemo(() => {
    const existingTitles = new Set(tasks.map((t) => t.title.toLowerCase()));
    return SUGGESTION_POOL.filter(
      (m) => !dismissed.has(m.id) && !existingTitles.has(m.title.toLowerCase())
    ).slice(0, 3);
  }, [tasks, dismissed]);

  const handleDismissSuggestion = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set([...prev, id]);
      setJSON(DISMISSED_KEY, [...next]);
      return next;
    });
  }, []);

  const handleAddSuggestion = useCallback((mission: SuggestedMission) => {
    useEngineStore.getState().addTask(
      mission.engine, mission.title,
      mission.type === "mission" ? "main" : "secondary"
    );
    const xp = mission.type === "mission" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
    awardXP(analytics.today, "suggestion_accepted", xp);
    setDismissed((prev) => {
      const next = new Set([...prev, mission.id]);
      setJSON(DISMISSED_KEY, [...next]);
      return next;
    });
    useEngineStore.getState().loadEngine(mission.engine, analytics.today);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [analytics.today, awardXP]);

  // ─── Zen mode — render only intention/habits/journal ─────────────────────
  if (mode === "zen") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <HUDBackground />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <PageHeader kicker="TITAN PROTOCOL" title="ZEN MODE" subtitle="Calm clarity. No scores." />
          <ZenDashboard dateKey={today} />
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Full Protocol + Tracker modes ───────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HUDBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.text]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Header */}
        <PageHeader kicker="TITAN PROTOCOL" title="TITAN OS" subtitle="Your performance operating system — four engines, one view." />

        {/* ① Protocol Card — FULL PROTOCOL only, hero position */}
        {checkFeatureVisible("protocol_card") && (
          <ProtocolCard
            completed={protocolCompleted}
            score={protocolSession?.titanScore ?? analytics.titanScore}
            identity={identity ? IDENTITY_LABELS[identity] : null}
            onStart={() => router.push("/protocol")}
          />
        )}

        {/* ② XP Bar + Streak — full_protocol only */}
        {checkFeatureVisible("xp_streak") && (
          <View style={styles.xpWrap}>
            <XPBar xp={profileXp} level={profileLevel} />
            <StreakBadge streak={profileStreak} />
          </View>
        )}

        {/* ③ Titan Score panel */}
        {checkFeatureVisible("titan_score") && (
          <Panel hero style={styles.titanScorePanel} delay={0}>
            <View style={styles.titanScoreRow}>
              <View style={styles.titanScoreLeft}>
                <Text style={styles.titanScoreLabel}>TITAN SCORE</Text>
                <Text style={styles.titanScoreSub}>
                  {analytics.activeEngines}/4 engines active today
                </Text>
              </View>
              <ScoreGauge score={analytics.titanScore} size={120} label="TODAY" />
            </View>
            <View style={styles.engineBars}>
              {ENGINES.map((engine) => (
                <Pressable
                  key={engine}
                  style={styles.engineBarRow}
                  onPress={() => router.push(`/engine/${engine}`)}
                >
                  <Text style={[styles.engineBarLabel, { color: ENGINE_COLORS[engine] }]}>
                    {ENGINE_LABELS[engine]}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <TitanProgress value={analytics.engineScores[engine]} color={ENGINE_COLORS[engine]} height={5} />
                  </View>
                  <Text style={styles.engineBarValue}>
                    {analytics.engineScores[engine].toFixed(1)}%
                  </Text>
                </Pressable>
              ))}
            </View>
          </Panel>
        )}

        {/* Radar + Week Comparison */}
        {checkFeatureVisible("radar") && (
          <Panel style={styles.radarPanel} delay={80}>
            <Text style={styles.radarLabel}>ENGINE OVERVIEW</Text>
            <RadarChart scores={analytics.engineScores} size={240} />
          </Panel>
        )}
        {checkFeatureVisible("week_comparison") && (
          <WeekComparison thisWeek={analytics.thisWeekEngines} lastWeek={analytics.lastWeek} />
        )}

        {/* ④ Today's Missions */}
        {checkFeatureVisible("missions") && (
          <>
            <SectionHeader title="TODAY'S MISSIONS" right={`${completedCount}/${tasks.length}`} />
            {tasks.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🎯</Text>
                <Text style={styles.emptyText}>No missions yet</Text>
                <Text style={styles.emptyHint}>Go to an engine and add your first mission</Text>
              </View>
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
          </>
        )}

        {/* ⑤ Suggested Missions — full_protocol only */}
        {checkFeatureVisible("suggested_missions") && suggestions.length > 0 && (
          <>
            <SectionHeader title="SUGGESTED MISSIONS" />
            {suggestions.map((m) => (
              <SuggestionRow
                key={m.id}
                mission={m}
                onAdd={handleAddSuggestion}
                onDismiss={handleDismissSuggestion}
              />
            ))}
          </>
        )}

        {/* ⑦ Engine Sparklines */}
        {checkFeatureVisible("engine_sparklines") && (
          <>
            <SectionHeader title="ENGINES" />
            <View style={styles.sparkGrid}>
              {ENGINES.map((engine, i) => {
                const cardW = (screenWidth - spacing.lg * 2 - spacing.sm) / 2;
                const chartW = cardW - 40;
                return (
                  <Panel
                    key={engine}
                    onPress={() => router.push(`/engine/${engine}`)}
                    style={{ ...styles.sparkCard, width: cardW }}
                    delay={i * 60 + 160}
                  >
                    <View style={styles.sparkHeader}>
                      <Text style={[styles.sparkLabel, { color: ENGINE_COLORS[engine] }]}>
                        {ENGINE_LABELS[engine]}
                      </Text>
                      <Text style={styles.sparkValue}>{analytics.engineScores[engine]}%</Text>
                    </View>
                    <SparklineChart data={analytics.sparklineData[engine]} width={Math.max(chartW, 60)} height={36} color={ENGINE_COLORS[engine]} />
                    <Text style={styles.sparkSub}>Today: {analytics.engineScores[engine]}%</Text>
                  </Panel>
                );
              })}
            </View>
          </>
        )}

        {/* Weekly Summary — tracker only */}
        {checkFeatureVisible("weekly_summary") && (
          <WeeklySummary
            avgScore={analytics.thisWeek.avgScore}
            tasksCompleted={analytics.thisWeek.tasksCompleted}
            bestDayScore={analytics.thisWeek.bestDayScore}
            bestDayDate={analytics.thisWeek.bestDayDate}
          />
        )}

        {/* ⑧ Skill Trees — full_protocol only */}
        {checkFeatureVisible("skill_trees") && (
          <SkillTreeSection />
        )}

        {/* ⑨ Activity Heatmap */}
        {checkFeatureVisible("activity_heatmap") && (
          <>
            <SectionHeader title="ACTIVITY" />
            <Panel delay={300}>
              <HeatmapGrid data={analytics.heatmapData} />
            </Panel>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
      <FloatingActionButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  xpWrap: { marginTop: spacing.lg, marginBottom: spacing.md, gap: spacing.sm },

  // Titan Score panel
  titanScorePanel: { marginTop: spacing.md },
  titanScoreRow: { flexDirection: "row", alignItems: "center" },
  titanScoreLeft: { flex: 1 },
  titanScoreLabel: { ...fonts.kicker, fontSize: 9, color: colors.textMuted },
  titanScoreSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // Radar
  radarPanel: { marginTop: spacing.sm, alignItems: "center" },
  radarLabel: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.sm },

  // Engine bars inside titan score
  engineBars: { marginTop: spacing.md, gap: spacing.sm },
  engineBarRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  engineBarLabel: { ...fonts.kicker, fontSize: 9, width: 60, flexShrink: 0 },
  engineBarValue: { ...fonts.mono, fontSize: 11, color: colors.textSecondary, width: 42, textAlign: "right" },

  // Sparklines
  sparkGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sparkCard: { flexGrow: 0, flexShrink: 0 },
  sparkHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  sparkLabel: { ...fonts.kicker, fontSize: 10, letterSpacing: 1.5 },
  sparkValue: { ...fonts.mono, fontSize: 16, fontWeight: "800", color: colors.text },
  sparkSub: { ...fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: spacing.xs },

  // Empty state
  empty: { alignItems: "center", paddingVertical: spacing["4xl"] },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 18, fontWeight: "600", color: colors.text },
  emptyHint: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
});
