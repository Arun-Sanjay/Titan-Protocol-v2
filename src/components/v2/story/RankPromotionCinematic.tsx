/**
 * RankPromotionCinematic — Full-screen cinematic for progression rank promotions.
 *
 * Triggers when user advances from one rank to another (e.g., Operative → Agent).
 * Phase flow: "terminal" → "reveal" → dismissable
 *
 * Terminal shows rank evaluation data.
 * Reveal slams the new rank name with glow, color, haptics, and ElevenLabs voice.
 */

import React, { useState, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import {
  ProtocolTerminal,
  type TerminalLine,
} from "./ProtocolTerminal";
import {
  playVoiceLineAsync,
  stopCurrentAudio,
  getRankPromotionVoiceId,
  getRankDemotionVoiceId,
} from "../../../lib/protocol-audio";
import {
  RANK_NAMES,
  RANK_COLORS,
  RANK_ABBREVIATIONS,
  RANK_REQUIREMENTS,
  type Rank,
} from "../../../lib/ranks-v2";

type Props = {
  previousRank: Rank;
  newRank: Rank;
  isDemotion?: boolean;
  onDismiss: () => void;
};

export function RankPromotionCinematic({
  previousRank,
  newRank,
  isDemotion = false,
  onDismiss,
}: Props) {
  const [phase, setPhase] = useState<"terminal" | "reveal">("terminal");

  const rankColor = RANK_COLORS[newRank];
  const rankName = RANK_NAMES[newRank];
  const rankAbbr = RANK_ABBREVIATIONS[newRank];
  const req = RANK_REQUIREMENTS[newRank];

  // Glow pulse on rank reveal
  const glowOpacity = useSharedValue(0);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // Scale slam for rank name
  const nameScale = useSharedValue(1.5);
  const nameOpacity = useSharedValue(0);
  const nameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nameScale.value }],
    opacity: nameOpacity.value,
  }));

  // ─── Terminal phase ─────────────────────────────────────────────────────

  const terminalLines: TerminalLine[] = useMemo(() => {
    if (isDemotion) {
      return [
        { text: "RANK EVALUATION", delay: 600, haptic: "medium" },
        { text: "─────────────────────────", delay: 300, haptic: "none" },
        { text: `PREVIOUS RANK: ${RANK_NAMES[previousRank].toUpperCase()}`, delay: 500 },
        { text: "PERFORMANCE: BELOW THRESHOLD", delay: 500, color: "#f87171" },
        { text: "─────────────────────────", delay: 300, haptic: "none" },
        { text: "RANK DEMOTION", fontSize: 16, bold: true, delay: 800, haptic: "heavy", color: "#f87171" },
        { text: `NEW RANK: ${rankName.toUpperCase()}`, delay: 600, color: "#f87171" },
      ];
    }

    return [
      { text: "RANK EVALUATION", delay: 600, haptic: "medium" },
      { text: "─────────────────────────", delay: 300, haptic: "none" },
      { text: `PREVIOUS RANK: ${RANK_NAMES[previousRank].toUpperCase()}`, delay: 500 },
      { text: `QUALIFYING DAYS: ${req.consecutiveDays}+`, delay: 500, color: colors.success },
      { text: `AVERAGE SCORE: ${req.avgScore}%+`, delay: 500, color: colors.success },
      { text: "─────────────────────────", delay: 300, haptic: "none" },
      { text: "RANK PROMOTION CONFIRMED", fontSize: 16, bold: true, delay: 800, haptic: "heavy", color: rankColor },
    ];
  }, [previousRank, newRank, isDemotion, rankColor, rankName, req]);

  // ─── Reveal phase (voice + animations) ──────────────────────────────────

  useEffect(() => {
    if (phase !== "reveal") return;

    // Voice
    const voiceId = isDemotion ? getRankDemotionVoiceId() : getRankPromotionVoiceId(newRank);
    playVoiceLineAsync(voiceId);

    // Haptic slam
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 100);

    // Name slam animation
    nameOpacity.value = withTiming(1, { duration: 200 });
    nameScale.value = withSequence(
      withTiming(1.0, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );

    // Glow pulse
    glowOpacity.value = withSequence(
      withTiming(0.6, { duration: 200 }),
      withTiming(0.15, { duration: 400 }),
      withRepeat(
        withSequence(
          withTiming(0.25, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );

    return () => {
      stopCurrentAudio();
      cancelAnimation(glowOpacity);
      cancelAnimation(nameOpacity);
      cancelAnimation(nameScale);
    };
  }, [phase, glowOpacity, nameOpacity, nameScale]);

  // Stop audio on unmount
  useEffect(() => {
    return () => { stopCurrentAudio(); };
  }, []);

  const handleTerminalComplete = () => {
    setTimeout(() => setPhase("reveal"), 1200);
  };

  const handleDismiss = () => {
    stopCurrentAudio();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDismiss();
  };

  const topBarColor = isDemotion ? "#f87171" : rankColor;

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { backgroundColor: topBarColor }]} />

      {phase === "terminal" && (
        <View style={styles.center}>
          <ProtocolTerminal
            lines={terminalLines}
            lineInterval={500}
            onComplete={handleTerminalComplete}
          />
        </View>
      )}

      {phase === "reveal" && (
        <View style={styles.revealContent}>
          {/* Glow behind rank name */}
          <Animated.View style={[styles.glow, { backgroundColor: rankColor }, glowStyle]} />

          {/* Rank abbreviation */}
          <Animated.Text
            entering={FadeIn.delay(200).duration(300)}
            style={[styles.abbr, { color: rankColor }]}
          >
            {rankAbbr}
          </Animated.Text>

          {/* Rank name slam */}
          <Animated.Text style={[styles.rankName, { color: rankColor }, nameStyle]}>
            {rankName.toUpperCase()}
          </Animated.Text>

          {/* Status label */}
          <Animated.View entering={FadeInDown.delay(600).duration(400)} style={[styles.statusBadge, { borderColor: rankColor }]}>
            <Text style={[styles.statusText, { color: rankColor }]}>
              {isDemotion ? "RANK DEMOTED" : "RANK PROMOTED"}
            </Text>
          </Animated.View>

          {/* Requirement met */}
          {!isDemotion && (
            <Animated.Text entering={FadeIn.delay(800).duration(400)} style={styles.reqText}>
              {req.consecutiveDays} days at {req.avgScore}%+ average
            </Animated.Text>
          )}

          {/* Dismiss button */}
          <Animated.View entering={FadeIn.delay(1200).duration(400)} style={styles.footer}>
            <Pressable style={[styles.btn, { backgroundColor: isDemotion ? "transparent" : rankColor, borderColor: rankColor, borderWidth: isDemotion ? 1.5 : 0 }]} onPress={handleDismiss}>
              <Text style={[styles.btnText, { color: isDemotion ? rankColor : "#000" }]}>
                {isDemotion ? "UNDERSTOOD" : "ACKNOWLEDGED"}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    zIndex: 270,
  },
  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 3,
    zIndex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
  },
  revealContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  glow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  abbr: {
    ...fonts.kicker,
    fontSize: 14,
    letterSpacing: 6,
  },
  rankName: {
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
  },
  statusBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 100,
    borderWidth: 1,
  },
  statusText: {
    ...fonts.kicker,
    fontSize: 12,
    letterSpacing: 4,
  },
  reqText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },
  footer: {
    width: "100%",
    marginTop: spacing.xl,
  },
  btn: {
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    width: "100%",
  },
  btnText: {
    ...fonts.kicker,
    fontSize: 14,
    letterSpacing: 3,
    fontWeight: "800",
  },
});
