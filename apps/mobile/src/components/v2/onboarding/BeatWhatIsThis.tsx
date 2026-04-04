import React, { useEffect, useRef, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { colors, spacing, fonts, radius } from "../../../theme";
import {
  playVoiceLineAsync,
  stopCurrentAudio,
} from "../../../lib/protocol-audio";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const PARTICLE_COUNT = 12;

type Props = { onComplete: () => void };

// ── Simple particle data (fixed positions, drifting opacity) ──
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  left: Math.random() * SCREEN_WIDTH,
  top: Math.random() * SCREEN_HEIGHT,
  size: 1 + Math.random() * 2,
  delay: Math.random() * 3000,
}));

function Particle({
  left,
  top,
  size,
  delay,
}: {
  left: number;
  top: number;
  size: number;
  delay: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    // Gentle float + fade loop
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(0.4, { duration: 2000 + delay, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2000 + delay, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    translateY.value = withRepeat(
      withSequence(
        withTiming(-20 - Math.random() * 30, {
          duration: 4000 + delay,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: 4000 + delay,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      true,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        { left, top, width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

// ── Text lines with timing ──
const LINES: { text: string; startMs: number; holdMs: number; emphasis?: boolean }[] = [
  {
    text: "You've been selected for something\nmost people will never see.",
    startMs: 0,
    holdMs: 4000,
  },
  {
    text: "A personal operating system.",
    startMs: 5000,
    holdMs: 3000,
  },
  {
    text: "It tracks. It assigns. It pushes.",
    startMs: 9000,
    holdMs: 3000,
  },
  {
    text: "This is not an app.\nThis is a system.",
    startMs: 13000,
    holdMs: 4000,
    emphasis: true,
  },
];

function TimedLine({
  text,
  startMs,
  holdMs,
  emphasis,
}: {
  text: string;
  startMs: number;
  holdMs: number;
  emphasis?: boolean;
}) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    const fadeIn = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    }, startMs);

    const fadeOut = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) });
    }, startMs + holdMs);

    return () => {
      clearTimeout(fadeIn);
      clearTimeout(fadeOut);
    };
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.Text
      style={[
        styles.lineText,
        emphasis && styles.lineTextEmphasis,
        animStyle,
      ]}
    >
      {text}
    </Animated.Text>
  );
}

export function BeatWhatIsThis({ onComplete }: Props) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tapHintOpacity = useSharedValue(0);

  const handleTap = useCallback(() => {
    stopCurrentAudio();
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const t = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timers.current.push(id);
      return id;
    };

    // Play the full briefing voice line on mount
    playVoiceLineAsync("ONBO-003");

    // Show tap hint after 5s
    t(() => {
      tapHintOpacity.value = withTiming(0.10, { duration: 600 });
    }, 5000);

    // Auto-advance after 20s
    t(() => {
      stopCurrentAudio();
      onComplete();
    }, 20000);

    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const tapHintStyle = useAnimatedStyle(() => ({
    opacity: tapHintOpacity.value,
  }));

  return (
    <Pressable style={styles.container} onPress={handleTap}>
      {/* Sparse particle background */}
      {particles.map((p, i) => (
        <Particle key={i} {...p} />
      ))}

      {/* Timed text lines — stacked at center */}
      <View style={styles.textContainer}>
        {LINES.map((line, i) => (
          <TimedLine key={i} {...line} />
        ))}
      </View>

      {/* Tap hint */}
      <Animated.Text style={[styles.tapHint, tapHintStyle]}>
        TAP TO CONTINUE {">"}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  particle: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
  },
  textContainer: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  lineText: {
    position: "absolute",
    fontSize: 18,
    fontWeight: "400",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 28,
    letterSpacing: 0.5,
    fontFamily: undefined, // uses system monospace-ish default
  },
  lineTextEmphasis: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
    lineHeight: 32,
  },
  tapHint: {
    position: "absolute",
    bottom: spacing["5xl"],
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
});
