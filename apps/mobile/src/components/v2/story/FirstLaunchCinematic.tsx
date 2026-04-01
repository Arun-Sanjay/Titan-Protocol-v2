import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from "react-native";
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
import { colors, spacing, fonts, radius } from "../../../theme";
import { titanColors } from "../../../theme/colors";
import { getJSON, setJSON } from "../../../db/storage";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { IDENTITIES } from "../../../stores/useIdentityStore";
import { IDENTITY_LABELS, type IdentityArchetype } from "../../../stores/useModeStore";
import { getStarterMissions, type StarterMission } from "../../../data/starter-missions";

const FIRST_LAUNCH_KEY = "first_launch_seen";

export function isFirstLaunchSeen(): boolean {
  return getJSON<boolean>(FIRST_LAUNCH_KEY, false);
}

export function markFirstLaunchSeen(): void {
  setJSON(FIRST_LAUNCH_KEY, true);
}

// ─── Engine colors + labels ──────────────────────────────────────────────────

const ENGINE_COLORS: Record<string, string> = {
  body: colors.body, mind: colors.mind, money: colors.money, charisma: colors.charisma,
};
const ENGINE_LABELS: Record<string, string> = {
  body: "BODY", mind: "MIND", money: "MONEY", charisma: "CHARISMA",
};

// ─── Archetype-specific danger briefings ─────────────────────────────────────

const DANGER_BRIEFINGS: Record<string, string[]> = {
  titan: [
    "WARNING: All systems critical.",
    "Body output... 12%. Mind clarity... 8%.",
    "Financial trajectory... declining.",
    "Social presence... undetected.",
    "You have no discipline. No structure. No edge.",
    "Without intervention, trajectory is: mediocre.",
  ],
  athlete: [
    "WARNING: Physical systems offline.",
    "Strength output... unmeasured. Endurance... untested.",
    "Your body is running on defaults. Not optimized.",
    "You're leaving performance on the table every day.",
    "Without intervention, peak potential remains locked.",
  ],
  scholar: [
    "WARNING: Cognitive systems underutilized.",
    "Knowledge acquisition rate... minimal.",
    "Deep work capacity... dormant. Focus... scattered.",
    "Your mind is capable of more. Much more.",
    "Without intervention, intellectual capital stagnates.",
  ],
  hustler: [
    "WARNING: Financial engines stalled.",
    "Income streams... 1. Savings rate... unknown.",
    "No tracking. No strategy. No compound growth.",
    "Money moves are being left on the table.",
    "Without intervention, financial trajectory flatlines.",
  ],
  showman: [
    "WARNING: Presence systems offline.",
    "Confidence output... suppressed. Voice... untrained.",
    "Social impact... negligible. Influence... zero.",
    "You're invisible in rooms that matter.",
    "Without intervention, your voice stays unheard.",
  ],
  warrior: [
    "WARNING: Dual systems critical.",
    "Body discipline... inconsistent. Mental edge... dull.",
    "The body-mind connection is severed.",
    "You're operating at half capacity in both domains.",
    "Without intervention, the warrior stays asleep.",
  ],
  founder: [
    "WARNING: Build systems offline.",
    "Strategic thinking... unfocused. Execution... sporadic.",
    "Knowledge-to-income pipeline... blocked.",
    "Your ideas are dying in your head.",
    "Without intervention, nothing gets built.",
  ],
  charmer: [
    "WARNING: Presence and body offline.",
    "Physical confidence... low. Social courage... untested.",
    "You're not showing up the way you could.",
    "First impressions are being wasted.",
    "Without intervention, you stay forgettable.",
  ],
};

// ─── Component ───────────────────────────────────────────────────────────────

type Phase = "danger" | "boot" | "mission";

type Props = {
  onComplete: () => void;
};

