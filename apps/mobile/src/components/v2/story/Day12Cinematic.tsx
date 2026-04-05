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
 * Day 12 — "The Pressure Test"
 * Protocol raises expectations. Every metric must go up today.
 */
export function Day12Cinematic({ onComplete }: Props) {
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const [phase, setPhase] = useState<"speech" | "operation">("speech");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play voice at speech phase start
  useEffect(() => {
    if (phase === "speech") {
      playSequence([
        { id: "CIN-D12-001", delayAfter: 400 },
        { id: "CIN-D12-002", delayAfter: 300 },
        { id: "CIN-D12-003" },
      ]).catch(() => {});
    }
    return () => { stopCurrentAudio(); };
  }, [phase]);

  const narrationLines: NarrationLine[] = useMemo(
    () => [
      { text: "Day 12. I'm raising the bar.", fontSize: 18, bold: true, delay: 1200 },
      { text: "Your consistency rate. Your engine scores. Your streak.", delay: 800 },
      { text: "I want all of them higher today.", bold: true, delay: 800 },
      {
        text: "The protocol doesn't plateau. Neither should you.",
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
    markPlayed(12);
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
          dayNumber={12}
          operationName="PRESSURE TEST"
          operationSubtitle="Every metric goes up today"
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
