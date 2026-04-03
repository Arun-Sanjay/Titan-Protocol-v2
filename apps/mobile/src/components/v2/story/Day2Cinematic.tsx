import React, { useState, useMemo, useRef, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { spacing } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";
import { ProtocolNarration, type NarrationLine } from "./ProtocolTerminal";
import { OperationBriefing } from "./OperationBriefing";
import { colors } from "../../../theme";

type Props = { onComplete: () => void };

export function Day2Cinematic({ onComplete }: Props) {
  const userName = useStoryStore((s) => s.userName) || "RECRUIT";
  const markPlayed = useStoryStore((s) => s.markCinematicPlayed);
  const [phase, setPhase] = useState<"speech" | "operation">("speech");

  const narrationLines: NarrationLine[] = useMemo(
    () => [
      { text: `${userName.toUpperCase()}. Day 2.`, fontSize: 20, bold: true, delay: 1200 },
      { text: "Yesterday's performance: NOTED.", delay: 800 },
      { text: "Today's focus: your primary engine.", delay: 800 },
      {
        text: "I'm increasing the load. Let's see if yesterday was a fluke.",
        italic: true,
        color: colors.textSecondary,
        delay: 1000,
      },
    ],
    [userName],
  );

  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const handleNarrationComplete = useCallback(() => {
    timerRef.current = setTimeout(() => setPhase("operation"), 1200);
  }, []);

  const handleAccept = () => {
    markPlayed(2);
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
          dayNumber={2}
          operationName="SYSTEMS CHECK"
          operationSubtitle="Prove yesterday wasn't luck"
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
