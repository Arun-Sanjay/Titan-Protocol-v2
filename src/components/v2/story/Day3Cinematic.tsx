import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { spacing } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { ProtocolNarration, type NarrationLine } from "./ProtocolTerminal";
import { OperationBriefing } from "./OperationBriefing";
import { colors } from "../../../theme";
import { playSequence, stopCurrentAudio } from "../../../lib/protocol-audio";

type Props = { onComplete: () => void };

export function Day3Cinematic({ onComplete }: Props) {
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const [phase, setPhase] = useState<"speech" | "operation">("speech");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play voice at speech phase start (only stop on unmount, not phase change)
  useEffect(() => {
    if (phase !== "speech") return;
    playSequence([
      { id: "CIN-D3-001", delayAfter: 400 },
      { id: "CIN-D3-002" },
    ]).catch(() => {});
  }, [phase]);

  // Stop audio on unmount only
  useEffect(() => {
    return () => { stopCurrentAudio(); };
  }, []);

  const narrationLines: NarrationLine[] = useMemo(
    () => [
      { text: "Day 3. You're still here. That's... notable.", fontSize: 18, bold: true, delay: 1200 },
      { text: "Most recruits disappear by now.", delay: 800 },
      { text: "Today I'm bringing your weakest engine online.", delay: 800 },
      {
        text: "You've been avoiding it. I noticed.",
        italic: true,
        color: colors.textSecondary,
        delay: 1000,
      },
    ],
    [],
  );

  const handleNarrationComplete = useCallback(() => {
    timerRef.current = setTimeout(() => setPhase("operation"), 1200);
  }, []);

  const handleAccept = () => {
    stopCurrentAudio();
    markPlayed(3);
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
          dayNumber={3}
          operationName="ENGINE IGNITION"
          operationSubtitle="No more hiding"
          note="Today's operation focuses on your weakest engine. Protocol has assigned extra objectives there."
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