export function FirstLaunchCinematic({ onComplete }: Props) {
  const identity = useOnboardingStore((s) => s.identity) ?? "titan";
  const meta = IDENTITIES.find((i) => i.id === identity);
  const isTitan = identity === "titan";
  const accentColor = isTitan ? titanColors.accent : colors.primary;

  const [phase, setPhase] = useState<Phase>("danger");
  const [visibleLines, setVisibleLines] = useState(0);
  const [bootStep, setBootStep] = useState(0);
  const { height: screenHeight } = useWindowDimensions();

  const briefing = DANGER_BRIEFINGS[identity] ?? DANGER_BRIEFINGS.titan;
  const missions = getStarterMissions(identity).filter((m) => m.kind === "main").slice(0, 4);

  // ─── Phase 1: Danger briefing — typewriter-style line reveal ───────────────

  useEffect(() => {
    if (phase !== "danger") return;
    let line = 0;
    const interval = setInterval(() => {
      line++;
      if (line <= briefing.length) {
        setVisibleLines(line);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        clearInterval(interval);
        // Pause then transition to boot
        setTimeout(() => setPhase("boot"), 1500);
      }
    }, 800);
    return () => clearInterval(interval);
  }, [phase]);

  // ─── Phase 2: HUD boot sequence ───────────────────────────────────────────

  const bootEngines = ["body", "mind", "money", "charisma"];

  useEffect(() => {
    if (phase !== "boot") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      setBootStep(step);
      if (step <= 4) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (step === 5) {
        // "PROTOCOL ACTIVE" step
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (step >= 6) {
        clearInterval(interval);
        setTimeout(() => setPhase("mission"), 1000);
      }
    }, 700);
    return () => clearInterval(interval);
  }, [phase]);

  // ─── Phase 3: Mission briefing ─────────────────────────────────────────────

  const handleAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markFirstLaunchSeen();
    onComplete();
  };

  // ═══ RENDER ════════════════════════════════════════════════════════════════

  if (phase === "danger") {
    return (
      <View style={styles.container}>
        <View style={styles.dangerContent}>
          {/* Scanline effect */}
          <View style={styles.scanlineOverlay} />

          <Text style={styles.dangerHeader}>
            {"\u26A0\uFE0F"} SYSTEM ALERT
          </Text>

          {briefing.slice(0, visibleLines).map((line, i) => (
            <Animated.Text
              key={i}
              entering={FadeIn.duration(300)}
              style={[
                styles.dangerLine,
                i === 0 && styles.dangerLineFirst,
              ]}
            >
              {line}
            </Animated.Text>
          ))}

          {visibleLines >= briefing.length && (
            <Animated.Text
              entering={FadeIn.delay(500).duration(400)}
              style={styles.dangerCta}
            >
              INITIATING COUNTERMEASURE...
            </Animated.Text>
          )}
        </View>
      </View>
    );
  }

  if (phase === "boot") {
    return (
      <View style={styles.container}>
        <View style={styles.bootContent}>
          <Text style={styles.bootHeader}>INITIALIZING TITAN PROTOCOL</Text>

          <View style={styles.bootList}>
            {bootEngines.map((engine, i) => {
              const online = bootStep > i;
              const current = bootStep === i + 1;
              return (
                <Animated.View
                  key={engine}
                  entering={FadeInDown.delay(i * 100).duration(300)}
                  style={styles.bootRow}
                >
                  <View style={[styles.bootDot, { backgroundColor: online ? ENGINE_COLORS[engine] : "rgba(255,255,255,0.15)" }]} />
                  <Text style={[styles.bootEngine, online && { color: ENGINE_COLORS[engine] }]}>
                    {ENGINE_LABELS[engine]} ENGINE
                  </Text>
                  <Text style={[
                    styles.bootStatus,
                    online && { color: ENGINE_COLORS[engine] },
                    current && styles.bootStatusBlink,
                  ]}>
                    {online ? "ONLINE" : current ? "LOADING..." : "OFFLINE"}
                  </Text>
                </Animated.View>
              );
            })}
          </View>

          {/* Progress bar */}
          <View style={styles.bootProgress}>
            <View style={[styles.bootProgressFill, { width: `${Math.min(bootStep / 5, 1) * 100}%` }]} />
          </View>

          {bootStep >= 5 && (
            <Animated.View entering={FadeIn.duration(400)}>
              <Text style={styles.bootActive}>
                {"\u2713"} PROTOCOL ACTIVE
              </Text>
              <Text style={styles.bootIdentity}>
                OPERATOR: {meta?.name ?? IDENTITY_LABELS[identity as IdentityArchetype]}
              </Text>
            </Animated.View>
          )}
        </View>
      </View>
    );
  }

  // Phase 3: Mission briefing
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.missionContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.delay(200).duration(500)}>
          <Text style={styles.missionHeader}>MISSION BRIEFING</Text>
          <Text style={styles.missionSubheader}>DAY 1 {"\u00B7"} 24-HOUR WINDOW</Text>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(600).duration(500)}>
          <Text style={styles.missionDesc}>
            Complete these critical tasks within 24 hours to activate your engines and prove you're ready for the Titan Protocol.
          </Text>
        </Animated.View>

        {/* Mission cards */}
        {missions.map((mission, i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.delay(1000 + i * 200).duration(400)}
            style={[styles.missionCard, { borderLeftColor: ENGINE_COLORS[mission.engine] }]}
          >
            <View style={styles.missionCardTop}>
              <View style={[styles.missionDot, { backgroundColor: ENGINE_COLORS[mission.engine] }]} />
              <Text style={[styles.missionEngine, { color: ENGINE_COLORS[mission.engine] }]}>
                {ENGINE_LABELS[mission.engine]}
              </Text>
              <Text style={styles.missionXp}>+20 XP</Text>
            </View>
            <Text style={styles.missionTitle}>{mission.title}</Text>
          </Animated.View>
        ))}

        <Animated.View entering={FadeIn.delay(2200).duration(400)} style={styles.missionFooter}>
          <Text style={styles.missionWarning}>
            FAILURE TO COMPLETE = DAY 1 SCORE: 0%
          </Text>

          <Pressable style={styles.acceptBtn} onPress={handleAccept}>
            <Text style={styles.acceptBtnText}>ACCEPT MISSION</Text>
          </Pressable>

          <Text style={styles.missionTimer}>24:00:00 REMAINING</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    zIndex: 200,
  },

  // ─── Danger phase ──────────────────────────────────────────────────────────
  dangerContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
  },
  scanlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.05)",
  },
  dangerHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f87171",
    letterSpacing: 4,
    marginBottom: spacing.xl,
  },
  dangerLine: {
    ...fonts.mono,
    fontSize: 14,
    color: "rgba(248, 113, 113, 0.85)",
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  dangerLineFirst: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f87171",
  },
  dangerCta: {
    ...fonts.kicker,
    fontSize: 12,
    color: "#FBBF24",
    letterSpacing: 3,
    marginTop: spacing.xl,
  },

  // ─── Boot phase ────────────────────────────────────────────────────────────
  bootContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
  },
  bootHeader: {
    ...fonts.kicker,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 4,
    marginBottom: spacing["2xl"],
  },
  bootList: {
    gap: spacing.lg,
    marginBottom: spacing["2xl"],
  },
  bootRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  bootDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bootEngine: {
    ...fonts.kicker,
    fontSize: 13,
    color: "rgba(255,255,255,0.25)",
    letterSpacing: 2,
    flex: 1,
  },
  bootStatus: {
    ...fonts.mono,
    fontSize: 11,
    color: "rgba(255,255,255,0.15)",
  },
  bootStatusBlink: {
    color: "#FBBF24",
  },
  bootProgress: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: spacing.xl,
  },
  bootProgressFill: {
    height: "100%",
    backgroundColor: colors.body,
    borderRadius: 2,
  },
  bootActive: {
    ...fonts.kicker,
    fontSize: 14,
    color: colors.success,
    letterSpacing: 3,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  bootIdentity: {
    ...fonts.kicker,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
    textAlign: "center",
  },

  // ─── Mission phase ─────────────────────────────────────────────────────────
  missionContent: {
    paddingHorizontal: spacing["2xl"],
    paddingTop: 80,
    paddingBottom: spacing["3xl"],
  },
  missionHeader: {
    ...fonts.kicker,
    fontSize: 14,
    color: "#f87171",
    letterSpacing: 4,
    marginBottom: spacing.xs,
  },
  missionSubheader: {
    ...fonts.kicker,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 3,
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
  missionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  missionEngine: {
    ...fonts.kicker,
    fontSize: 9,
    letterSpacing: 1,
    flex: 1,
  },
  missionXp: {
    ...fonts.mono,
    fontSize: 11,
    color: colors.success,
  },
  missionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  missionFooter: {
    marginTop: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  missionWarning: {
    ...fonts.kicker,
    fontSize: 10,
    color: "#f87171",
    letterSpacing: 2,
  },
  acceptBtn: {
    backgroundColor: "#f87171",
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
  missionTimer: {
    ...fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 2,
  },
});
