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
 * Day 11 — "The Quiet Day"
 * Deliberately minimal. Only 2 lines. The brevity IS the message —
 * Protocol trusts you enough to say less. Tests self-motivation.
 */
export function Day11Cinematic({ onComplete }: Props) {
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const [phase, setPhase] = useState<"speech" | "operation">("speech");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play voice at speech phase start (only stop on unmount, not phase change)
  useEffect(() => {
    if (phase !== "speech") return;
    playSequence([
      { id: "CIN-D11-001", delayAfter: 400 },
      { id: "CIN-D11-002" },
    ]).catch(() => {});
  }, [phase]);

  // Stop audio on unmount only
  useEffect(() => {
    return () => { stopCurrentAudio(); };
  }, []);

  const narrationLines: NarrationLine[] = useMemo(
    () => [
      { text: "Day 11.", fontSize: 20, bold: true, delay: 1200 },
      { text: "I'm going to be brief.", delay: 800 },
      {
        text: "You know what to do. Go do it.",
        bold: true,
        delay: 1200,
      },
    ],
    [],
  );

  const handleNarrationComplete = useCallback(() => {
    timerRef.current = setTimeout(() => setPhase("operation"), 1200);
  }, []);

  const handleAccept = () => {
    stopCurrentAudio();
    markPlayed(11);
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
          dayNumber={11}
          operationName="SELF-DIRECTED"
          operationSubtitle="The protocol trusts you. For today."
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
