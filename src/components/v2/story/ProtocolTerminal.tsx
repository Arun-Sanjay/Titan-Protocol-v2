/**
 * ProtocolTerminal — Reusable terminal typing animation.
 *
 * Displays lines one by one with a typing effect.
 * Supports: colored words, flash effects, configurable speed.
 */

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, fonts } from "../../../theme";

export type TerminalLine = {
  text: string;
  color?: string;       // Override line color
  flashColor?: string;  // Brief flash on appearance (for status words)
  fontSize?: number;
  bold?: boolean;
  delay?: number;        // Extra delay before this line (ms)
  haptic?: "light" | "medium" | "heavy" | "none";
};

type Props = {
  lines: TerminalLine[];
  lineInterval?: number;   // ms between lines (default 600)
  onComplete?: () => void; // Called when all lines have appeared
  prefix?: string;         // e.g., "> " before each line
};

export function ProtocolTerminal({
  lines,
  lineInterval = 600,
  onComplete,
  prefix = "> ",
}: Props) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= lines.length) {
      onComplete?.();
      return;
    }

    const currentLine = lines[visibleCount];
    const delay = currentLine.delay ?? lineInterval;

    const timer = setTimeout(() => {
      // Haptic feedback
      const hapticType = currentLine.haptic ?? "light";
      if (hapticType !== "none") {
        const map = {
          light: Haptics.ImpactFeedbackStyle.Light,
          medium: Haptics.ImpactFeedbackStyle.Medium,
          heavy: Haptics.ImpactFeedbackStyle.Heavy,
        };
        Haptics.impactAsync(map[hapticType]);
      }

      setVisibleCount((c) => c + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [visibleCount, lines.length, lineInterval]);

  return (
    <View style={styles.container}>
      {lines.slice(0, visibleCount).map((line, i) => (
        <Animated.View key={i} entering={FadeIn.duration(200)}>
          <Text
            style={[
              styles.line,
              line.color ? { color: line.color } : undefined,
              line.fontSize ? { fontSize: line.fontSize } : undefined,
              line.bold ? { fontWeight: "800" } : undefined,
            ]}
          >
            {prefix}{line.text}
          </Text>
        </Animated.View>
      ))}

      {/* Blinking cursor */}
      {visibleCount < lines.length && (
        <Animated.Text entering={FadeIn.duration(100)} style={styles.cursor}>
          {prefix}_
        </Animated.Text>
      )}
    </View>
  );
}

/**
 * ProtocolNarration — Fade-in narration lines (not terminal style).
 * Used for Protocol's "speech" moments.
 */

export type NarrationLine = {
  text: string;
  color?: string;
  fontSize?: number;
  italic?: boolean;
  delay?: number;    // Delay before this line appears
  bold?: boolean;
};

type NarrationProps = {
  lines: NarrationLine[];
  baseDelay?: number;   // Starting delay before first line
  lineGap?: number;     // Gap between lines (ms)
  onComplete?: () => void;
};

export function ProtocolNarration({
  lines,
  baseDelay = 0,
  lineGap = 800,
  onComplete,
}: NarrationProps) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= lines.length) {
      onComplete?.();
      return;
    }

    const line = lines[visibleCount];
    const delay = visibleCount === 0
      ? baseDelay + (line.delay ?? 0)
      : (line.delay ?? lineGap);

    const timer = setTimeout(() => {
      setVisibleCount((c) => c + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [visibleCount, lines.length, baseDelay, lineGap]);

  return (
    <View style={narrationStyles.container}>
      {lines.slice(0, visibleCount).map((line, i) => (
        <Animated.Text
          key={i}
          entering={FadeIn.duration(500)}
          style={[
            narrationStyles.line,
            line.color ? { color: line.color } : undefined,
            line.fontSize ? { fontSize: line.fontSize } : undefined,
            line.italic ? { fontStyle: "italic" } : undefined,
            line.bold ? { fontWeight: "700" } : undefined,
          ]}
        >
          {line.text}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  line: {
    fontFamily: "monospace",
    fontSize: 14,
    color: colors.body,
    letterSpacing: 0.5,
    lineHeight: 22,
  },
  cursor: {
    fontFamily: "monospace",
    fontSize: 14,
    color: colors.body,
    opacity: 0.6,
  },
});

const narrationStyles = StyleSheet.create({
  container: {
    gap: 12,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  line: {
    fontSize: 16,
    fontWeight: "400",
    color: colors.text,
    textAlign: "center",
    lineHeight: 24,
  },
});
