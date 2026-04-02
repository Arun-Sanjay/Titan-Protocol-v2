import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { ProtocolNarration, type NarrationLine } from "./ProtocolTerminal";

type Props = { onComplete: () => void };

export function Day5Cinematic({ onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const [showMission, setShowMission] = useState(false);

  const narrationLines: NarrationLine[] = useMemo(
    () => [
      { text: "Day 5. We're halfway through your induction.", fontSize: 18, bold: true, delay: 1200 },
      { text: "You've been following orders. Good.", delay: 800 },
      { text: "Today is different. Today I'm not telling you what to do.", delay: 1000 },
      { text: "Build your own operation. Four tasks minimum. One per engine.", bold: true, delay: 1000 },
      {
        text: "Show me you don't need instructions to perform.",
        italic: true,
        color: colors.textSecondary,
        delay: 1000,
      },
    ],
    [],
  );

  const handleNarrationComplete = () => {
    setTimeout(() => setShowMission(true), 1200);
  };

  const handleAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markPlayed(5);
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
            <Text style={styles.missionHeader}>OPERATION: THE TEST</Text>
            <Text style={styles.missionSubheader}>Day 5 | Build your own mission</Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(800).duration(400)}>
            <Text style={styles.noteText}>
              No suggested missions today. Create your own tasks in each engine.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(1400).duration(400)} style={styles.footer}>
            <Pressable style={styles.acceptBtn} onPress={handleAccept}>
              <Text style={styles.acceptBtnText}>I'M READY</Text>
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
  noteText: {
    fontSize: 13,
    color: "#FBBF24",
    textAlign: "center",
    lineHeight: 20,
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  footer: {
    marginTop: spacing.lg,
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
