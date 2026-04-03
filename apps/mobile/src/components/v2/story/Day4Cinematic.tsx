import React, { useState, useMemo, useRef, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { spacing } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { ProtocolNarration, type NarrationLine } from "./ProtocolTerminal";
import { OperationBriefing } from "./OperationBriefing";
import { colors } from "../../../theme";

type Props = { onComplete: () => void };

export function Day4Cinematic({ onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const [phase, setPhase] = useState<"speech" | "operation">("speech");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleNarrationComplete = useCallback(() => {
    timerRef.current = setTimeout(() => setPhase("operation"), 1200);
  }, []);

  const handleAccept = () => {
    markPlayed(4);
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
          dayNumber={4}
          operationName="THE PATTERN"
          operationSubtitle="All four engines required"
          note="Every engine must be activated today. No hiding behind strengths."
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
