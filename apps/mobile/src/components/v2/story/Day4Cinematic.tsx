import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { ProtocolNarration, type NarrationLine } from "./ProtocolTerminal";

type Props = { onComplete: () => void };

export function Day4Cinematic({ onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const [showMission, setShowMission] = useState(false);

  const narrationLines: NarrationLine[] = useMemo(
    () => [
      { text: `${userName.toUpperCase()}. Four days.`, fontSize: 20, bold: true, delay: 1200 },
      { text: "A pattern is forming. I can see what you prioritize.", delay: 800 },
      { text: "Today: balanced output. No hiding behind your strengths.", delay: 800 },
      {
        text: "Every engine. Every task. No excuses.",
        bold: true,
        delay: 1000,
      },
    ],
    [userName],
  );

  const handleNarrationComplete = () => {
    setTimeout(() => setShowMission(true), 1200);
  };

  const handleAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markPlayed(4);
    onComplete();
  };

  return (
    <View style={styles.container}>
      {!showMission && (
        <View style={styles.center}>
          <ProtocolNarration
            lines={narrationLines}
            lineGap={800}
            onComplete={handleNarrationComplete}
          />
        </View>
      )}

      {showMission && (
        <ScrollView contentContainerStyle={styles.missionContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.delay(200).duration(500)}>
            <Text style={styles.missionHeader}>OPERATION: THE PATTERN</Text>
            <Text style={styles.missionSubheader}>Day 4 | All four engines required</Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(1000).duration(400)} style={styles.footer}>
            <Pressable style={styles.acceptBtn} onPress={handleAccept}>
              <Text style={styles.acceptBtnText}>ACCEPT OPERATION</Text>
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
  missionContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
    paddingBottom: spacing["3xl"],
  },
  missionHeader: {
    ...fonts.kicker,
    fontSize: 14,
    color: "#FBBF24",
    letterSpacing: 4,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  missionSubheader: {
    ...fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  footer: {
    marginTop: spacing["2xl"],
    alignItems: "center",
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
