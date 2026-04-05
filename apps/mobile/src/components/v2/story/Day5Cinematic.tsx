import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { spacing } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { ProtocolNarration, type NarrationLine } from "./ProtocolTerminal";
import { OperationBriefing } from "./OperationBriefing";
import { colors } from "../../../theme";
import { playSequence, stopCurrentAudio } from "../../../lib/protocol-audio";

type Props = { onComplete: () => void };

export function Day5Cinematic({ onComplete }: Props) {
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const [phase, setPhase] = useState<"speech" | "operation">("speech");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play voice at speech phase start (only stop on unmount, not phase change)
  useEffect(() => {
    if (phase !== "speech") return;
    playSequence([
      { id: "CIN-D5-001", delayAfter: 400 },
      { id: "CIN-D5-002" },
    ]).catch(() => {});
  }, [phase]);

  // Stop audio on unmount only
  useEffect(() => {
    return () => { stopCurrentAudio(); };
  }, []);

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

  const handleNarrationComplete = useCallback(() => {
    timerRef.current = setTimeout(() => setPhase("operation"), 1200);
  }, []);

  const handleAccept = () => {
    stopCurrentAudio();
    markPlayed(5);
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
          dayNumber={5}
          operationName="THE TEST"
          operationSubtitle="Build your own mission"
          note="No suggested missions today. Protocol is watching to see if you can create your own objectives. Add tasks to your engines, then complete them."
          buttonText="I'M READY"
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
