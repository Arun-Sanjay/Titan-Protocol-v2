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
 * Day 13 — "The Eve"
 * Tomorrow is the Day 14 evaluation. Builds tension and anticipation.
 */
export function Day13Cinematic({ onComplete }: Props) {
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const [phase, setPhase] = useState<"speech" | "operation">("speech");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play voice at speech phase start
  useEffect(() => {
    if (phase === "speech") {
      playSequence([
        { id: "CIN-D13-001", delayAfter: 400 },
        { id: "CIN-D13-002", delayAfter: 300 },
        { id: "CIN-D13-003" },
      ]).catch(() => {});
    }
    return () => { stopCurrentAudio(); };
  }, [phase]);

  const narrationLines: NarrationLine[] = useMemo(
    () => [
      { text: "Day 13. Tomorrow is day fourteen.", fontSize: 18, bold: true, delay: 1200 },
      { text: "Two full weeks.", delay: 800 },
      { text: "The protocol will evaluate everything. Every score. Every missed day. Every engine.", delay: 1000 },
      {
        text: "Make today count. Tomorrow, I judge.",
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
    markPlayed(13);
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
          dayNumber={13}
          operationName="THE EVE"
          operationSubtitle="Tomorrow, the protocol evaluates"
          note="Day 14 evaluation is tomorrow. Protocol will judge your entire two-week performance."
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
