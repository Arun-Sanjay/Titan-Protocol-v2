import React, { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { playVoiceLineAsync, stopCurrentAudio } from "../../../lib/protocol-audio";
import { colors, spacing, fonts, radius } from "../../../theme";
import { titanColors } from "../../../theme/colors";
import { getJSON, setJSON } from "../../../db/storage";
import { useStoryStore } from "../../../stores/useStoryStore";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { IDENTITIES } from "../../../stores/useIdentityStore";
import { IDENTITY_LABELS, type IdentityArchetype } from "../../../stores/useModeStore";
import { getStarterMissions } from "../../../data/starter-missions";
import { getTodayKey } from "../../../lib/date";
import { ProtocolTerminal, ProtocolNarration, type TerminalLine, type NarrationLine } from "./ProtocolTerminal";

const FIRST_LAUNCH_KEY = "first_launch_seen";

export function isFirstLaunchSeen(): boolean {
  return getJSON<boolean>(FIRST_LAUNCH_KEY, false);
}

export function markFirstLaunchSeen(): void {
  setJSON(FIRST_LAUNCH_KEY, true);
}

const ENGINE_COLORS: Record<string, string> = {
  body: colors.body, mind: colors.mind, money: colors.money, charisma: colors.charisma,
};
const ENGINE_LABELS: Record<string, string> = {
  body: "BODY", mind: "MIND", money: "MONEY", charisma: "CHARISMA",
};

type Phase = "scan" | "diagnosis" | "declaration" | "initiating" | "briefing" | "mission";

type Props = { onComplete: () => void };

export function FirstLaunchCinematic({ onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const identity = useOnboardingStore((s) => s.identity) ?? "titan";
  const meta = IDENTITIES.find((i) => i.key === identity);
  const archetypeName = meta?.name ?? IDENTITY_LABELS[identity as IdentityArchetype] ?? "THE TITAN";
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);

  const [phase, setPhase] = useState<Phase>("scan");

  // ─── Voice playback per phase ─────────────────────────────────────────────
  useEffect(() => {
    if (phase === "scan") playVoiceLineAsync("CIN-D1-001");
    else if (phase === "declaration") playVoiceLineAsync("CIN-D1-002");
    else if (phase === "briefing") playVoiceLineAsync("CIN-D1-003");
    return () => { void stopCurrentAudio(); };
  }, [phase]);

  // Screen shake for INITIATING
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { translateY: shakeY.value }],
  }));

  // Ring expansion for INITIATING
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0.8);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  // ─── Beat 1: The Scan ─────────────────────────────────────────────────────

  const scanLines: TerminalLine[] = useMemo(() => [
    { text: "PROTOCOL ONLINE", delay: 800, haptic: "medium" },
    { text: "SCANNING SUBJECT...", delay: 600 },
    { text: `SUBJECT IDENTIFIED: ${userName.toUpperCase()}`, delay: 800, haptic: "medium" },
    { text: `CLASSIFICATION: ${archetypeName.toUpperCase()}`, delay: 600, haptic: "heavy" },
  ], [userName, archetypeName]);

  // ─── Beat 2: The Diagnosis ────────────────────────────────────────────────

  const diagnosisLines: TerminalLine[] = useMemo(() => [
    { text: "STATUS REPORT:", delay: 1000, haptic: "medium", bold: true },
    { text: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", delay: 200, haptic: "none" },
    { text: "DISCIPLINE INDEX: CRITICAL", color: "#f87171", delay: 500 },
    { text: "PHYSICAL OUTPUT: MINIMAL", color: "#f87171", delay: 400 },
    { text: "MENTAL ACUITY: DORMANT", color: "#f87171", delay: 400 },
    { text: "FINANCIAL SYSTEMS: INACTIVE", color: "#f87171", delay: 400 },
    { text: "CHARISMA INDEX: UNRANKED", color: "#f87171", delay: 400 },
    { text: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", delay: 200, haptic: "none" },
    { text: "OVERALL ASSESSMENT: NON-OPERATIONAL", color: "#f87171", fontSize: 16, bold: true, delay: 800, haptic: "heavy" },
  ], []);

  // ─── Beat 3: The Declaration ──────────────────────────────────────────────

  const declarationLines: NarrationLine[] = useMemo(() => [
    { text: `${userName.toUpperCase()}.`, fontSize: 20, bold: true, delay: 1500 },
    { text: "YOU HAVE BEEN SELECTED FOR THE TITAN PROTOCOL.", delay: 800 },
    { text: "YOUR CURRENT STATE IS UNACCEPTABLE.", color: "#f87171", bold: true, delay: 1000 },
    { text: "THIS SYSTEM WILL FIX THAT.", delay: 800 },
  ], [userName]);

  // ─── Beat 5: First Briefing ───────────────────────────────────────────────

  const briefingLines: NarrationLine[] = useMemo(() => [
    { text: `${userName}.`, fontSize: 18, bold: true, delay: 500 },
    { text: "Your engines are offline. Your systems are dormant.", delay: 800 },
    { text: "Today we change that.", delay: 600 },
    { text: "I'm assigning your first operation. Complete it within 24 hours.", delay: 600 },
    { text: "Failure is not an option. It's just... disappointing.", italic: true, color: colors.textSecondary, delay: 1200 },
  ], [userName]);

  // ─── Phase transitions ────────────────────────────────────────────────────

  const handleScanComplete = () => setPhase("diagnosis");

  const handleDiagnosisComplete = () => {
    setTimeout(() => setPhase("declaration"), 1000);
  };

  const handleDeclarationComplete = () => {
    setTimeout(() => {
      setPhase("initiating");
      // Screen shake
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      shakeX.value = withSequence(
        withTiming(5, { duration: 50 }),
        withTiming(-5, { duration: 50 }),
        withTiming(4, { duration: 50 }),
        withTiming(-4, { duration: 50 }),
        withTiming(2, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
      shakeY.value = withSequence(
        withTiming(3, { duration: 50 }),
        withTiming(-3, { duration: 50 }),
        withTiming(2, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
      // Ring expansion
      ringScale.value = withTiming(8, { duration: 1500, easing: Easing.out(Easing.cubic) });
      ringOpacity.value = withDelay(200, withTiming(0, { duration: 1300 }));

      setTimeout(() => setPhase("briefing"), 2500);
    }, 1500);
  };

  const handleBriefingComplete = () => {
    setTimeout(() => setPhase("mission"), 1500);
  };

  const handleAcceptMission = () => {
    stopCurrentAudio();
    markFirstLaunchSeen();
    markPlayed(1);
    // Phase 4.2: Set first_active_date for day counting. Uses getTodayKey()
    // (local timezone) instead of toISOString().slice(0,10) (UTC) — the
    // old UTC format could be off by a day in timezones east of UTC
    // after midnight local time, making getDayNumber() return the wrong
    // day number and skipping day cinematics.
    if (!getJSON<string | null>("first_active_date", null)) {
      setJSON("first_active_date", getTodayKey());
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete();
  };

  // Mission data
  const missions = useMemo(
    () => getStarterMissions(identity).filter((m) => m.kind === "main").slice(0, 4),
    [identity],
  );

  // ═══ RENDER ════════════════════════════════════════════════════════════════

  return (
    <Animated.View style={[styles.container, shakeStyle]}>
      {/* Scan line effect */}
      <ScanLine active={phase === "scan" || phase === "diagnosis"} />

      {/* ─── Beat 1: Scan ─────────────────────────────────────────── */}
      {phase === "scan" && (
        <View style={styles.center}>
          <ProtocolTerminal
            lines={scanLines}
            lineInterval={600}
            onComplete={handleScanComplete}
          />
        </View>
      )}

      {/* ─── Beat 2: Diagnosis ────────────────────────────────────── */}
      {phase === "diagnosis" && (
        <View style={styles.center}>
          <ProtocolTerminal
            lines={diagnosisLines}
            lineInterval={400}
            onComplete={handleDiagnosisComplete}
          />
        </View>
      )}

      {/* ─── Beat 3: Declaration ──────────────────────────────────── */}
      {phase === "declaration" && (
        <View style={styles.center}>
          <ProtocolNarration
            lines={declarationLines}
            lineGap={800}
            onComplete={handleDeclarationComplete}
          />
        </View>
      )}

      {/* ─── Beat 4: INITIATING ───────────────────────────────────── */}
      {phase === "initiating" && (
        <View style={styles.center}>
          {/* Expanding ring */}
          <Animated.View style={[styles.ring, ringStyle]} />

          <Animated.Text
            entering={FadeIn.duration(200)}
            style={styles.initiatingText}
          >
            INITIATING TITAN PROTOCOL
          </Animated.Text>
        </View>
      )}

      {/* ─── Beat 5: First Briefing ───────────────────────────────── */}
      {phase === "briefing" && (
        <View style={styles.center}>
          <ProtocolNarration
            lines={briefingLines}
            lineGap={800}
            onComplete={handleBriefingComplete}
          />
        </View>
      )}

      {/* ─── Beat 6: Mission Screen ───────────────────────────────── */}
      {phase === "mission" && (
        <ScrollView contentContainerStyle={styles.missionContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.delay(200).duration(500)}>
            <Text style={styles.missionHeader}>OPERATION: FIRST LIGHT</Text>
            <Text style={styles.missionSubheader}>Day 1 | 24:00:00 remaining</Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(600).duration(500)}>
            <Text style={styles.missionDesc}>
              Complete these objectives within 24 hours. Protocol will evaluate your performance.
            </Text>
          </Animated.View>

          {missions.map((m, i) => (
            <Animated.View
              key={i}
              entering={FadeInDown.delay(1000 + i * 200).duration(400)}
              style={[styles.missionCard, { borderLeftColor: ENGINE_COLORS[m.engine] }]}
            >
              <View style={styles.missionCardTop}>
                <View style={[styles.missionDot, { backgroundColor: ENGINE_COLORS[m.engine] }]} />
                <Text style={[styles.missionEngine, { color: ENGINE_COLORS[m.engine] }]}>
                  {ENGINE_LABELS[m.engine]}
                </Text>
                <Text style={styles.missionXp}>+20 XP</Text>
              </View>
              <Text style={styles.missionTitle}>{m.title}</Text>
            </Animated.View>
          ))}

          <Animated.View entering={FadeIn.delay(2200).duration(400)} style={styles.missionFooter}>
            <Text style={styles.missionNote}>
              PROTOCOL WILL EVALUATE YOUR PERFORMANCE AT 24:00.
            </Text>
            <Pressable style={styles.acceptBtn} onPress={handleAcceptMission}>
              <Text style={styles.acceptBtnText}>ACCEPT OPERATION</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      )}
    </Animated.View>
  );
}

// ─── Scan Line Effect ────────────────────────────────────────────────────────

function ScanLine({ active }: { active: boolean }) {
  const translateY = useSharedValue(-10);

  useEffect(() => {
    if (active) {
      translateY.value = withTiming(800, { duration: 8000, easing: Easing.linear });
    }
  }, [active]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: active ? 0.3 : 0,
  }));

  return (
    <Animated.View style={[scanStyles.line, style]} />
  );
}

const scanStyles = StyleSheet.create({
  line: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.body,
    zIndex: 10,
  },
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    zIndex: 200,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
  },

  // Initiating
  ring: {
    position: "absolute",
    alignSelf: "center",
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "rgba(247, 250, 255, 0.6)",
  },
  initiatingText: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 3,
    textAlign: "center",
  },

  // Mission screen
  missionContent: {
    paddingHorizontal: spacing["2xl"],
    paddingTop: 80,
    paddingBottom: spacing["3xl"],
  },
  missionHeader: {
    ...fonts.kicker,
    fontSize: 14,
    color: "#FBBF24",
    letterSpacing: 4,
    marginBottom: spacing.xs,
  },
  missionSubheader: {
    ...fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  missionDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  missionCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderLeftWidth: 3,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  missionCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 4,
  },
  missionDot: { width: 6, height: 6, borderRadius: 3 },
  missionEngine: { ...fonts.kicker, fontSize: 9, letterSpacing: 1, flex: 1 },
  missionXp: { ...fonts.mono, fontSize: 11, color: colors.success },
  missionTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  missionFooter: {
    marginTop: spacing.xl,
    alignItems: "center",
    gap: spacing.lg,
  },
  missionNote: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 2,
    textAlign: "center",
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["3xl"],
    alignItems: "center",
    width: "100%",
  },
  acceptBtnText: {
    ...fonts.kicker,
    fontSize: 14,
    color: "#000",
    letterSpacing: 3,
    fontWeight: "800",
  },
});
