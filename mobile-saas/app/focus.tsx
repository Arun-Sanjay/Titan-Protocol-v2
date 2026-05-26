import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ProgressRing } from "../src/components/ui/ProgressRing";
import { Panel } from "../src/components/ui/Panel";
import { useCreateDeepWorkSession, useDeepWorkSessions } from "../src/hooks/queries/useDeepWork";
import type { EngineKey } from "../src/db/schema";
import { getTodayKey } from "../src/lib/date";
import { logError } from "../src/lib/error-log";

import { colors, fonts, radius, spacing } from "../src/theme";

type DurationKey = 25 | 50 | 90 | "custom";

const ENGINE_OPTIONS: { key: EngineKey; label: string; color: string }[] = [
  { key: "body", label: "BODY", color: colors.body },
  { key: "mind", label: "MIND", color: colors.mind },
  { key: "money", label: "MONEY", color: colors.money },
  { key: "charisma", label: "GEN.", color: colors.charisma },
];

const DURATIONS: { key: DurationKey; label: string; minutes: number }[] = [
  { key: 25, label: "25", minutes: 25 },
  { key: 50, label: "50", minutes: 50 },
  { key: 90, label: "90", minutes: 90 },
];

function formatTimer(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function FocusScreen() {
  const router = useRouter();
  const today = getTodayKey();

  const { data: sessions } = useDeepWorkSessions();
  const createSession = useCreateDeepWorkSession();

  const [engine, setEngine] = useState<EngineKey>("mind");
  const [duration, setDuration] = useState<DurationKey>(25);
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState(Date.now());

  const targetMinutes =
    typeof duration === "number" ? duration : 25;
  const targetMs = targetMinutes * 60 * 1000;

  // Anchor timestamps — survives background.
  const startAtRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drive a 1s tick when running.
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [running]);

  // On app foreground, snap `now` to current time so the timer doesn't lag.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => sub.remove();
  }, []);

  const elapsedMs =
    startAtRef.current == null ? 0 : Math.min(targetMs, now - startAtRef.current);
  const remainingMs = Math.max(0, targetMs - elapsedMs);
  const progress = targetMs > 0 ? elapsedMs / targetMs : 0;

  // Detect natural completion.
  useEffect(() => {
    if (!running) return;
    if (remainingMs > 0) return;
    void completeSession(targetMinutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, remainingMs]);

  const completeSession = useCallback(
    async (minutes: number) => {
      setRunning(false);
      startAtRef.current = null;
      try {
        await createSession.mutateAsync({
          task_name: `${ENGINE_OPTIONS.find((e) => e.key === engine)?.label ?? "FOCUS"} focus session`,
          date_key: today,
          minutes,
          category: engine,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        logError("focus.complete", e);
        Alert.alert(
          "Save failed",
          "Session saved locally. We'll push it to the cloud automatically on next reconnect.",
        );
      }
    },
    [createSession, engine, today],
  );

  const handleStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startAtRef.current = Date.now();
    setNow(Date.now());
    setRunning(true);
  }, []);

  const handleReset = useCallback(() => {
    if (!running && startAtRef.current == null) return;
    Alert.alert("Reset timer?", "The current session won't be logged.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setRunning(false);
          startAtRef.current = null;
          setNow(Date.now());
        },
      },
    ]);
  }, [running]);

  // Today's sessions stats.
  const { todayCount, todayMinutes } = useMemo(() => {
    const list = (sessions ?? []).filter((s) => s.date_key === today);
    const minutes = list.reduce((sum, s) => sum + (s.minutes ?? 0), 0);
    return { todayCount: list.length, todayMinutes: minutes };
  }, [sessions, today]);

  const engineMeta = ENGINE_OPTIONS.find((e) => e.key === engine);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>DEEP WORK</Text>
            <Text style={styles.title}>Focus</Text>
          </View>
        </View>

        {/* Timer */}
        <Panel style={styles.timerPanel}>
          <View style={styles.ringWrap}>
            <ProgressRing
              progress={progress}
              label=""
              size={220}
              strokeWidth={8}
              color={engineMeta?.color ?? colors.accent}
            />
            <View style={styles.timerOverlay} pointerEvents="none">
              <Text style={styles.timerText}>{formatTimer(remainingMs)}</Text>
              <Text style={styles.timerSub}>
                {running ? "RUNNING" : "READY"}
              </Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              onPress={running ? handleReset : handleStart}
              style={({ pressed }) => [
                styles.primaryButton,
                running && styles.primaryButtonStop,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {running ? "STOP" : "START"}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleReset}
              disabled={!running && startAtRef.current == null}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
                !running && startAtRef.current == null && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>RESET</Text>
            </Pressable>
          </View>
        </Panel>

        {/* Engine picker */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>SESSION FOR</Text>
          <View style={styles.optionRow}>
            {ENGINE_OPTIONS.map((e) => {
              const active = engine === e.key;
              return (
                <Pressable
                  key={e.key}
                  onPress={() => {
                    if (running) return;
                    Haptics.selectionAsync();
                    setEngine(e.key);
                  }}
                  disabled={running}
                  style={({ pressed }) => [
                    styles.engineButton,
                    active && { borderColor: e.color },
                    pressed && !running && styles.pressed,
                    running && styles.buttonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.engineButtonText,
                      active && { color: e.color },
                    ]}
                  >
                    {e.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Duration picker */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>DURATION (MIN)</Text>
          <View style={styles.optionRow}>
            {DURATIONS.map((d) => {
              const active = duration === d.key;
              return (
                <Pressable
                  key={d.key}
                  onPress={() => {
                    if (running) return;
                    Haptics.selectionAsync();
                    setDuration(d.key);
                  }}
                  disabled={running}
                  style={({ pressed }) => [
                    styles.durationButton,
                    active && styles.durationButtonActive,
                    pressed && !running && styles.pressed,
                    running && styles.buttonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.durationText,
                      active && { color: colors.text },
                    ]}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Today */}
        <View style={styles.todayBlock}>
          <Text style={styles.fieldLabel}>TODAY</Text>
          <Panel style={styles.todayPanel}>
            <Text style={styles.todayText}>
              {todayCount} session{todayCount === 1 ? "" : "s"} ·{" "}
              {Math.floor(todayMinutes / 60) > 0
                ? `${Math.floor(todayMinutes / 60)}h ${todayMinutes % 60}m`
                : `${todayMinutes}m`}
              {" "}total
            </Text>
          </Panel>
        </View>

        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },
  pressed: { opacity: 0.7 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xs },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: { ...fonts.kicker, color: colors.textMuted, letterSpacing: 2 },
  title: { ...fonts.title, fontSize: 28, letterSpacing: -0.5 },

  timerPanel: { padding: spacing.lg, gap: spacing.lg, alignItems: "center" },
  ringWrap: { alignItems: "center", justifyContent: "center" },
  timerOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  timerText: {
    ...fonts.title,
    fontSize: 52,
    letterSpacing: -1,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  timerSub: {
    ...fonts.kicker,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: spacing.xs,
  },
  buttonRow: { flexDirection: "row", gap: spacing.sm, width: "100%" },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryButtonStop: { backgroundColor: colors.danger },
  primaryButtonText: { ...fonts.kicker, color: colors.bg, fontSize: 13, letterSpacing: 2 },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  secondaryButtonText: { ...fonts.kicker, color: colors.text, fontSize: 13, letterSpacing: 2 },
  buttonDisabled: { opacity: 0.45 },

  field: { gap: spacing.xs },
  fieldLabel: {
    ...fonts.kicker,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  optionRow: { flexDirection: "row", gap: spacing.xs },
  engineButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  engineButtonText: {
    ...fonts.kicker,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  durationButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  durationButtonActive: {
    backgroundColor: colors.surfaceBorderStrong,
    borderColor: colors.cardBorderActive,
  },
  durationText: {
    ...fonts.body,
    color: colors.textMuted,
    fontSize: 16,
    fontVariant: ["tabular-nums"],
  },

  todayBlock: { gap: spacing.xs },
  todayPanel: { padding: spacing.md, alignItems: "center" },
  todayText: { ...fonts.body, color: colors.text, fontSize: 14 },
});
