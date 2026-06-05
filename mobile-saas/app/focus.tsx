import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ScreenHeader } from "../src/components/ui/ScreenHeader";
import { Panel } from "../src/components/ui/Panel";
import { ProgressRing } from "../src/components/ui/ProgressRing";
import { EditorSheet } from "../src/components/ui/EditorSheet";
import { FieldInput } from "../src/components/ui/FieldInput";
import {
  useFocusSessions,
  useFocusSettings,
  useUpsertFocusSettings,
  useRecordFocusSession,
} from "../src/hooks/queries/useFocus";
import { useCreateDeepWorkSession } from "../src/hooks/queries/useDeepWork";
import type { EngineKey } from "../src/db/schema";
import { getTodayKey } from "../src/lib/date";
import { logError } from "../src/lib/error-log";

import { colors, fonts, radius, spacing } from "../src/theme";

type Phase = "focus" | "break" | "long";

const ENGINE_OPTIONS: { key: EngineKey; label: string; color: string }[] = [
  { key: "body", label: "BODY", color: colors.body },
  { key: "mind", label: "MIND", color: colors.mind },
  { key: "money", label: "MONEY", color: colors.money },
  { key: "charisma", label: "GEN.", color: colors.charisma },
];

const PHASES: { key: Phase; label: string }[] = [
  { key: "focus", label: "FOCUS" },
  { key: "break", label: "BREAK" },
  { key: "long", label: "LONG BREAK" },
];

