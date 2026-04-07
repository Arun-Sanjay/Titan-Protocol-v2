import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  FadeIn, FadeInDown,
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, cancelAnimation, Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { titanColors } from "../../../theme/colors";
import { getJSON, setJSON } from "../../../db/storage";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { useIdentityStore, IDENTITIES } from "../../../stores/useIdentityStore";
import { IDENTITY_LABELS } from "../../../stores/useModeStore";
import { useEngineStore, ENGINES, selectAllTasksForDate } from "../../../stores/useEngineStore";
import { useProfileStore } from "../../../stores/useProfileStore";
import { useHabitStore } from "../../../stores/useHabitStore";
import { getDailyRank } from "../../../db/gamification";
import { getTodayKey } from "../../../lib/date";
import { getCurrentChapter, getDayNumber } from "../../../data/chapters";
import { getLatestNarrative, getStoryForDay } from "../../../lib/narrative-engine";
import { generateDailyOperation, type DailyOperation } from "../../../lib/operation-engine";
import { useStoryStore } from "../../../stores/useStoryStore";
import { useProtocolStore } from "../../../stores/useProtocolStore";
import { checkIntegrityStatus, getIntegrityColor } from "../../../lib/protocol-integrity";
import {
  playSequence,
  stopCurrentAudio,
  getDailyGreetingId,
  getOperationVoiceId,
} from "../../../lib/protocol-audio";

const ARCHETYPE_ICONS: Record<string, string> = {
  titan: "\u26A1", athlete: "\uD83D\uDCAA", scholar: "\uD83D\uDCDA", hustler: "\uD83D\uDCB0",
  showman: "\uD83C\uDFA4", warrior: "\u2694\uFE0F", founder: "\uD83D\uDE80", charmer: "\u2728",
};

const ENGINE_COLORS: Record<string, string> = {
  body: colors.body, mind: colors.mind, money: colors.money, charisma: colors.charisma,
};

type Props = {
  onEnter: () => void;
};

export function isBriefingSeenToday(): boolean {
  const key = `briefing_seen_${getTodayKey()}`;
  return getJSON<boolean>(key, false);
}

export function markBriefingSeen(): void {
  const key = `briefing_seen_${getTodayKey()}`;
  setJSON(key, true);
}

