import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  AppState,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  FadeInDown,
  ZoomIn,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { MetricValue } from "../../src/components/ui/MetricValue";
import { getTodayKey, addDays, getDayOfWeek } from "../../src/lib/date";
import { useFocusStore, type FocusSettings } from "../../src/stores/useFocusStore";
import { useProfileStore, XP_REWARDS } from "../../src/stores/useProfileStore";

// ─── Constants ──────────────────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const MONO_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

type Phase = "focus" | "break" | "longBreak";

const PHASE_COLORS: Record<Phase, string> = {
  focus: colors.body,
  break: colors.charisma,
  longBreak: colors.mind,
};

const PHASE_LABELS: Record<Phase, string> = {
  focus: "FOCUS",
  break: "BREAK",
  longBreak: "LONG BREAK",
};

const PHASE_ICONS: Record<Phase, keyof typeof Ionicons.glyphMap> = {
  focus: "flash",
  break: "cafe",
  longBreak: "leaf",
};

const RING_SIZE = 220;
const STROKE_WIDTH = 10;
const RING_R = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

// ─── Week Session Chart ──────────────────────────────────────────────────────

const WeekSessionChart = React.memo(function WeekSessionChart({
  getSessions,
  loadDaily,
  todayKey,
  target,
  revision,
}: {
  getSessions: (dk: string) => number;
  loadDaily: (dk: string) => void;
  todayKey: string;
  target: number;
  revision: number; // bust memo when sessions change
}) {
  // Load 7 days on mount
  useEffect(() => {
    for (let i = 0; i < 7; i++) {
      loadDaily(addDays(todayKey, -i));
    }
  }, [todayKey, loadDaily]);

  const days = useMemo(() => {
    const result: { key: string; label: string; sessions: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const key = addDays(todayKey, -i);
      result.push({
        key,
        label: getDayOfWeek(key).charAt(0),
        sessions: getSessions(key),
      });
    }
    return result;
  }, [todayKey, getSessions, revision]);

  const maxBar = Math.max(target, ...days.map((d) => d.sessions), 1);

  return (
    <View style={chartStyles.container}>
      {days.map((day, i) => {
        const height = Math.max(4, (day.sessions / maxBar) * 70);
        const isToday = day.key === todayKey;
        const hitTarget = day.sessions >= target;

        return (
          <View key={day.key} style={chartStyles.col}>
            <View style={chartStyles.barWrap}>
              {day.sessions > 0 && (
                <Text style={chartStyles.barValue}>{day.sessions}</Text>
              )}
              <Animated.View
                entering={FadeInDown.delay(i * 50).duration(300)}
                style={[
                  chartStyles.bar,
                  {
                    height,
                    backgroundColor: hitTarget
                      ? colors.body
                      : day.sessions > 0
                        ? colors.charisma
                        : colors.surfaceBorder,
                    opacity: day.sessions > 0 ? 1 : 0.3,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                chartStyles.dayLabel,
                isToday && { color: colors.text, fontWeight: "700" },
              ]}
            >
              {day.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

const chartStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: spacing.md,
  },
  col: { flex: 1, alignItems: "center", gap: 4 },
  barWrap: {
    height: 90,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: 24,
    borderRadius: 6,
    minHeight: 4,
  },
  barValue: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 4,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textMuted,
  },
});

// ─── Settings Panel ──────────────────────────────────────────────────────────

function SettingsPanel({
  settings,
  onUpdate,
  onClose,
}: {
  settings: FocusSettings;
  onUpdate: (s: Partial<FocusSettings>) => void;
  onClose: () => void;
}) {
  const [focusMin, setFocusMin] = useState(String(settings.focusMinutes));
  const [breakMin, setBreakMin] = useState(String(settings.breakMinutes));
  const [longBreakMin, setLongBreakMin] = useState(String(settings.longBreakMinutes));
  const [longBreakAfter, setLongBreakAfter] = useState(String(settings.longBreakAfter));
  const [dailyTarget, setDailyTarget] = useState(String(settings.dailyTarget));

  const handleSave = () => {
    const fm = parseInt(focusMin, 10);
    const bm = parseInt(breakMin, 10);
    const lbm = parseInt(longBreakMin, 10);
    const lba = parseInt(longBreakAfter, 10);
    const dt = parseInt(dailyTarget, 10);

    if (isNaN(fm) || fm < 1 || fm > 120) { Alert.alert("Invalid", "Focus: 1-120 min"); return; }
    if (isNaN(bm) || bm < 1 || bm > 60) { Alert.alert("Invalid", "Break: 1-60 min"); return; }
    if (isNaN(lbm) || lbm < 1 || lbm > 60) { Alert.alert("Invalid", "Long Break: 1-60 min"); return; }
    if (isNaN(lba) || lba < 1 || lba > 20) { Alert.alert("Invalid", "Cycles: 1-20"); return; }
    if (isNaN(dt) || dt < 1 || dt > 50) { Alert.alert("Invalid", "Target: 1-50 sessions"); return; }

    onUpdate({
      focusMinutes: fm,
      breakMinutes: bm,
      longBreakMinutes: lbm,
      longBreakAfter: lba,
      dailyTarget: dt,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  const fields = [
    { label: "Focus (min)", value: focusMin, setter: setFocusMin, placeholder: "25" },
    { label: "Break (min)", value: breakMin, setter: setBreakMin, placeholder: "5" },
    { label: "Long Break (min)", value: longBreakMin, setter: setLongBreakMin, placeholder: "15" },
    { label: "Sessions before long break", value: longBreakAfter, setter: setLongBreakAfter, placeholder: "4" },
    { label: "Daily target (sessions)", value: dailyTarget, setter: setDailyTarget, placeholder: "8" },
  ];

  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Panel>
        {fields.map((f, i) => (
          <View key={f.label} style={[settingStyles.row, i > 0 && { marginTop: spacing.md }]}>
            <Text style={settingStyles.label}>{f.label}</Text>
            <TextInput
              style={settingStyles.input}
              value={f.value}
              onChangeText={f.setter}
              keyboardType="number-pad"
              placeholder={f.placeholder}
              placeholderTextColor={colors.textMuted}
              maxLength={3}
            />
          </View>
        ))}
        <View style={settingStyles.actions}>
          <Pressable style={settingStyles.cancelBtn} onPress={onClose}>
            <Text style={settingStyles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={settingStyles.saveBtn} onPress={handleSave}>
            <Text style={settingStyles.saveText}>Save</Text>
          </Pressable>
        </View>
      </Panel>
    </Animated.View>
  );
}

const settingStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: { fontSize: 14, color: colors.textSecondary, flex: 1 },
  input: {
    width: 60,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: MONO_FONT,
    color: colors.text,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  saveBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.body,
    alignItems: "center",
  },
  saveText: { fontSize: 14, fontWeight: "700", color: "#000" },
});

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function FocusTimerScreen() {
  const router = useRouter();

  // AppState refresh + timer resume on foreground
  const [appActive, setAppActive] = useState(0);
  const endTimeRef = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setAppActive((c) => c + 1);
        // Resume timer: recalculate secondsLeft from stored endTime
        if (endTimeRef.current && endTimeRef.current > Date.now()) {
          const remaining = Math.ceil((endTimeRef.current - Date.now()) / 1000);
          setSecondsLeft(Math.max(0, remaining));
        } else if (endTimeRef.current && endTimeRef.current <= Date.now()) {
          // Timer expired while in background
          setSecondsLeft(0);
        }
      }
    });
    return () => sub.remove();
  }, []);
  const dateKey = useMemo(() => getTodayKey(), [appActive]);

  const settings = useFocusStore((s) => s.settings);
  const loadSettings = useFocusStore((s) => s.loadSettings);
  const updateSettings = useFocusStore((s) => s.updateSettings);
  const loadDaily = useFocusStore((s) => s.loadDaily);
  const completeSession = useFocusStore((s) => s.completeSession);
  const getSessions = useFocusStore((s) => s.getSessions);
  const sessions = getSessions(dateKey);
  const awardXP = useProfileStore((s) => s.awardXP);

  const [phase, setPhase] = useState<Phase>("focus");
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(settings.focusMinutes * 60);
  const [cycleCount, setCycleCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showCompleteFlash, setShowCompleteFlash] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs to avoid stale closures in timer effect
  const phaseRef = useRef(phase);
  const cycleCountRef = useRef(cycleCount);
  const dateKeyRef = useRef(dateKey);
  phaseRef.current = phase;
  cycleCountRef.current = cycleCount;
  dateKeyRef.current = dateKey;

  useEffect(() => {
    loadSettings();
    loadDaily(dateKey);
  }, [dateKey, loadSettings, loadDaily]);

  const getPhaseDuration = useCallback(
    (p: Phase) => {
      switch (p) {
        case "focus": return settings.focusMinutes;
        case "break": return settings.breakMinutes;
        case "longBreak": return settings.longBreakMinutes;
      }
    },
    [settings],
  );

  // Only reset seconds when phase changes (not settings while session in progress)
  useEffect(() => {
    if (!sessionStarted) {
      setSecondsLeft(getPhaseDuration(phase) * 60);
    }
  }, [phase, getPhaseDuration, sessionStarted]);

  // Track the duration that was active when the session started
  // so settings changes mid-session don't corrupt the progress ring
  const [sessionDuration, setSessionDuration] = useState(getPhaseDuration(phase) * 60);
  const totalSeconds = sessionStarted ? sessionDuration : getPhaseDuration(phase) * 60;
  const progress = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(totalSeconds > 0 ? secondsLeft / totalSeconds : 0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [secondsLeft, totalSeconds]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  // Stable interval — only start/stop on running change
  useEffect(() => {
    if (running) {
      // Store the end timestamp so we can resume after backgrounding
      endTimeRef.current = Date.now() + secondsLeft * 1000;
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            endTimeRef.current = null;
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      endTimeRef.current = null;
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  // Handle timer completion (secondsLeft hits 0)
  useEffect(() => {
    if (secondsLeft === 0 && running) {
      setRunning(false);
      setSessionStarted(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const currentPhase = phaseRef.current;
      const currentDateKey = dateKeyRef.current;

      if (currentPhase === "focus") {
        completeSession(currentDateKey);
        awardXP(currentDateKey, "focus_session", XP_REWARDS.MAIN_TASK);
        setShowCompleteFlash(true);
        setTimeout(() => setShowCompleteFlash(false), 2000);

        const newCycle = cycleCountRef.current + 1;
        setCycleCount(newCycle);
        if (newCycle % settings.longBreakAfter === 0) {
          setPhase("longBreak");
        } else {
          setPhase("break");
        }
      } else {
        setPhase("focus");
      }
    }
  }, [secondsLeft, running, completeSession, awardXP, settings.longBreakAfter]);

  const toggleTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!running && !sessionStarted) {
      // Only lock duration on FIRST start, not on resume from pause
      setSessionStarted(true);
      setSessionDuration(secondsLeft);
    }
    setRunning(!running);
  };

  const resetTimer = () => {
    setRunning(false);
    setSessionStarted(false);
    setSecondsLeft(getPhaseDuration(phase) * 60);
    Haptics.selectionAsync();
  };

  // Skip does NOT increment cycleCount — only completed sessions count
  const skipPhase = () => {
    setRunning(false);
    setSessionStarted(false);
    if (phase === "focus") {
      setPhase("break"); // always short break when skipping
    } else {
      setPhase("focus");
    }
    Haptics.selectionAsync();
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  const phaseColor = PHASE_COLORS[phase];
  const totalFocusMinutes = sessions * settings.focusMinutes;
  const progressPct = Math.round((sessions / Math.max(settings.dailyTarget, 1)) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Focus Timer</Text>
        <Pressable
          onPress={() => setShowSettings(!showSettings)}
          style={styles.backBtn}
        >
          <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Settings panel */}
        {showSettings && (
          <SettingsPanel
            settings={settings}
            onUpdate={updateSettings}
            onClose={() => setShowSettings(false)}
          />
        )}

        {/* Phase selector */}
        <View style={styles.phasePicker}>
          {(["focus", "break", "longBreak"] as Phase[]).map((p) => (
            <Pressable
              key={p}
              style={[
                styles.phaseTab,
                phase === p && {
                  backgroundColor: PHASE_COLORS[p] + "18",
                  borderColor: PHASE_COLORS[p],
                },
              ]}
              onPress={() => {
                if (!running) {
                  setPhase(p);
                  Haptics.selectionAsync();
                }
              }}
              disabled={running}
            >
              <Ionicons
                name={PHASE_ICONS[p]}
                size={14}
                color={phase === p ? PHASE_COLORS[p] : colors.textMuted}
              />
              <Text
                style={[
                  styles.phaseTabText,
                  phase === p && { color: PHASE_COLORS[p] },
                ]}
              >
                {PHASE_LABELS[p]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Timer Ring */}
        <View style={styles.ringContainer}>
          <View style={styles.ringWrap}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_R}
                stroke={colors.surfaceBorder}
                strokeWidth={STROKE_WIDTH}
                fill="none"
              />
              <AnimatedCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_R}
                stroke={phaseColor}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                animatedProps={animatedProps}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>
            <View style={styles.timerCenter}>
              <Text style={styles.timerText}>{timeStr}</Text>
              <Text style={[styles.phaseLabel, { color: phaseColor }]}>
                {PHASE_LABELS[phase]}
              </Text>
            </View>
          </View>

          {/* Session complete flash */}
          {showCompleteFlash && (
            <Animated.View entering={ZoomIn.duration(400)} style={styles.completeBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.body} />
              <Text style={styles.completeBadgeText}>+{XP_REWARDS.MAIN_TASK} XP</Text>
            </Animated.View>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <Pressable onPress={resetTimer} style={styles.controlBtn}>
            <Ionicons name="refresh" size={20} color={colors.textSecondary} />
            <Text style={styles.controlText}>Reset</Text>
          </Pressable>
          <Pressable
            onPress={toggleTimer}
            style={[styles.mainBtn, { backgroundColor: phaseColor }]}
          >
            <Ionicons
              name={running ? "pause" : "play"}
              size={22}
              color="#000"
            />
            <Text style={styles.mainBtnText}>
              {running ? "Pause" : "Start"}
            </Text>
          </Pressable>
          <Pressable onPress={skipPhase} style={styles.controlBtn}>
            <Ionicons name="play-skip-forward" size={20} color={colors.textSecondary} />
            <Text style={styles.controlText}>Skip</Text>
          </Pressable>
        </View>

        {/* ── Today's Progress ── */}
        <SectionHeader title="Today" />
        <View style={styles.statsGrid}>
          <Panel style={styles.statCard} delay={0}>
            <Ionicons name="checkmark-done" size={18} color={colors.body} />
            <MetricValue
              label="Sessions"
              value={sessions}
              size="sm"
              color={colors.body}
              animated
            />
          </Panel>
          <Panel style={styles.statCard} delay={50}>
            <Ionicons name="timer-outline" size={18} color={colors.mind} />
            <MetricValue
              label="Focus Time"
              value={totalFocusMinutes > 0
                ? totalFocusMinutes >= 60
                  ? `${Math.floor(totalFocusMinutes / 60)}h ${totalFocusMinutes % 60}m`
                  : `${totalFocusMinutes}m`
                : "--"}
              size="sm"
              color={colors.mind}
            />
          </Panel>
          <Panel style={styles.statCard} delay={100}>
            <Ionicons name="trophy-outline" size={18} color={colors.warning} />
            <MetricValue
              label="Progress"
              value={`${Math.min(progressPct, 100)}%`}
              size="sm"
              color={progressPct >= 100 ? colors.body : colors.warning}
            />
          </Panel>
        </View>

        {/* Progress bar */}
        <Panel delay={150}>
          <View style={styles.progressBarRow}>
            <Text style={styles.progressLabel}>
              {sessions} / {settings.dailyTarget} sessions
            </Text>
            <Text style={[styles.progressPct, {
              color: progressPct >= 100 ? colors.body : colors.textSecondary,
            }]}>
              {Math.min(progressPct, 100)}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(progressPct, 100)}%`,
                  backgroundColor: progressPct >= 100 ? colors.body : colors.mind,
                },
              ]}
            />
          </View>
          {/* Cycle indicator */}
          <Text style={styles.cycleText}>
            Cycle {(cycleCount % settings.longBreakAfter) + 1} of {settings.longBreakAfter}
          </Text>
        </Panel>

        {/* ── 7-Day History ── */}
        <SectionHeader title="This Week" />
        <Panel delay={200}>
          <WeekSessionChart
            getSessions={getSessions}
            loadDaily={loadDaily}
            todayKey={dateKey}
            target={settings.dailyTarget}
            revision={sessions}
          />
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.body }]} />
              <Text style={styles.legendText}>Hit target</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.charisma }]} />
              <Text style={styles.legendText}>Active</Text>
            </View>
          </View>
        </Panel>

        <View style={{ height: 60 }} />
      </ScrollView>
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

  // Phase picker
  phasePicker: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  phaseTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  phaseTabText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Ring
  ringContainer: {
    alignItems: "center",
    marginVertical: spacing["2xl"],
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  timerCenter: {
    position: "absolute",
    alignItems: "center",
  },
  timerText: {
    fontFamily: MONO_FONT,
    fontSize: 48,
    fontWeight: "300",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  phaseLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
    marginTop: 4,
  },

  // Complete badge
  completeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.bodyDim,
    marginTop: spacing.md,
  },
  completeBadgeText: {
    fontFamily: MONO_FONT,
    fontSize: 13,
    fontWeight: "700",
    color: colors.body,
  },

  // Controls
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
  },
  controlBtn: {
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  controlText: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
  mainBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing["3xl"],
    borderRadius: radius.full,
  },
  mainBtnText: { fontSize: 18, fontWeight: "700", color: "#000" },

  // Stats
  statsGrid: { flexDirection: "row", gap: spacing.md },
  statCard: { flex: 1, alignItems: "center", gap: spacing.xs },

  // Progress bar
  progressBarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  progressLabel: { fontSize: 13, color: colors.textSecondary },
  progressPct: { fontFamily: MONO_FONT, fontSize: 13, fontWeight: "700" },
  progressTrack: {
    height: 8,
    backgroundColor: colors.surfaceBorder,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: radius.full,
  },
  cycleText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.md,
  },

  // Chart legend
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: colors.textMuted },
});
