import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { ProtocolNarration, type NarrationLine } from "./ProtocolTerminal";

type Props = { onComplete: () => void };
type Phase = "speech" | "operation";

export function Day45Cinematic({ onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const setFlag = useStoryStore((s) => s.setFlag);

  const [phase, setPhase] = useState<Phase>("speech");

  const speechLines: NarrationLine[] = useMemo(
    () => [
      { text: `${userName}. Day 45.`, fontSize: 20, bold: true, delay: 1200 },
      { text: "I need to tell you something.", delay: 1000 },
      { text: "Most people who make it to Day 30 still quit by Day 60.", delay: 1200 },
      { text: "30 days is a streak. 90 days is a transformation.", bold: true, delay: 1200 },
      { text: "This week is statistically where the highest dropout happens.", delay: 1000 },
      { text: "I'm issuing Operation: Crucible.", bold: true, delay: 1200 },
      { text: "This week's objectives are harder than anything I've given you.", delay: 1000 },
      { text: "Complete them and you'll know you're serious.", italic: true, color: colors.textSecondary, delay: 1200 },
    ],
    [userName],
  );

  const handleSpeechComplete = () => {
    setTimeout(() => setPhase("operation"), 1500);
  };

  const handleAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFlag("crucible_started", true);
    markPlayed(45);
    onComplete();
  };

  return (
    <View style={styles.container}>
      {phase === "speech" && (
        <View style={styles.center}>
          <ProtocolNarration lines={speechLines} lineGap={800} onComplete={handleSpeechComplete} />
        </View>
      )}

      {phase === "operation" && (
        <ScrollView contentContainerStyle={styles.transitionContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.delay(200).duration(800)} style={styles.phaseBlock}>
            <Text style={styles.operationLabel}>OPERATION</Text>
            <Text style={styles.phaseLabel}>CRUCIBLE</Text>
            <View style={styles.divider} />
            <Text style={styles.phaseSubtitle}>
              All four engines must score 70%+ every day for 7 days.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(1200).duration(400)} style={styles.footer}>
            <Pressable style={styles.btn} onPress={handleAccept}>
              <Text style={styles.btnText}>ACCEPT THE CRUCIBLE</Text>
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
  operationLabel: {
    ...fonts.mono,
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
  phaseLabel: {
    fontSize: 36,
    fontWeight: "900",
    color: "#f87171",
    letterSpacing: 8,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: "#f87171",
    marginBottom: spacing.lg,
  },
  phaseSubtitle: {
    ...fonts.mono,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    letterSpacing: 1,
    lineHeight: 20,
  },
  footer: {
    width: "100%",
    alignItems: "center",
  },
  btn: {
    backgroundColor: "#f87171",
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
