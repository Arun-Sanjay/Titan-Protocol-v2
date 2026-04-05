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
 * Day 8 — "The Honeymoon's Over"
 * First day after induction week. Protocol drops the training wheels.
 */
export function Day8Cinematic({ onComplete }: Props) {
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const [phase, setPhase] = useState<"speech" | "operation">("speech");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play voice at speech phase start
  useEffect(() => {
    if (phase === "speech") {
      playSequence([
        { id: "CIN-D8-001", delayAfter: 400 },
        { id: "CIN-D8-002", delayAfter: 300 },
        { id: "CIN-D8-003" },
      ]).catch(() => {});
    }
    return () => { stopCurrentAudio(); };
  }, [phase]);

  const narrationLines: NarrationLine[] = useMemo(
    () => [
      { text: "Day 8. The first week is over.", fontSize: 18, bold: true, delay: 1200 },
      { text: "The excitement's gone.", delay: 800 },
      { text: "From now on, the protocol doesn't hold your hand.", delay: 800 },
      { text: "You show up, or you don't.", bold: true, delay: 800 },
      {
        text: "This is where it gets real.",
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
    markPlayed(8);
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
          dayNumber={8}
          operationName="NO SAFETY NET"
          operationSubtitle="The hand-holding stops here"
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