export function DailyBriefing({ onEnter }: Props) {
  const identity = useOnboardingStore((s) => s.identity);
  const archetype = useIdentityStore((s) => s.archetype);
  const profile = useProfileStore((s) => s.profile);
  const tasks = useEngineStore((s) => s.tasks);
  const completions = useEngineStore((s) => s.completions);
  const scores = useEngineStore((s) => s.scores);
  const habits = useHabitStore((s) => s.habits);
  const loadAllEngines = useEngineStore((s) => s.loadAllEngines);
  const loadProfile = useProfileStore((s) => s.load);

  const today = getTodayKey();
  const firstActiveDate = getJSON<string | null>("first_active_date", null);
  const dayNumber = getDayNumber(firstActiveDate);
  const chapter = getCurrentChapter(dayNumber);
  const isTitan = (archetype ?? identity) === "titan";
  const accentColor = isTitan ? titanColors.accent : colors.primary;

  // Load data on mount
  useEffect(() => {
    loadAllEngines(today);
    loadProfile();
  }, []);

  // Yesterday's data
  const yesterday = useMemo(() => {
    if (dayNumber <= 1) return null;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let totalScore = 0;
    let engineCount = 0;
    for (const e of ENGINES) {
      const s = scores[`${e}:${yk}`];
      if (s !== undefined) {
        totalScore += s;
        engineCount++;
      }
    }
    const avgScore = engineCount > 0 ? Math.round(totalScore / engineCount) : 0;
    const rank = getDailyRank(avgScore);
    return { score: avgScore, rank };
  }, [scores, dayNumber]);

  // Today's missions
  const todayTasks = useMemo(
    () => selectAllTasksForDate(tasks, completions, today),
    [tasks, completions, today],
  );

  // Archetype story for today
  const archetypeStory = getStoryForDay(archetype ?? identity, dayNumber);

  // Engine accent color for the archetype's primary engine
  const storyAccentColor = archetypeStory
    ? ENGINE_COLORS[
        (archetype ?? identity) === "athlete" ? "body"
        : (archetype ?? identity) === "scholar" ? "mind"
        : (archetype ?? identity) === "hustler" || (archetype ?? identity) === "founder" ? "money"
        : (archetype ?? identity) === "showman" || (archetype ?? identity) === "charmer" ? "charisma"
        : "body" // titan/warrior default
      ] ?? accentColor
    : accentColor;

  // Latest narrative
  const narrative = getLatestNarrative();

  // Generate today's operation
  // Use protocol store streak (loaded from MMKV on init, available immediately)
  // instead of profile.streak (requires async loadProfile, defaults to 0 on first render)
  const userName = useStoryStore((s) => s.userName) || "Recruit";
  const storyAct = useStoryStore((s) => s.currentAct);
  const protocolStreak = useProtocolStore((s) => s.streakCurrent);
  const operation = useMemo(
    () => dayNumber > 1
      ? generateDailyOperation(userName, dayNumber, protocolStreak, storyAct)
      : null,
    [dayNumber, userName, protocolStreak, storyAct],
  );

  // Meta
  const meta = IDENTITIES.find((i) => i.id === (archetype ?? identity));

  // Enter button pulse
  const pulse = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
    return () => {
      cancelAnimation(pulse);
    };
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(247, 250, 255, ${pulse.value})`,
  }));

  // Play ElevenLabs voice: daily greeting → operation line (after animations settle)
  useEffect(() => {
    if (!operation) return;
    let cancelled = false;

    const timer = setTimeout(() => {
      if (cancelled) return;
      playSequence([
        { id: getDailyGreetingId(dayNumber), delayAfter: 600 },
        { id: getOperationVoiceId(operation.name) },
      ]).catch(() => {});
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopCurrentAudio();
    };
  }, [operation, dayNumber]);

  const handleEnter = () => {
    stopCurrentAudio();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    markBriefingSeen();
    onEnter();
  };

  return (
    <View style={styles.container}>
      {/* Day + Chapter */}
      <Animated.View entering={FadeIn.delay(200).duration(600)} style={styles.top}>
        <Text style={[styles.dayNumber, { color: accentColor }]}>DAY {dayNumber}</Text>
        <Text style={styles.chapterBadge}>
          CHAPTER {chapter.number}: {chapter.name.toUpperCase()}
        </Text>
      </Animated.View>

      {/* Archetype */}
      <Animated.View entering={FadeInDown.delay(500).duration(400)} style={styles.identity}>
        <Text style={styles.identityIcon}>
          {ARCHETYPE_ICONS[(archetype ?? identity) ?? "titan"] ?? "\u26A1"}
        </Text>
        <Text style={styles.identityName}>
          {meta?.name ?? (identity ? IDENTITY_LABELS[identity] : "The Titan")}
        </Text>
      </Animated.View>

      {/* Yesterday's score */}
      <Animated.View entering={FadeInDown.delay(800).duration(400)} style={styles.section}>
        {yesterday ? (
          <View style={styles.yesterdayCard}>
            <Text style={styles.yesterdayLabel}>YESTERDAY</Text>
            <Text style={styles.yesterdayScore}>
              {yesterday.score}% Titan Score {"\u00B7"} Rank {yesterday.rank.letter}
            </Text>
          </View>
        ) : (
          <View style={styles.yesterdayCard}>
            <Text style={styles.yesterdayLabel}>WELCOME</Text>
            <Text style={styles.yesterdayScore}>Your first day begins.</Text>
          </View>
        )}
      </Animated.View>

      {/* Archetype Story */}
      {archetypeStory && (
        <Animated.View entering={FadeInDown.delay(1000).duration(500)}>
          <Text style={[styles.archetypeStory, { color: storyAccentColor }]}>
            {archetypeStory.text}
          </Text>
        </Animated.View>
      )}

      {/* Narrative */}
      {narrative && (
        <Animated.View entering={FadeInDown.delay(archetypeStory ? 1300 : 1100).duration(400)}>
          <Text style={styles.narrative} numberOfLines={2}>
            {narrative.text}
          </Text>
        </Animated.View>
      )}

      {/* Today's Operation */}
      {/* Protocol Integrity Warning */}
      {(() => {
        const integrity = checkIntegrityStatus();
        if (integrity.warning) {
          return (
            <Animated.View entering={FadeInDown.delay(1200).duration(400)} style={styles.section}>
              <View style={{
                borderWidth: 1,
                borderColor: integrity.status === "RESET" ? colors.danger + "60" : colors.warning + "60",
                backgroundColor: integrity.status === "RESET" ? colors.dangerDim : colors.warningDim,
                borderRadius: radius.md,
                padding: spacing.md,
              }}>
                <Text style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  fontWeight: "700",
                  letterSpacing: 2,
                  color: integrity.status === "RESET" ? colors.danger : colors.warning,
                  marginBottom: 4,
                }}>
                  {integrity.status === "WARNING" ? "INTEGRITY WARNING" : integrity.status === "BREACH" ? "INTEGRITY BREACH" : "PROTOCOL RESET"}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
                  {integrity.warning}
                </Text>
              </View>
            </Animated.View>
          );
        }
        return null;
      })()}

      {operation && (
        <Animated.View entering={FadeInDown.delay(1400).duration(500)} style={styles.section}>
          <Text style={styles.operationKicker}>TODAY'S OPERATION</Text>
          <Text style={styles.operationName}>{operation.displayName}</Text>
          <Text style={styles.operationSubtitle}>{operation.subtitle}</Text>
          <Text style={styles.operationMessage}>{operation.protocolMessage}</Text>
          <View style={styles.operationStats}>
            <Text style={styles.operationStat}>{operation.taskCount} TASKS</Text>
            <Text style={styles.operationStatDivider}>{"\u00B7"}</Text>
            <Text style={styles.operationStat}>{operation.consistencyRate}% CONSISTENCY</Text>
          </View>
        </Animated.View>
      )}

      {/* Today preview */}
      <Animated.View entering={FadeInDown.delay(operation ? 1800 : 1400).duration(400)} style={styles.section}>
        <Text style={styles.previewLabel}>TODAY</Text>
        <Text style={styles.previewText}>
          {todayTasks.length} missions loaded {"\u00B7"} {habits.length} habits active
        </Text>

        {/* Engine dots */}
        <View style={styles.engineRow}>
          {ENGINES.map((e) => (
            <View key={e} style={styles.engineItem}>
              <View style={[styles.engineDot, { backgroundColor: ENGINE_COLORS[e] }]} />
              <Text style={styles.engineName}>{e.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Chapter theme */}
      <Animated.View entering={FadeInDown.delay(1700).duration(400)}>
        <Text style={styles.theme}>"{chapter.theme}"</Text>
      </Animated.View>

      {/* Enter button */}
      <Animated.View entering={FadeIn.delay(2000).duration(400)} style={styles.bottomArea}>
        <Animated.View style={[styles.enterBtnWrap, pulseStyle]}>
          <Pressable style={styles.enterBtn} onPress={handleEnter}>
            <Text style={styles.enterBtnText}>ENTER</Text>
          </Pressable>
        </Animated.View>

        <Pressable onPress={handleEnter} hitSlop={12}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    zIndex: 150,
  },
  top: { alignItems: "center", marginBottom: spacing.xl },
  dayNumber: {
    fontSize: 48, fontWeight: "800", letterSpacing: 3,
    marginBottom: spacing.xs,
  },
  chapterBadge: {
    ...fonts.kicker, fontSize: 10, color: colors.textMuted,
    letterSpacing: 3,
  },
  identity: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginBottom: spacing.xl,
  },
  identityIcon: { fontSize: 28 },
  identityName: { fontSize: 16, fontWeight: "600", color: colors.text },
  section: { marginBottom: spacing.lg, width: "100%" },
  yesterdayCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.md, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: spacing.md, alignItems: "center",
  },
  yesterdayLabel: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.xs },
  yesterdayScore: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },
  archetypeStory: {
    fontSize: 15, fontStyle: "italic", fontWeight: "500",
    textAlign: "center", lineHeight: 22, marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  narrative: {
    fontSize: 13, fontStyle: "italic", color: colors.textMuted,
    textAlign: "center", lineHeight: 20, marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  previewLabel: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.xs, textAlign: "center" },
  previewText: { fontSize: 13, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.md },
  engineRow: {
    flexDirection: "row", justifyContent: "center", gap: spacing.lg,
  },
  engineItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  engineDot: { width: 6, height: 6, borderRadius: 3 },
  engineName: { ...fonts.kicker, fontSize: 8, color: colors.textMuted },
  theme: {
    fontSize: 12, fontStyle: "italic", color: colors.textSecondary,
    textAlign: "center", marginBottom: spacing.xl,
  },
  bottomArea: { position: "absolute", bottom: 60, left: spacing.xl, right: spacing.xl, alignItems: "center" },
  enterBtnWrap: {
    borderRadius: radius.md, borderWidth: 1.5,
    overflow: "hidden", width: "100%", marginBottom: spacing.md,
  },
  enterBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md - 2,
    paddingVertical: spacing.lg, alignItems: "center",
  },
  enterBtnText: { ...fonts.kicker, fontSize: 15, color: "#000", letterSpacing: 3 },
  skipText: { fontSize: 12, color: colors.textMuted },

  // Operation display
  operationKicker: {
    ...fonts.kicker, fontSize: 9, color: colors.textMuted,
    letterSpacing: 3, marginBottom: spacing.xs,
  },
  operationName: {
    fontSize: 22, fontWeight: "800", color: colors.text,
    letterSpacing: 2, marginBottom: 4,
  },
  operationSubtitle: {
    fontSize: 12, color: colors.textSecondary, marginBottom: spacing.md,
    fontStyle: "italic",
  },
  operationMessage: {
    fontSize: 13, color: colors.textSecondary, lineHeight: 20,
    textAlign: "center", marginBottom: spacing.md,
  },
  operationStats: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    justifyContent: "center",
  },
  operationStat: {
    ...fonts.kicker, fontSize: 10, color: colors.textMuted, letterSpacing: 2,
  },
  operationStatDivider: { fontSize: 10, color: colors.textMuted },
});