function formatTimer(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function FocusScreen() {
  const today = getTodayKey();

  const { data: settings } = useFocusSettings();
  const { data: sessions } = useFocusSessions();
  const upsertSettings = useUpsertFocusSettings();
  const recordFocus = useRecordFocusSession();
  const createDeepWork = useCreateDeepWorkSession();

  const focusMin = settings?.pomodoro_minutes ?? 25;
  const breakMin = settings?.break_minutes ?? 5;
  const longMin = settings?.long_break_minutes ?? 15;
  const longAfter = settings?.long_break_after ?? 4;
  const dailyTarget = settings?.daily_target_sessions ?? 4;

  const [phase, setPhase] = useState<Phase>("focus");
  const [engine, setEngine] = useState<EngineKey>("mind");
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Settings draft (strings for the numeric inputs)
  const [draftFocus, setDraftFocus] = useState("25");
  const [draftBreak, setDraftBreak] = useState("5");
  const [draftLong, setDraftLong] = useState("15");
  const [draftTarget, setDraftTarget] = useState("4");

  const focusSinceLong = useRef(0);

  const targetMinutes = phase === "focus" ? focusMin : phase === "break" ? breakMin : longMin;
  const targetMs = targetMinutes * 60 * 1000;

  const startAtRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => setNow(Date.now()), 250);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [running]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => sub.remove();
  }, []);

  const elapsedMs = startAtRef.current == null ? 0 : Math.min(targetMs, now - startAtRef.current);
  const remainingMs = Math.max(0, targetMs - elapsedMs);
  const progress = targetMs > 0 ? elapsedMs / targetMs : 0;

  const phaseColor =
    phase === "focus"
      ? ENGINE_OPTIONS.find((e) => e.key === engine)?.color ?? colors.accent
      : phase === "break"
        ? colors.charisma
        : colors.mind;

  const completePhase = useCallback(async () => {
    setRunning(false);
    startAtRef.current = null;

    if (phase === "focus") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        // Dual-log: focus_sessions (web parity + daily target) AND deep_work
        // (engine-tagged analytics that other screens read).
        await Promise.all([
          recordFocus.mutateAsync({ date_key: today, duration_minutes: focusMin, category: engine }),
          createDeepWork.mutateAsync({
            task_name: `${ENGINE_OPTIONS.find((e) => e.key === engine)?.label ?? "FOCUS"} focus session`,
            date_key: today,
            minutes: focusMin,
            category: engine,
          }),
        ]);
      } catch (e) {
        logError("focus.complete", e);
      }
      focusSinceLong.current += 1;
      if (focusSinceLong.current >= longAfter) {
        focusSinceLong.current = 0;
        setPhase("long");
      } else {
        setPhase("break");
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhase("focus");
    }
  }, [phase, engine, focusMin, longAfter, today, recordFocus, createDeepWork]);

  useEffect(() => {
    if (!running) return;
    if (remainingMs > 0) return;
    void completePhase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, remainingMs]);

  const handleStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startAtRef.current = Date.now();
    setNow(Date.now());
    setRunning(true);
  }, []);

  const handleStop = useCallback(() => {
    Alert.alert("Stop timer?", "This session won't be logged.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setRunning(false);
          startAtRef.current = null;
          setNow(Date.now());
        },
      },
    ]);
  }, []);

  const switchPhase = useCallback(
    (next: Phase) => {
      if (running) return;
      Haptics.selectionAsync();
      setPhase(next);
    },
    [running],
  );

  const openSettings = useCallback(() => {
    setDraftFocus(String(focusMin));
    setDraftBreak(String(breakMin));
    setDraftLong(String(longMin));
    setDraftTarget(String(dailyTarget));
    setSettingsOpen(true);
  }, [focusMin, breakMin, longMin, dailyTarget]);

  const saveSettings = useCallback(async () => {
    const clamp = (s: string, def: number) => {
      const n = parseInt(s, 10);
      return Number.isFinite(n) && n > 0 ? Math.min(180, n) : def;
    };
    try {
      await upsertSettings.mutateAsync({
        pomodoro_minutes: clamp(draftFocus, 25),
        break_minutes: clamp(draftBreak, 5),
        long_break_minutes: clamp(draftLong, 15),
        daily_target_sessions: clamp(draftTarget, 4),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSettingsOpen(false);
    } catch (e) {
      logError("focus.settings.save", e);
      Alert.alert("Save failed", "Could not save settings.");
    }
  }, [draftFocus, draftBreak, draftLong, draftTarget, upsertSettings]);

  const { todayCount, todayMinutes } = useMemo(() => {
    const list = (sessions ?? []).filter((s) => s.date_key === today && s.completed);
    const minutes = list.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
    return { todayCount: list.length, todayMinutes: minutes };
  }, [sessions, today]);

  const phaseLabel = PHASES.find((p) => p.key === phase)?.label ?? "FOCUS";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          kicker="Deep Work"
          title="Focus"
          subtitle={`${phaseLabel} · ${todayCount}/${dailyTarget} sessions today`}
          rightSlot={
            <Pressable onPress={openSettings} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Ionicons name="settings-outline" size={20} color={colors.text} />
            </Pressable>
          }
        />

        {/* Phase tabs */}
        <View style={styles.phaseRow}>
          {PHASES.map((p) => {
            const active = phase === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => switchPhase(p.key)}
                disabled={running}
                style={({ pressed }) => [
                  styles.phasePill,
                  active && styles.phasePillActive,
                  pressed && !running && styles.pressed,
                  running && !active && styles.buttonDisabled,
                ]}
              >
                <Text style={[styles.phaseText, active && { color: colors.text }]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Timer */}
        <Panel tone="hero" style={styles.timerPanel}>
          <View style={styles.ringWrap}>
            <ProgressRing progress={progress} label="" size={220} strokeWidth={8} color={phaseColor} />
            <View style={styles.timerOverlay} pointerEvents="none">
              <Text style={styles.timerText}>{formatTimer(remainingMs)}</Text>
              <Text style={styles.timerSub}>{running ? "RUNNING" : phaseLabel}</Text>
            </View>
          </View>

          <Pressable
            onPress={running ? handleStop : handleStart}
            style={({ pressed }) => [
              styles.primaryButton,
              running && styles.primaryButtonStop,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.primaryButtonText, running && { color: colors.text }]}>
              {running ? "STOP" : "START"}
            </Text>
          </Pressable>
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
                  <Text style={[styles.engineButtonText, active && { color: e.color }]}>{e.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Today */}
        <Panel style={styles.todayPanel}>
          <Text style={styles.fieldLabel}>TODAY</Text>
          <Text style={styles.todayText}>
            {todayCount} of {dailyTarget} sessions ·{" "}
            {Math.floor(todayMinutes / 60) > 0
              ? `${Math.floor(todayMinutes / 60)}h ${todayMinutes % 60}m`
              : `${todayMinutes}m`}{" "}
            focused
          </Text>
        </Panel>

        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>

      <EditorSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Focus Settings"
        primaryLabel="SAVE"
        onPrimary={saveSettings}
        primaryBusy={upsertSettings.isPending}
      >
        <FieldInput label="FOCUS (MIN)" value={draftFocus} onChangeText={setDraftFocus} keyboardType="number-pad" maxLength={3} />
        <FieldInput label="BREAK (MIN)" value={draftBreak} onChangeText={setDraftBreak} keyboardType="number-pad" maxLength={3} />
        <FieldInput label="LONG BREAK (MIN)" value={draftLong} onChangeText={setDraftLong} keyboardType="number-pad" maxLength={3} />
        <FieldInput label="DAILY TARGET (SESSIONS)" value={draftTarget} onChangeText={setDraftTarget} keyboardType="number-pad" maxLength={2} />
      </EditorSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },
  pressed: { opacity: 0.7 },
  buttonDisabled: { opacity: 0.45 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  phaseRow: { flexDirection: "row", gap: spacing.xs },
  phasePill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  phasePillActive: { backgroundColor: colors.surfaceBorderStrong, borderColor: colors.cardBorderActive },
  phaseText: { ...fonts.kicker, color: colors.textMuted, fontSize: 10, letterSpacing: 1.5 },

  timerPanel: { padding: spacing.lg, gap: spacing.lg, alignItems: "center" },
  ringWrap: { alignItems: "center", justifyContent: "center" },
  timerOverlay: { position: "absolute", alignItems: "center", justifyContent: "center" },
  timerText: {
    ...fonts.monoLarge,
    fontSize: 52,
    fontWeight: "300",
    letterSpacing: -1,
    color: colors.text,
  },
  timerSub: { ...fonts.kicker, color: colors.textMuted, fontSize: 11, letterSpacing: 2, marginTop: spacing.xs },
  primaryButton: {
    width: "100%",
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryButtonStop: { backgroundColor: colors.dangerDim, borderWidth: 1, borderColor: colors.danger },
  primaryButtonText: { ...fonts.kicker, color: colors.bg, fontSize: 13, letterSpacing: 2 },

  field: { gap: spacing.xs },
  fieldLabel: { ...fonts.kicker, color: colors.textMuted, fontSize: 10, letterSpacing: 1.5 },
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
  engineButtonText: { ...fonts.kicker, color: colors.textMuted, fontSize: 11, letterSpacing: 1.5 },

  todayPanel: { gap: spacing.xs },
  todayText: { ...fonts.body, color: colors.text, fontSize: 14 },
});
