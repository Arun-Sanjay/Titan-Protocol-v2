import React, { useState, useMemo, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { colors, spacing } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { ProtocolNarration, type NarrationLine } from "./ProtocolTerminal";
import { OperationBriefing } from "./OperationBriefing";
import { useEngineStore, selectTotalScore } from "../../../stores/useEngineStore";
import { getTodayKey, addDays } from "../../../lib/date";
import { playVoiceLineAsync, stopCurrentAudio } from "../../../lib/protocol-audio";

type Props = { onComplete: () => void };

type Trajectory = "up" | "flat" | "down";

export function Day6Cinematic({ onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const scores = useEngineStore((s) => s.scores);
  const loadDateRange = useEngineStore((s) => s.loadDateRange);
  const [phase, setPhase] = useState<"speech" | "operation">("speech");

  // Compute trajectory from last 5 days of scores
  const trajectory = useMemo<Trajectory>(() => {
    const today = getTodayKey();
    const day1 = addDays(today, -5);

    // Ensure scores are loaded for the range
    loadDateRange(day1, today);

    // Collect daily averages
    const dailyScores: number[] = [];
    for (let i = -5; i <= 0; i++) {
      const dk = addDays(today, i);
      const total = selectTotalScore(scores, dk);
      dailyScores.push(total);
    }

    // Compare recent average (last 2 days) vs early average (first 2 days)
    const earlyAvg = dailyScores.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    const recentAvg = dailyScores.slice(-2).reduce((a, b) => a + b, 0) / 2;

    if (recentAvg > earlyAvg + 5) return "up";
    if (recentAvg < earlyAvg - 5) return "down";
    return "flat";
  }, [scores, loadDateRange]);

  const narrationLines: NarrationLine[] = useMemo(() => {
    if (trajectory === "up") {
      return [
        { text: `${userName.toUpperCase()}. Your trajectory is UP.`, fontSize: 18, bold: true, delay: 1200 },
        { text: "The data doesn't lie. You're improving.", delay: 800 },
        {
          text: "Don't get comfortable. Comfort is where progress dies.",
          italic: true,
          color: colors.textSecondary,
          delay: 1000,
        },
      ];
    }
    if (trajectory === "down") {
      return [
        { text: `${userName.toUpperCase()}. The numbers are going the wrong direction.`, fontSize: 18, bold: true, delay: 1200 },
        { text: "I don't know what happened. But today, you fix it.", delay: 800 },
        {
          text: "No excuses. Execute.",
          bold: true,
          delay: 1000,
        },
      ];
    }
    // flat
    return [
      { text: `${userName.toUpperCase()}. Your trajectory is FLAT.`, fontSize: 18, bold: true, delay: 1200 },
      { text: "Consistent, but flat. I need to see growth, not maintenance.", delay: 800 },
      {
        text: "Push harder today. Surprise me.",
        italic: true,
        color: colors.textSecondary,
        delay: 1000,
      },
    ];
  }, [userName, trajectory]);

  // Play trajectory-specific voice line
  useEffect(() => {
    if (phase === "speech") {
      const voiceId = trajectory === "up" ? "CIN-D6-UP" : trajectory === "down" ? "CIN-D6-DOWN" : "CIN-D6-FLAT";
      playVoiceLineAsync(voiceId);
    }
    return () => { stopCurrentAudio(); };
  }, [phase, trajectory]);

  const handleNarrationComplete = () => {
    setTimeout(() => setPhase("operation"), 1200);
  };

  const handleAccept = () => {
    stopCurrentAudio();
    markPlayed(6);
    onComplete();
  };

  return (
    <View style={styles.container}>
      {phase === "speech" && (
        <View style={styles.center}>
          <ProtocolNarration
            lines={narrationLines}
            lineGap={800}
            onComplete={handleNarrationComplete}
          />
        </View>
      )}

      {phase === "operation" && (
        <OperationBriefing
          dayNumber={6}
          operationName="RISING"
          operationSubtitle="Prove your trajectory"
          onAccept={handleAccept}
        />
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
});
