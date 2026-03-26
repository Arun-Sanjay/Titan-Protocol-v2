import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import Animated, { useSharedValue, useAnimatedProps, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, fonts, shadows } from "../../src/theme";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { Card } from "../../src/components/ui/Card";
import { getTodayKey } from "../../src/lib/date";
import { useFocusStore } from "../../src/stores/useFocusStore";
import { useProfileStore, XP_REWARDS } from "../../src/stores/useProfileStore";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Phase = "focus" | "break" | "longBreak";

const PHASE_COLORS: Record<Phase, string> = {
  focus: colors.success,
  break: colors.primary,
  longBreak: colors.mind,
};

export default function FocusTimerScreen() {
  const router = useRouter();
  const dateKey = getTodayKey();

  const settings = useFocusStore((s) => s.settings);
  const loadSettings = useFocusStore((s) => s.loadSettings);
  const loadDaily = useFocusStore((s) => s.loadDaily);
  const completeSession = useFocusStore((s) => s.completeSession);
  const sessions = useFocusStore((s) => s.getSessions(dateKey));
  const awardXP = useProfileStore((s) => s.awardXP);

  const [phase, setPhase] = useState<Phase>("focus");
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(settings.focusMinutes * 60);
  const [cycleCount, setCycleCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadSettings();
    loadDaily(dateKey);
  }, []);

  useEffect(() => {
    setSecondsLeft(getPhaseDuration(phase) * 60);
  }, [phase, settings]);

  const getPhaseDuration = (p: Phase) => {
    switch (p) {
      case "focus": return settings.focusMinutes;
      case "break": return settings.breakMinutes;
      case "longBreak": return settings.longBreakMinutes;
    }
  };

  const totalSeconds = getPhaseDuration(phase) * 60;
  const progress = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(secondsLeft / totalSeconds, { duration: 300 });
  }, [secondsLeft, totalSeconds]);

  const ringSize = 240;
  const strokeWidth = 10;
  const r = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  useEffect(() => {
    if (running && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => s - 1);
      }, 1000);
    } else if (secondsLeft === 0 && running) {
      setRunning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (phase === "focus") {
        completeSession(dateKey);
        awardXP(dateKey, "focus_session", XP_REWARDS.MAIN_TASK);
        const newCycle = cycleCount + 1;
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
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, secondsLeft]);

  const toggleTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRunning(!running);
  };

  const resetTimer = () => {
    setRunning(false);
    setSecondsLeft(getPhaseDuration(phase) * 60);
    Haptics.selectionAsync();
  };

  const skipPhase = () => {
    setRunning(false);
    if (phase === "focus") {
      setPhase("break");
    } else {
      setPhase("focus");
    }
    Haptics.selectionAsync();
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

  const phaseLabel = phase === "focus" ? "FOCUS" : phase === "break" ? "BREAK" : "LONG BREAK";
  const phaseColor = PHASE_COLORS[phase];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Focus Timer</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.phaseLabel, { color: phaseColor }]}>{phaseLabel}</Text>

        <View style={styles.ringWrap}>
          <Svg width={ringSize} height={ringSize}>
            <Circle cx={ringSize / 2} cy={ringSize / 2} r={r} stroke={colors.surfaceBorder} strokeWidth={strokeWidth} fill="none" />
            <AnimatedCircle
              cx={ringSize / 2} cy={ringSize / 2} r={r}
              stroke={phaseColor} strokeWidth={strokeWidth} fill="none"
              strokeLinecap="round" strokeDasharray={circumference}
              animatedProps={animatedProps}
              transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
            />
          </Svg>
          <View style={styles.timerCenter}>
            <Text style={styles.timerText}>{timeStr}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable onPress={resetTimer} style={styles.controlBtn}>
            <Text style={styles.controlText}>Reset</Text>
          </Pressable>
          <Pressable onPress={toggleTimer} style={[styles.mainBtn, { backgroundColor: phaseColor }]}>
            <Text style={styles.mainBtnText}>{running ? "Pause" : "Start"}</Text>
          </Pressable>
          <Pressable onPress={skipPhase} style={styles.controlBtn}>
            <Text style={styles.controlText}>Skip</Text>
          </Pressable>
        </View>

        <SectionHeader title="Today" />
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{sessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{settings.dailyTarget}</Text>
            <Text style={styles.statLabel}>Target</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{Math.round((sessions / Math.max(settings.dailyTarget, 1)) * 100)}%</Text>
            <Text style={styles.statLabel}>Progress</Text>
          </Card>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  backBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 24, color: colors.text },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  phaseLabel: { ...fonts.kicker, textAlign: "center", marginTop: spacing.xl },
  ringWrap: { alignItems: "center", justifyContent: "center", marginVertical: spacing["2xl"] },
  timerCenter: { position: "absolute", alignItems: "center" },
  timerText: { ...fonts.monoLarge },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xl },
  controlBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.panelBorder },
  controlText: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
  mainBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing["3xl"], borderRadius: radius.full },
  mainBtnText: { fontSize: 18, fontWeight: "700", color: "#000" },
  statsRow: { flexDirection: "row", gap: spacing.md },
  statCard: { flex: 1, alignItems: "center" },
  statValue: { ...fonts.monoValue },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
});
