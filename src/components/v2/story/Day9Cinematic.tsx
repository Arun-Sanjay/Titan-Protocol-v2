import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { spacing } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { ProtocolNarration, type NarrationLine } from "./ProtocolTerminal";
import { OperationBriefing } from "./OperationBriefing";
import { colors } from "../../../theme";
import { playSequence, stopCurrentAudio } from "../../../lib/protocol-audio";

type Props = { onComplete: () => void };

/**
 * Day 9 — "The Mirror"
 * Forces the user to confront their weakest engine.
 */
export function Day9Cinematic({ onComplete }: Props) {
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const [phase, setPhase] = useState<"speech" | "operation">("speech");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play voice at speech phase start (only stop on unmount, not phase change)
  useEffect(() => {
    if (phase !== "speech") return;
    playSequence([
      { id: "CIN-D9-001", delayAfter: 400 },
      { id: "CIN-D9-002", delayAfter: 300 },
      { id: "CIN-D9-003" },
    ]).catch(() => {});
  }, [phase]);

  // Stop audio on unmount only
  useEffect(() => {
    return () => { stopCurrentAudio(); };
  }, []);

  const narrationLines: NarrationLine[] = useMemo(
    () => [
      { text: "Day 9. Time to look in the mirror.", fontSize: 18, bold: true, delay: 1200 },
      { text: "Your weakest engine.", delay: 800 },
      { text: "You know which one it is. The protocol knows too.", delay: 800 },
      {
        text: "Today, you face it.",
        bold: true,
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
    markPlayed(9);
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
          dayNumber={9}
          operationName="THE MIRROR"
          operationSubtitle="Face your weakest engine"
          note="Today's operation prioritizes your lowest-scoring engine. No hiding."
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
