import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { ProtocolNarration, ProtocolTerminal, type NarrationLine, type TerminalLine } from "./ProtocolTerminal";

// ─── Engine color map ────────────────────────────────────────────────────────

const ENGINE_COLORS: Record<string, string> = {
  body: "#22C55E",
  mind: "#3B82F6",
  money: "#FBBF24",
  charisma: "#A855F7",
};

// ─── Types ───────────────────────────────────────────────────────────────────

type EventType =
  | "streak_milestone"
  | "streak_broken"
  | "engine_online"
  | "all_engines_online"
  | "first_s_rank"
  | "first_ss_rank"
  | "boss_defeat"
  | "titan_mode";

type Props = {
  eventType: EventType;
  data?: {
    streakCount?: number;
    engineName?: string;
    rankScore?: number;
    bossName?: string;
  };
  onComplete: () => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStreakMilestoneMessage(count: number): string {
  if (count >= 365) return "A year of consistency. You're beyond discipline now. This is identity.";
  if (count >= 100) return "Triple digits. Most people can't do this for a week. You did it for months.";
  if (count >= 60) return "Two months without breaking. The protocol is becoming second nature.";
  if (count >= 30) return "Thirty days straight. That's not luck. That's will.";
  if (count >= 14) return "Two weeks of consistency. The foundation is hardening.";
  if (count >= 7) return "One full week. Momentum is building.";
  return "Keep stacking days. Every one counts.";
}

function getStreakBrokenMessage(count: number): string {
  if (count >= 30) return "That was a serious streak. Losing it hurts. Good. Use that.";
  if (count >= 14) return "Two weeks of work, gone. But the skills you built aren't. Rebuild.";
  if (count >= 7) return "A week's streak ended. It happens. What matters is what you do tomorrow.";
  return "The streak ended. Start a new one. Now.";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EventCinematic({ eventType, data, onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-close after 5 seconds
  useEffect(() => {
    autoCloseRef.current = setTimeout(() => {
      onComplete();
    }, 5000);
    return () => {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, [onComplete]);

  const handleTap = () => {
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    onComplete();
  };

  // Fire haptic on mount
  useEffect(() => {
    if (eventType === "titan_mode" || eventType === "all_engines_online") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, [eventType]);

  // ─── Render content based on event type ──────────────────────────────────

  if (eventType === "streak_milestone") {
    const count = data?.streakCount ?? 7;
    return (
      <Pressable style={styles.container} onPress={handleTap}>
        <View style={styles.center}>
          <ProtocolNarration
            lines={[
              { text: `${userName}.`, fontSize: 20, bold: true, delay: 600 },
              { text: `${count}-day streak.`, fontSize: 24, bold: true, color: colors.success, delay: 800 },
              { text: getStreakMilestoneMessage(count), delay: 1000 },
            ]}
            lineGap={800}
          />
        </View>
      </Pressable>
    );
  }

  if (eventType === "streak_broken") {
    const count = data?.streakCount ?? 0;
    return (
      <Pressable style={styles.container} onPress={handleTap}>
        <View style={styles.center}>
          <ProtocolNarration
            lines={[
              { text: `${userName}.`, fontSize: 20, bold: true, delay: 600 },
              { text: `Your ${count}-day streak ended.`, color: "#f87171", delay: 800 },
              { text: getStreakBrokenMessage(count), delay: 1000 },
            ]}
            lineGap={800}
          />
        </View>
      </Pressable>
    );
  }

  if (eventType === "engine_online") {
    const name = (data?.engineName ?? "BODY").toUpperCase();
    const engineColor = ENGINE_COLORS[data?.engineName?.toLowerCase() ?? "body"] ?? colors.success;
    return (
      <Pressable style={styles.container} onPress={handleTap}>
        <View style={styles.center}>
          <Animated.View entering={FadeIn.delay(300).duration(600)} style={styles.engineBlock}>
            <Text style={[styles.engineLabel, { color: engineColor }]}>ENGINE {name}</Text>
            <Text style={[styles.engineStatus, { color: engineColor }]}>O N L I N E</Text>
            <View style={styles.powerBarTrack}>
              <Animated.View
                entering={FadeIn.delay(800).duration(1200)}
                style={[styles.powerBarFill, { backgroundColor: engineColor }]}
              />
            </View>
          </Animated.View>
        </View>
      </Pressable>
    );
  }

  if (eventType === "all_engines_online") {
    const engineNames = ["BODY", "MIND", "MONEY", "CHARISMA"];
    const engineKeys = ["body", "mind", "money", "charisma"];
    return (
      <Pressable style={styles.container} onPress={handleTap}>
        <View style={styles.center}>
          <Animated.View entering={FadeIn.delay(200).duration(600)}>
            <Text style={styles.allEnginesTitle}>ALL ENGINES</Text>
            <Text style={[styles.allEnginesStatus, { color: colors.success }]}>O N L I N E</Text>
          </Animated.View>
          <View style={styles.allBarsContainer}>
            {engineKeys.map((key, i) => (
              <Animated.View
                key={key}
                entering={FadeIn.delay(800 + i * 400).duration(600)}
                style={styles.barRow}
              >
                <Text style={[styles.barLabel, { color: ENGINE_COLORS[key] }]}>
                  {engineNames[i]}
                </Text>
                <View style={styles.powerBarTrack}>
                  <Animated.View
                    entering={FadeIn.delay(1000 + i * 400).duration(800)}
                    style={[styles.powerBarFill, { backgroundColor: ENGINE_COLORS[key] }]}
                  />
                </View>
              </Animated.View>
            ))}
          </View>
        </View>
      </Pressable>
    );
  }

  if (eventType === "first_s_rank") {
    const score = data?.rankScore ?? 85;
    return (
      <Pressable style={styles.container} onPress={handleTap}>
        <View style={styles.center}>
          <ProtocolNarration
            lines={[
              { text: "S rank.", fontSize: 28, bold: true, color: "#FBBF24", delay: 600 },
              { text: `${score}%. Top tier.`, fontSize: 18, delay: 800 },
              { text: "There's only one rank above you.", delay: 1000 },
            ]}
            lineGap={800}
          />
        </View>
      </Pressable>
    );
  }

  if (eventType === "first_ss_rank") {
    const score = data?.rankScore ?? 95;
    return (
      <Pressable style={styles.container} onPress={handleTap}>
        <View style={styles.center}>
          <ProtocolNarration
            lines={[
              { text: "SS rank.", fontSize: 32, bold: true, color: "#FBBF24", delay: 600 },
              { text: `${score}%. Perfect or near-perfect.`, fontSize: 18, delay: 800 },
              { text: "This is peak performance.", bold: true, delay: 1000 },
            ]}
            lineGap={800}
          />
        </View>
      </Pressable>
    );
  }

  if (eventType === "boss_defeat") {
    const bossName = data?.bossName ?? "UNKNOWN";
    return (
      <Pressable style={styles.container} onPress={handleTap}>
        <View style={styles.center}>
          <ProtocolNarration
            lines={[
              { text: "Boss Challenge complete.", fontSize: 18, bold: true, delay: 600 },
              { text: bossName.toUpperCase(), fontSize: 26, bold: true, color: "#f87171", delay: 800 },
              { text: "Added to your record. Permanently.", italic: true, color: colors.textSecondary, delay: 1000 },
            ]}
            lineGap={800}
          />
        </View>
      </Pressable>
    );
  }

  if (eventType === "titan_mode") {
    return (
      <Pressable style={styles.container} onPress={handleTap}>
        <View style={styles.titanCenter}>
          <Animated.Text entering={FadeIn.delay(300).duration(1500)} style={styles.titanText}>
            T I T A N {"  "} M O D E
          </Animated.Text>
          <Animated.Text entering={FadeIn.delay(1500).duration(800)} style={styles.titanUnlocked}>
            U N L O C K E D
          </Animated.Text>
          <Animated.View entering={FadeIn.delay(2200).duration(600)} style={styles.titanAccent} />
        </View>
      </Pressable>
    );
  }

  // Fallback (should not reach here)
  return null;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    zIndex: 250,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing["2xl"],
  },

  // Engine online
  engineBlock: {
    alignItems: "center",
    gap: spacing.lg,
  },
  engineLabel: {
    ...fonts.mono,
    fontSize: 14,
    letterSpacing: 4,
  },
  engineStatus: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 10,
  },
  powerBarTrack: {
    width: 200,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  powerBarFill: {
    width: "100%",
    height: "100%",
    borderRadius: 3,
  },

  // All engines online
  allEnginesTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: 6,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  allEnginesStatus: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 10,
    textAlign: "center",
    marginBottom: spacing["2xl"],
  },
  allBarsContainer: {
    width: "100%",
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  barLabel: {
    ...fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    width: 80,
    textAlign: "right",
  },

  // Titan mode
  titanCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing["2xl"],
  },
  titanText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FBBF24",
    letterSpacing: 6,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  titanUnlocked: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FBBF24",
    letterSpacing: 8,
    textAlign: "center",
    marginBottom: spacing["2xl"],
  },
  titanAccent: {
    width: 120,
    height: 3,
    backgroundColor: "#FBBF24",
  },
});
