import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { ProtocolTerminal, ProtocolNarration, type TerminalLine, type NarrationLine } from "./ProtocolTerminal";

type Props = { onComplete: () => void };
type Phase = "stats" | "speech" | "legacy";

export function Day365Cinematic({ onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);

  const [phase, setPhase] = useState<Phase>("stats");

  // Phase 1: Terminal (types slowly)
  const statsLines: TerminalLine[] = useMemo(
    () => [
      { text: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", delay: 1000, haptic: "medium" },
      { text: "TITAN PROTOCOL \u2014 ANNUAL ASSESSMENT", fontSize: 16, bold: true, delay: 1200, haptic: "heavy" },
      { text: `SUBJECT: ${userName.toUpperCase()}`, delay: 800 },
      { text: "DAYS ACTIVE: 365", delay: 800 },
      { text: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", delay: 800, haptic: "none" },
    ],
    [userName],
  );

  // Phase 2: Protocol speech
  const speechLines: NarrationLine[] = useMemo(
    () => [
      { text: `${userName}. One year.`, fontSize: 24, bold: true, delay: 2000 },
      { text: "365 days ago, I scanned you and found nothing remarkable.", delay: 1500 },
      { text: "Today, I'm looking at someone I barely recognize.", delay: 1500 },
      { text: "There is nothing more I can teach you.", bold: true, delay: 1500 },
      { text: "You've internalized the Protocol. It's not a system you follow anymore.", delay: 1500 },
      { text: "It's who you are.", bold: true, delay: 1500 },
      { text: "I was designed to transform recruits into Titans.", delay: 1500 },
      { text: "Mission complete.", italic: true, color: "#FBBF24", fontSize: 20, delay: 2000 },
    ],
    [userName],
  );

  const handleStatsComplete = () => {
    setTimeout(() => setPhase("speech"), 2000);
  };

  const handleSpeechComplete = () => {
    setTimeout(() => setPhase("legacy"), 2000);
  };

  const handleDone = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markPlayed(365);
    onComplete();
  };

  return (
    <View style={styles.container}>
      {phase === "stats" && (
        <View style={styles.center}>
          <ProtocolTerminal lines={statsLines} lineInterval={800} onComplete={handleStatsComplete} />
        </View>
      )}

      {phase === "speech" && (
        <View style={styles.center}>
          <ProtocolNarration lines={speechLines} lineGap={1200} onComplete={handleSpeechComplete} />
        </View>
      )}

      {phase === "legacy" && (
        <ScrollView contentContainerStyle={styles.transitionContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.delay(200).duration(1200)} style={styles.phaseBlock}>
            <Text style={styles.legacyLabel}>LEGACY STATUS</Text>
            <Text style={styles.legacyTitle}>UNLOCKED</Text>
            <View style={styles.goldDivider} />
          </Animated.View>

          <Animated.View entering={FadeIn.delay(2000).duration(400)} style={styles.footer}>
            <Pressable style={styles.btn} onPress={handleDone}>
              <Text style={styles.btnText}>CONTINUE</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

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
  transitionContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing["2xl"],
    paddingBottom: spacing["3xl"],
  },
  phaseBlock: {
    alignItems: "center",
    marginBottom: spacing["3xl"],
  },
  legacyLabel: {
    ...fonts.mono,
    fontSize: 14,
    color: "#FBBF24",
    letterSpacing: 6,
    marginBottom: spacing.md,
  },
  legacyTitle: {
    fontSize: 40,
    fontWeight: "900",
    color: "#FBBF24",
    letterSpacing: 10,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  goldDivider: {
    width: 80,
    height: 3,
    backgroundColor: "#FBBF24",
  },
  footer: {
    width: "100%",
    alignItems: "center",
  },
  btn: {
    backgroundColor: "#FBBF24",
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["3xl"],
    alignItems: "center",
    width: "100%",
  },
  btnText: {
    ...fonts.kicker,
    fontSize: 14,
    color: "#000",
    letterSpacing: 3,
    fontWeight: "800",
  },
});
