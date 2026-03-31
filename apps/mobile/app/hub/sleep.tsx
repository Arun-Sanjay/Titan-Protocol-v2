import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  AppState,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import Animated, { FadeInDown, FadeInRight, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { MetricValue } from "../../src/components/ui/MetricValue";
import { SparklineChart } from "../../src/components/ui/SparklineChart";
import { getTodayKey, addDays, formatDateShort, getDayOfWeek } from "../../src/lib/date";
import {
  useSleepStore,
  computeDurationMinutes,
  computeSleepScore,
  computeSleepDebt,
  getSleepStats,
  getSleepConsistency,
  minutesToTime,
  getDurationColor,
  type SleepEntry,
  type SleepScore,
} from "../../src/stores/useSleepStore";

// ─── Constants ──────────────────────────────────────────────────────────────

const MONO_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
const SCORE_RING_SIZE = 140;
const SCORE_STROKE = 10;
const SCORE_RADIUS = (SCORE_RING_SIZE - SCORE_STROKE) / 2;
const SCORE_CIRCUMFERENCE = 2 * Math.PI * SCORE_RADIUS;

// Timeline constants — 8pm to 12pm (16 hour window)
const TIMELINE_START = 20 * 60; // 20:00 = 1200 min
const TIMELINE_END = 12 * 60; // 12:00 next day = 720 + 1440 = "32 hours"
const TIMELINE_SPAN = 16 * 60; // 16 hours window

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function qualityLabel(q: number): string {
  switch (q) {
    case 1: return "Poor";
    case 2: return "Fair";
    case 3: return "Good";
    case 4: return "Great";
    case 5: return "Excellent";
    default: return "";
  }
}

function scoreGradeColor(grade: SleepScore["grade"]): string {
  switch (grade) {
    case "S": return colors.body;
    case "A": return colors.success;
    case "B": return colors.charisma;
    case "C": return colors.warning;
    case "D": return "#F97316";
    case "F": return colors.danger;
  }
}

function durationBarColor(minutes: number): string {
  const cat = getDurationColor(minutes);
  if (cat === "good") return colors.body;
  if (cat === "ok") return colors.warning;
  return colors.danger;
}

function timeToTimelinePosition(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  let totalMin = h * 60 + m;
  // Normalize to timeline window (20:00 start)
  // Bedtimes 12:00-19:59 clamp to timeline start; wake times past 12:00 clamp to end
  if (totalMin >= 720 && totalMin < TIMELINE_START) {
    // Between noon and 8pm — clamp to start (0) for bedtime, end (1) for wake
    return 0;
  }
  if (totalMin < TIMELINE_START) totalMin += 1440; // next day (0:00-11:59 → add 24h)
  const offset = totalMin - TIMELINE_START;
  return Math.max(0, Math.min(1, offset / TIMELINE_SPAN));
}

// ─── Score Ring Component ────────────────────────────────────────────────────

const ScoreRing = React.memo(function ScoreRing({
  score,
  grade,
}: {
  score: number;
  grade: SleepScore["grade"];
}) {
  const pct = Math.min(score / 100, 1);
  const offset = SCORE_CIRCUMFERENCE * (1 - pct);
  const gradeColor = scoreGradeColor(grade);

  return (
    <View style={styles.ringWrap}>
      <Svg width={SCORE_RING_SIZE} height={SCORE_RING_SIZE}>
        {/* Background ring */}
        <Circle
          cx={SCORE_RING_SIZE / 2}
          cy={SCORE_RING_SIZE / 2}
          r={SCORE_RADIUS}
          stroke={colors.surfaceBorder}
          strokeWidth={SCORE_STROKE}
          fill="none"
        />
        {/* Score ring */}
        <Circle
          cx={SCORE_RING_SIZE / 2}
          cy={SCORE_RING_SIZE / 2}
          r={SCORE_RADIUS}
          stroke={gradeColor}
          strokeWidth={SCORE_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={SCORE_CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SCORE_RING_SIZE / 2} ${SCORE_RING_SIZE / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringScore, { color: gradeColor }]}>{score}</Text>
        <Text style={styles.ringGrade}>{grade}</Text>
      </View>
    </View>
  );
});

// ─── Sleep Timeline Bar ──────────────────────────────────────────────────────

const SleepTimeline = React.memo(function SleepTimeline({
  bedtime,
  wakeTime,
  width,
}: {
  bedtime: string;
  wakeTime: string;
  width: number;
}) {
  const barWidth = width - 40; // padding
  const bedPos = timeToTimelinePosition(bedtime);
  const wakePos = timeToTimelinePosition(wakeTime);
  const barLeft = bedPos * barWidth;
  const barRight = wakePos * barWidth;
  const sleepWidth = Math.max(2, barRight - barLeft);

  // Time markers: 8pm, 12am, 4am, 8am, 12pm
  const markers = [
    { label: "8pm", pos: 0 },
    { label: "12am", pos: 4 / 16 },
    { label: "4am", pos: 8 / 16 },
    { label: "8am", pos: 12 / 16 },
    { label: "12pm", pos: 1 },
  ];

  // Ideal zone: 10pm-6am
  const idealStart = (2 / 16); // 10pm = 2h from 8pm
  const idealEnd = (10 / 16); // 6am = 10h from 8pm

  return (
    <View style={styles.timelineContainer}>
      <View style={[styles.timelineTrack, { width: barWidth }]}>
        {/* Ideal zone */}
        <View
          style={[
            styles.timelineIdeal,
            {
              left: idealStart * barWidth,
              width: (idealEnd - idealStart) * barWidth,
            },
          ]}
        />
        {/* Sleep bar */}
        <Animated.View
          entering={FadeInRight.duration(600)}
          style={[
            styles.timelineSleep,
            {
              left: barLeft,
              width: sleepWidth,
            },
          ]}
        />
        {/* Bed/wake markers */}
        <View style={[styles.timelineMarker, { left: barLeft - 1 }]}>
          <View style={[styles.markerDot, { backgroundColor: colors.mind }]} />
        </View>
        <View style={[styles.timelineMarker, { left: barLeft + sleepWidth - 1 }]}>
          <View style={[styles.markerDot, { backgroundColor: colors.warning }]} />
        </View>
      </View>
      {/* Time labels */}
      <View style={[styles.timelineLabels, { width: barWidth }]}>
        {markers.map((m) => (
          <Text
            key={m.label}
            style={[styles.timelineLabel, { left: m.pos * barWidth - 14 }]}
          >
            {m.label}
          </Text>
        ))}
      </View>
    </View>
  );
});

// ─── Score Breakdown Component ───────────────────────────────────────────────

const ScoreBreakdown = React.memo(function ScoreBreakdown({
  sleepScore,
}: {
  sleepScore: SleepScore;
}) {
  const items = [
    { label: "Duration", score: sleepScore.durationScore, max: 40, color: colors.body },
    { label: "Quality", score: sleepScore.qualityScore, max: 30, color: colors.mind },
    { label: "Consistency", score: sleepScore.consistencyScore, max: 30, color: colors.charisma },
  ];

  return (
    <View style={styles.breakdownContainer}>
      {items.map((item) => {
        const pct = item.max > 0 ? item.score / item.max : 0;
        return (
          <View key={item.label} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{item.label}</Text>
            <View style={styles.breakdownBarTrack}>
              <View
                style={[
                  styles.breakdownBarFill,
                  { width: `${pct * 100}%`, backgroundColor: item.color },
                ]}
              />
            </View>
            <Text style={[styles.breakdownValue, { color: item.color }]}>
              {item.score}/{item.max}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

// ─── Week Bar Chart ──────────────────────────────────────────────────────────

const WeekBarChart = React.memo(function WeekBarChart({
  entries,
  todayKey,
}: {
  entries: SleepEntry[];
  todayKey: string;
}) {
  // Build 7-day array (oldest to newest)
  const days = useMemo(() => {
    const result: { key: string; dayLabel: string; entry: SleepEntry | null }[] = [];
    for (let i = 6; i >= 0; i--) {
      const key = addDays(todayKey, -i);
      const entry = entries.find((e) => e.dateKey === key) ?? null;
      result.push({
        key,
        dayLabel: getDayOfWeek(key).charAt(0),
        entry,
      });
    }
    return result;
  }, [entries, todayKey]);

  const maxDuration = 600; // 10h max for bar height

  return (
    <View style={styles.weekChart}>
      {days.map((day, i) => {
        const height = day.entry
          ? Math.max(4, (day.entry.durationMinutes / maxDuration) * 80)
          : 4;
        const barColor = day.entry
          ? durationBarColor(day.entry.durationMinutes)
          : colors.surfaceBorder;
        const isToday = day.key === todayKey;

        return (
          <View key={day.key} style={styles.weekBarCol}>
            <View style={styles.weekBarContainer}>
              {day.entry && (
                <Text style={styles.weekBarValue}>
                  {Math.round(day.entry.durationMinutes / 60)}h
                </Text>
              )}
              <Animated.View
                entering={FadeInDown.delay(i * 60).duration(400)}
                style={[
                  styles.weekBar,
                  {
                    height,
                    backgroundColor: barColor,
                    opacity: day.entry ? 1 : 0.3,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.weekBarDay,
                isToday && { color: colors.text, fontWeight: "700" },
              ]}
            >
              {day.dayLabel}
            </Text>
            {/* Quality dots */}
            {day.entry && (
              <View style={styles.qualityDotsRow}>
                {[1, 2, 3, 4, 5].map((q) => (
                  <View
                    key={q}
                    style={[
                      styles.qualityMiniDot,
                      {
                        backgroundColor:
                          q <= day.entry!.quality
                            ? colors.warning
                            : colors.surfaceBorder,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
});

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function SleepScreen() {
  const router = useRouter();
  const { width: SCREEN_WIDTH } = useWindowDimensions();

  // AppState listener to refresh todayKey past midnight
  const [appActive, setAppActive] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setAppActive((c) => c + 1);
    });
    return () => sub.remove();
  }, []);
  const todayKey = useMemo(() => getTodayKey(), [appActive]);

  const entries = useSleepStore((s) => s.entries);
  const loadEntry = useSleepStore((s) => s.loadEntry);
  const addEntry = useSleepStore((s) => s.addEntry);
  const deleteEntry = useSleepStore((s) => s.deleteEntry);

  // Form state
  const [bedtime, setBedtime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [notes, setNotes] = useState("");
  const [showForm, setShowForm] = useState(false);

  // How many days of history to show
  const [historyDays, setHistoryDays] = useState(7);

  // Load entries for stats + visible history
  useEffect(() => {
    const daysToLoad = Math.max(historyDays, 14); // always load 14 for stats
    for (let i = 0; i <= daysToLoad; i++) {
      loadEntry(addDays(todayKey, -i));
    }
  }, [todayKey, loadEntry, historyDays]);

  const todayEntry = entries[todayKey] ?? null;

  // Build sorted entries array for stats
  const allEntries = useMemo(() => {
    const result: SleepEntry[] = [];
    for (let i = 0; i <= 14; i++) {
      const key = addDays(todayKey, -i);
      const entry = entries[key];
      if (entry) result.push(entry);
    }
    return result.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [entries, todayKey]);

  // 7-day entries for the week chart (today + 6 previous days = 7 total)
  const weekEntries = useMemo(() => {
    const result: SleepEntry[] = [];
    for (let i = 0; i < 7; i++) {
      const key = addDays(todayKey, -i);
      const entry = entries[key];
      if (entry) result.push(entry);
    }
    return result;
  }, [entries, todayKey]);

  // History (excluding today) — shows up to historyDays
  const history = useMemo(() => {
    const result: SleepEntry[] = [];
    for (let i = 1; i <= historyDays; i++) {
      const key = addDays(todayKey, -i);
      const entry = entries[key];
      if (entry) result.push(entry);
    }
    return result;
  }, [entries, todayKey, historyDays]);

  // Sleep consistency (needs 3+ entries)
  const consistency = useMemo(
    () => getSleepConsistency(allEntries),
    [allEntries],
  );

  // Today's sleep score
  const todaySleepScore = useMemo(() => {
    if (!todayEntry) return null;
    return computeSleepScore(todayEntry, consistency);
  }, [todayEntry, consistency]);

  // Weekly stats
  const weekStats = useMemo(() => getSleepStats(weekEntries), [weekEntries]);

  // Sleep debt
  const sleepDebt = useMemo(
    () => computeSleepDebt(allEntries),
    [allEntries],
  );

  // Sparkline data: last 14 entries duration normalized
  const sparkData = useMemo(() => {
    if (allEntries.length < 2) return [];
    return allEntries.map((e) => Math.min(100, (e.durationMinutes / 600) * 100));
  }, [allEntries]);

  const handleSave = useCallback(() => {
    if (!bedtime || !wakeTime) return;

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(bedtime) || !timeRegex.test(wakeTime)) return;

    const durationMinutes = computeDurationMinutes(bedtime, wakeTime);
    if (durationMinutes === 0) {
      Alert.alert("Invalid", "Bedtime and wake time cannot be the same.");
      return;
    }
    if (durationMinutes < 15) {
      Alert.alert("Too Short", "Sleep must be at least 15 minutes.");
      return;
    }
    if (durationMinutes > 960) {
      Alert.alert("Too Long", "Sleep cannot exceed 16 hours.");
      return;
    }

    addEntry({
      dateKey: todayKey,
      bedtime,
      wakeTime,
      durationMinutes,
      quality,
      notes: notes.trim(),
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowForm(false);
    setBedtime("");
    setWakeTime("");
    setQuality(3);
    setNotes("");
  }, [bedtime, wakeTime, quality, notes, todayKey, addEntry]);

  const handleDelete = useCallback(
    (dateKey: string) => {
      Alert.alert("Delete Entry", "Remove this sleep entry?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteEntry(dateKey);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]);
    },
    [deleteEntry],
  );

  const previewDuration = useMemo(() => {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(bedtime) || !timeRegex.test(wakeTime)) return null;
    return computeDurationMinutes(bedtime, wakeTime);
  }, [bedtime, wakeTime]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Sleep Tracker</Text>
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Sleep Score Hero ── */}
          {todayEntry && todaySleepScore ? (
            <>
              <SectionHeader title="Last Night" />
              <Panel tone="hero" delay={0}>
                <View style={styles.heroRow}>
                  <ScoreRing
                    score={todaySleepScore.overall}
                    grade={todaySleepScore.grade}
                  />
                  <View style={styles.heroStats}>
                    <View style={styles.heroStatItem}>
                      <Ionicons name="moon-outline" size={16} color={colors.mind} />
                      <Text style={styles.heroStatValue}>{todayEntry.bedtime}</Text>
                      <Text style={styles.heroStatLabel}>Bedtime</Text>
                    </View>
                    <View style={styles.heroStatItem}>
                      <Ionicons name="sunny-outline" size={16} color={colors.warning} />
                      <Text style={styles.heroStatValue}>{todayEntry.wakeTime}</Text>
                      <Text style={styles.heroStatLabel}>Wake</Text>
                    </View>
                    <View style={styles.heroStatItem}>
                      <Ionicons name="time-outline" size={16} color={colors.body} />
                      <Text style={styles.heroStatValue}>
                        {formatDuration(todayEntry.durationMinutes)}
                      </Text>
                      <Text style={styles.heroStatLabel}>Duration</Text>
                    </View>
                  </View>
                </View>

                {/* Quality stars */}
                <View style={styles.qualityRow}>
                  <Text style={styles.qualityLabel}>Quality</Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Ionicons
                        key={i}
                        name={i <= todayEntry.quality ? "star" : "star-outline"}
                        size={16}
                        color={
                          i <= todayEntry.quality ? colors.warning : colors.textMuted
                        }
                      />
                    ))}
                  </View>
                  <Text style={styles.qualityText}>{qualityLabel(todayEntry.quality)}</Text>
                </View>

                {/* Sleep Timeline */}
                <SleepTimeline
                  bedtime={todayEntry.bedtime}
                  wakeTime={todayEntry.wakeTime}
                  width={SCREEN_WIDTH - spacing.lg * 2 - 40}
                />

                {/* Score Breakdown */}
                <ScoreBreakdown sleepScore={todaySleepScore} />

                {todayEntry.notes.length > 0 && (
                  <Text style={styles.notesText}>{todayEntry.notes}</Text>
                )}
              </Panel>
            </>
          ) : (
            <>
              <SectionHeader title="Last Night" />
              <Panel
                delay={0}
                onPress={() => {
                  setShowForm(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View style={styles.promptRow}>
                  <View style={styles.promptIconWrap}>
                    <Ionicons name="moon-outline" size={28} color={colors.mind} />
                  </View>
                  <View style={{ marginLeft: spacing.md, flex: 1 }}>
                    <Text style={styles.promptTitle}>Log tonight's sleep</Text>
                    <Text style={styles.promptSub}>
                      Tap to record bedtime, wake time, and quality
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
              </Panel>
            </>
          )}

          {/* ── Log Form ── */}
          {showForm && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <SectionHeader title="Log Sleep" />
              <Panel>
                {/* Bedtime */}
                <Text style={styles.fieldLabel}>Bedtime</Text>
                <TextInput
                  style={styles.input}
                  placeholder="22:30"
                  placeholderTextColor={colors.textMuted}
                  value={bedtime}
                  onChangeText={setBedtime}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />

                {/* Wake Time */}
                <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
                  Wake Time
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="06:30"
                  placeholderTextColor={colors.textMuted}
                  value={wakeTime}
                  onChangeText={setWakeTime}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />

                {/* Duration preview */}
                {previewDuration !== null && (
                  <Text
                    style={[
                      styles.durationPreview,
                      {
                        color:
                          previewDuration === 0
                            ? colors.danger
                            : durationBarColor(previewDuration),
                      },
                    ]}
                  >
                    {previewDuration === 0
                      ? "Bedtime and wake time cannot be the same"
                      : formatDuration(previewDuration)}
                  </Text>
                )}

                {/* Quality */}
                <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
                  Quality
                </Text>
                <View style={styles.qualitySelector}>
                  {([1, 2, 3, 4, 5] as const).map((q) => (
                    <Pressable
                      key={q}
                      onPress={() => {
                        setQuality(q);
                        Haptics.selectionAsync();
                      }}
                      style={[
                        styles.qualityDot,
                        q === quality && styles.qualityDotActive,
                      ]}
                    >
                      <Ionicons
                        name={q <= quality ? "star" : "star-outline"}
                        size={22}
                        color={q <= quality ? colors.warning : colors.textMuted}
                      />
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.qualityHint}>{qualityLabel(quality)}</Text>

                {/* Notes */}
                <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  placeholder="How did you sleep?"
                  placeholderTextColor={colors.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                {/* Actions */}
                <View style={styles.formActions}>
                  <Pressable
                    style={styles.cancelFormBtn}
                    onPress={() => {
                      setShowForm(false);
                      setBedtime("");
                      setWakeTime("");
                      setQuality(3);
                      setNotes("");
                    }}
                  >
                    <Text style={styles.cancelFormText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.saveBtn,
                      { flex: 1 },
                      (!bedtime || !wakeTime || !previewDuration) && styles.saveBtnDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={!bedtime || !wakeTime || !previewDuration}
                  >
                    <Text style={styles.saveBtnText}>Save</Text>
                  </Pressable>
                </View>
              </Panel>
            </Animated.View>
          )}

          {/* Toggle form button if today already logged */}
          {todayEntry && !showForm && (
            <Pressable
              style={styles.editBtn}
              onPress={() => {
                setBedtime(todayEntry.bedtime);
                setWakeTime(todayEntry.wakeTime);
                setQuality(todayEntry.quality);
                setNotes(todayEntry.notes);
                setShowForm(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.editBtnText}>Edit Entry</Text>
            </Pressable>
          )}

          {/* ── 7-Day Chart ── */}
          <SectionHeader title="This Week" right={`${weekEntries.length} nights`} />
          <Panel delay={100}>
            <WeekBarChart entries={weekEntries} todayKey={todayKey} />
          </Panel>

          {/* ── Weekly Stats ── */}
          <View style={styles.statsGrid}>
            <Panel style={styles.statCard} delay={200}>
              <Ionicons name="time-outline" size={18} color={colors.body} />
              <MetricValue
                label="Avg Duration"
                value={weekStats.avgDuration > 0 ? formatDuration(weekStats.avgDuration) : "--"}
                size="sm"
                color={colors.body}
              />
            </Panel>
            <Panel style={styles.statCard} delay={250}>
              <Ionicons name="star-outline" size={18} color={colors.warning} />
              <MetricValue
                label="Avg Quality"
                value={weekStats.avgQuality > 0 ? `${weekStats.avgQuality}` : "--"}
                size="sm"
                color={colors.warning}
              />
            </Panel>
          </View>

          {/* ── Consistency & Sleep Debt ── */}
          <View style={styles.statsGrid}>
            {consistency && (
              <Panel style={styles.statCard} delay={300}>
                <Ionicons name="analytics-outline" size={18} color={colors.charisma} />
                <MetricValue
                  label="Consistency"
                  value={`${consistency.score}%`}
                  size="sm"
                  color={colors.charisma}
                />
                <Text style={styles.trendBadge}>
                  {consistency.trend === "improving"
                    ? "Improving"
                    : consistency.trend === "declining"
                      ? "Declining"
                      : "Stable"}
                </Text>
              </Panel>
            )}
            {sleepDebt.weekDebtMinutes > 0 && (
              <Panel style={!consistency ? { ...styles.statCard, flex: 1 } : styles.statCard} delay={350}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <MetricValue
                  label="Sleep Debt (7d)"
                  value={formatDuration(sleepDebt.weekDebtMinutes)}
                  size="sm"
                  color={colors.danger}
                />
              </Panel>
            )}
          </View>

          {/* ── Average Schedule ── */}
          {consistency && (
            <>
              <SectionHeader title="Average Schedule" />
              <Panel delay={400}>
                <View style={styles.scheduleRow}>
                  <View style={styles.scheduleItem}>
                    <Ionicons name="moon-outline" size={16} color={colors.mind} />
                    <Text style={styles.scheduleTime}>
                      {minutesToTime(consistency.avgBedtimeMinutes)}
                    </Text>
                    <Text style={styles.scheduleLabel}>Avg Bedtime</Text>
                    <Text style={styles.scheduleStdDev}>
                      {"\u00B1"}{consistency.bedtimeStdDev}m
                    </Text>
                  </View>
                  <View style={styles.scheduleDivider} />
                  <View style={styles.scheduleItem}>
                    <Ionicons name="sunny-outline" size={16} color={colors.warning} />
                    <Text style={styles.scheduleTime}>
                      {minutesToTime(consistency.avgWakeTimeMinutes)}
                    </Text>
                    <Text style={styles.scheduleLabel}>Avg Wake</Text>
                    <Text style={styles.scheduleStdDev}>
                      {"\u00B1"}{consistency.wakeStdDev}m
                    </Text>
                  </View>
                </View>
              </Panel>
            </>
          )}

          {/* ── Trend Sparkline ── */}
          {sparkData.length >= 2 && (
            <>
              <SectionHeader title="Duration Trend" right={`${allEntries.length} nights`} />
              <Panel delay={450} style={styles.sparkPanel}>
                <SparklineChart
                  data={sparkData}
                  width={SCREEN_WIDTH - spacing.lg * 2 - 40}
                  height={60}
                  color={colors.mind}
                />
              </Panel>
            </>
          )}

          {/* ── History ── */}
          <SectionHeader title="Recent Nights" right={`${history.length} entries`} />
          {history.length === 0 ? (
            <Panel delay={500}>
              <Text style={styles.emptyText}>No sleep data yet</Text>
              <Text style={styles.emptySub}>Start logging to see your history</Text>
            </Panel>
          ) : (
            history.map((entry, i) => {
              const barWidth = Math.min((entry.durationMinutes / 600) * 100, 100);
              const entryScore = computeSleepScore(entry, consistency);

              return (
                <Panel key={entry.dateKey} style={styles.historyCard} delay={500 + i * 50}>
                  <View style={styles.historyTop}>
                    <View>
                      <Text style={styles.historyDate}>
                        {getDayOfWeek(entry.dateKey)}{" "}
                        {formatDateShort(entry.dateKey)}
                      </Text>
                      <Text style={styles.historyTimes}>
                        {entry.bedtime} - {entry.wakeTime}
                      </Text>
                    </View>
                    <View style={styles.historyRight}>
                      <View style={styles.historyScoreBadge}>
                        <Text
                          style={[
                            styles.historyScoreText,
                            { color: scoreGradeColor(entryScore.grade) },
                          ]}
                        >
                          {entryScore.overall}
                        </Text>
                      </View>
                      <Text style={styles.historyDuration}>
                        {formatDuration(entry.durationMinutes)}
                      </Text>
                      <View style={styles.miniStars}>
                        {[1, 2, 3, 4, 5].map((q) => (
                          <Ionicons
                            key={q}
                            name={q <= entry.quality ? "star" : "star-outline"}
                            size={10}
                            color={
                              q <= entry.quality ? colors.warning : colors.textMuted
                            }
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                  {/* Duration bar */}
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${barWidth}%`,
                          backgroundColor: durationBarColor(entry.durationMinutes),
                        },
                      ]}
                    />
                  </View>
                  {/* Delete button */}
                  <Pressable
                    onPress={() => handleDelete(entry.dateKey)}
                    style={styles.historyDeleteBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={14} color={colors.danger} />
                  </Pressable>
                </Panel>
              );
            })
          )}

          {/* Show More / Show Less */}
          {history.length > 0 && (
            <Pressable
              style={styles.showMoreBtn}
              onPress={() => {
                if (historyDays >= 90) {
                  setHistoryDays(7);
                } else {
                  setHistoryDays((d) => Math.min(d + 30, 90));
                }
                Haptics.selectionAsync();
              }}
            >
              <Ionicons
                name={historyDays >= 90 ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.showMoreText}>
                {historyDays >= 90 ? "Show Less" : "Show More"}
              </Text>
            </Pressable>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  bodyContent: { paddingBottom: spacing["5xl"] },

  // Hero row
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  heroStats: { flex: 1, gap: spacing.md },
  heroStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  heroStatValue: {
    fontFamily: MONO_FONT,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  heroStatLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Score ring
  ringWrap: {
    width: SCORE_RING_SIZE,
    height: SCORE_RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
  },
  ringScore: {
    fontFamily: MONO_FONT,
    fontSize: 28,
    fontWeight: "800",
  },
  ringGrade: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginTop: 2,
  },

  // Quality
  qualityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
  },
  qualityLabel: {
    ...fonts.kicker,
    color: colors.textMuted,
  },
  starsRow: { flexDirection: "row", gap: 2 },
  qualityText: { fontSize: 13, color: colors.textSecondary },
  notesText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontStyle: "italic",
  },

  // Timeline
  timelineContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
  },
  timelineTrack: {
    height: 20,
    backgroundColor: colors.surfaceBorder,
    borderRadius: radius.full,
    overflow: "hidden",
    position: "relative",
    alignSelf: "center",
  },
  timelineIdeal: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 255, 136, 0.06)",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(0, 255, 136, 0.15)",
  },
  timelineSleep: {
    position: "absolute",
    top: 2,
    bottom: 2,
    backgroundColor: colors.mind,
    borderRadius: radius.full,
    opacity: 0.8,
  },
  timelineMarker: {
    position: "absolute",
    top: -4,
    width: 2,
    height: 28,
    alignItems: "center",
  },
  markerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: -1,
  },
  timelineLabels: {
    position: "relative",
    height: 16,
    marginTop: spacing.xs,
    alignSelf: "center",
  },
  timelineLabel: {
    position: "absolute",
    fontSize: 9,
    color: colors.textMuted,
    width: 28,
    textAlign: "center",
  },

  // Score breakdown
  breakdownContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
    gap: spacing.sm,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  breakdownLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    width: 80,
  },
  breakdownBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: colors.surfaceBorder,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  breakdownBarFill: {
    height: 4,
    borderRadius: radius.full,
  },
  breakdownValue: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    fontWeight: "700",
    width: 36,
    textAlign: "right",
  },

  // Prompt (no entry)
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  promptIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.mindDim,
    alignItems: "center",
    justifyContent: "center",
  },
  promptTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  promptSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  // Form
  fieldLabel: {
    ...fonts.kicker,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    fontFamily: MONO_FONT,
  },
  notesInput: {
    minHeight: 80,
    fontFamily: undefined,
    fontSize: 14,
  },
  durationPreview: {
    fontFamily: MONO_FONT,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: spacing.sm,
  },
  qualitySelector: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
  },
  qualityDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  qualityDotActive: {
    borderColor: colors.warning,
    backgroundColor: "rgba(251, 191, 36, 0.10)",
  },
  qualityHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  formActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  cancelFormBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelFormText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  saveBtn: {
    backgroundColor: colors.mind,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },

  // Edit
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  editBtnText: { fontSize: 14, color: colors.textSecondary },

  // Week chart
  weekChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: spacing.md,
  },
  weekBarCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  weekBarContainer: {
    height: 100,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  weekBar: {
    width: 24,
    borderRadius: 6,
    minHeight: 4,
  },
  weekBarValue: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 4,
  },
  weekBarDay: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textMuted,
  },
  qualityDotsRow: {
    flexDirection: "row",
    gap: 2,
  },
  qualityMiniDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // Stats grid
  statsGrid: { flexDirection: "row", gap: spacing.md },
  statCard: { flex: 1, alignItems: "center", gap: spacing.xs },
  trendBadge: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Schedule
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scheduleItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  scheduleTime: {
    fontFamily: MONO_FONT,
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  scheduleLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  scheduleStdDev: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    color: colors.textMuted,
  },
  scheduleDivider: {
    width: 1,
    height: 48,
    backgroundColor: colors.panelBorder,
  },

  // Sparkline
  sparkPanel: { alignItems: "center", paddingVertical: spacing.lg },

  // History
  historyCard: { marginBottom: spacing.sm },
  historyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  historyDate: { fontSize: 14, fontWeight: "600", color: colors.text },
  historyTimes: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  historyRight: { alignItems: "flex-end", gap: 2 },
  historyScoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceBorder,
  },
  historyScoreText: {
    fontFamily: MONO_FONT,
    fontSize: 12,
    fontWeight: "700",
  },
  historyDuration: { ...fonts.mono, fontSize: 14 },
  miniStars: { flexDirection: "row", gap: 1 },
  barTrack: {
    height: 6,
    backgroundColor: colors.surfaceBorder,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  barFill: {
    height: 6,
    borderRadius: radius.full,
  },
  historyDeleteBtn: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  // Show more
  showMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  // Empty
  emptyText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
