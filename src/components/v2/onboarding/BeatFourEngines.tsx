import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fonts, radius } from "../../../theme";
import {
  playVoiceLineAsync,
  stopCurrentAudio,
} from "../../../lib/protocol-audio";

type Props = { onComplete: () => void };

// ── Engine definitions ──
const ENGINES = [
  { key: "body", label: "BODY", desc: "Physical capacity", icon: "shield" as const, color: "#00FF88", offsetY: -70 },
  { key: "mind", label: "MIND", desc: "Intellectual edge", icon: "bulb" as const, color: "#A78BFA", offsetX: -70 },
  { key: "money", label: "MONEY", desc: "Financial system", icon: "trending-up" as const, color: "#FBBF24", offsetX: 70 },
  { key: "charisma", label: "CHARISMA", desc: "Social influence", icon: "flash" as const, color: "#60A5FA", offsetY: 70 },
] as const;

// Timing: synced to ONBO-004 voice line when each engine name is spoken (ms)
// Audio analysis timestamps (normal speed): Body 1.834s, Mind 2.368s, Money 2.914s, Charisma 3.344s
const ENGINE_TIMINGS = [1834, 2368, 2914, 3344];

// ── Typewriter label that types out character by character ──
function TypewriterLabel({
  text,
  color,
  active,
  charDelayMs = 30,
}: {
  text: string;
  color: string;
  active: boolean;
  charDelayMs?: number;
}) {
  const [displayed, setDisplayed] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      setDisplayed("");
      return;
    }

    let index = 0;
    setDisplayed("");

    intervalRef.current = setInterval(() => {
      index++;
      setDisplayed(text.slice(0, index));
      if (index >= text.length && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, charDelayMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, text, charDelayMs]);

  if (!active && displayed === "") return null;

  return (
    <View style={styles.labelContainer}>
      <Text style={[styles.typewriterLabel, { color }]}>
        {displayed}
        {displayed.length < text.length && (
          <Text style={styles.cursor}>_</Text>
        )}
      </Text>
    </View>
  );
}

// ── Description text that fades in below the engine name ──
function DescriptionText({
  text,
  color,
  visible,
}: {
  text: string;
  color: string;
  visible: boolean;
}) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Fade in after a short delay (let typewriter finish first)
      opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    } else {
      // Fade out when next engine lights
      opacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.descContainer, animStyle]}>
      <Text style={[styles.descText, { color }]}>{text}</Text>
    </Animated.View>
  );
}

function EngineIcon({
  icon,
  label,
  desc,
  color,
  offsetX = 0,
  offsetY = 0,
  delayMs,
  nextDelayMs,
}: {
  icon: "shield" | "bulb" | "trending-up" | "flash";
  label: string;
  desc: string;
  color: string;
  offsetX?: number;
  offsetY?: number;
  delayMs: number;
  nextDelayMs: number | null; // null for last engine
}) {
  const opacity = useSharedValue(0.15);
  const glowOpacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  // Pulse ring for flash effect on light-up
  const pulseRingScale = useSharedValue(1.0);
  const pulseRingOpacity = useSharedValue(0);
  const [isLit, setIsLit] = useState(false);
  const [showDesc, setShowDesc] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    const lightUpTimer = setTimeout(() => {
      // Haptic feedback on illumination
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      setIsLit(true);
      setShowDesc(true);

      // INSTANT light-up: 150ms instead of 600ms
      opacity.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
      });
      glowOpacity.value = withSequence(
        withTiming(0.6, { duration: 100 }),
        withTiming(0.2, { duration: 300 }),
      );

      // Initial pop then sustained subtle pulse (1.0 -> 1.05 -> 1.0 repeating)
      scale.value = withSequence(
        withTiming(1.15, {
          duration: 150,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(1.0, {
          duration: 200,
          easing: Easing.inOut(Easing.cubic),
        }),
        withRepeat(
          withSequence(
            withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.0, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        ),
      );

      // Sustained glow pulse while engine is being described
      glowOpacity.value = withSequence(
        withTiming(0.6, { duration: 100 }),
        withTiming(0.2, { duration: 300 }),
        withRepeat(
          withSequence(
            withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        ),
      );

      // Flash pulse ring: scales from 1.0 to 1.5 and fades out
      pulseRingOpacity.value = withSequence(
        withTiming(0.6, { duration: 80 }),
        withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }),
      );
      pulseRingScale.value = withSequence(
        withTiming(1.0, { duration: 0 }),
        withTiming(1.5, { duration: 400, easing: Easing.out(Easing.cubic) }),
      );
    }, delayMs);
    timers.push(lightUpTimer);

    // When the NEXT engine lights up, fade out description and stop pulse
    if (nextDelayMs !== null) {
      const fadeDescTimer = setTimeout(() => {
        setShowDesc(false);
        // Settle to steady glow (no more pulse)
        scale.value = withTiming(1.0, { duration: 300, easing: Easing.inOut(Easing.cubic) });
        glowOpacity.value = withTiming(0.12, { duration: 300 });
      }, nextDelayMs);
      timers.push(fadeDescTimer);
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  const circleStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    borderColor: color,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    backgroundColor: color,
  }));

  const pulseRingStyle = useAnimatedStyle(() => ({
    opacity: pulseRingOpacity.value,
    transform: [{ scale: pulseRingScale.value }],
    borderColor: color,
  }));

  return (
    <View
      style={[
        styles.engineNode,
        { transform: [{ translateX: offsetX }, { translateY: offsetY }] },
      ]}
    >
      {/* Glow behind circle */}
      <Animated.View style={[styles.engineGlow, glowStyle]} />

      {/* Pulse ring (flash effect on light-up) */}
      <Animated.View style={[styles.pulseRing, pulseRingStyle]} />

      {/* Circle with icon */}
      <Animated.View style={[styles.engineCircle, circleStyle]}>
        <Ionicons name={icon} size={24} color={color} />
      </Animated.View>

      {/* Typewriter label below icon -- appears on illumination */}
      <TypewriterLabel text={label} color={color} active={isLit} />

      {/* Description text -- fades in on light, fades out when next engine lights */}
      <DescriptionText text={desc} color={color} visible={showDesc} />
    </View>
  );
}

export function BeatFourEngines({ onComplete }: Props) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Network lines + center glow (appear after all 4 engines lit)
  const networkOpacity = useSharedValue(0);
  const centerGlowOpacity = useSharedValue(0);
  const titanScoreOpacity = useSharedValue(0);
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

    // Play the four engines voice line
    playVoiceLineAsync("ONBO-004");

    // After all 4 lit: draw network lines + center glow (voice says "Titan Score" ~8.5s)
    t(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      networkOpacity.value = withTiming(0.5, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });
      centerGlowOpacity.value = withTiming(0.4, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });
    }, 8200);

    // "TITAN SCORE" fades in alongside network lines
    t(() => {
      titanScoreOpacity.value = withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });
    }, 8200);

    // Tap hint at 6s
    t(() => {
      tapHintOpacity.value = withTiming(0.1, { duration: 600 });
    }, 6000);

    // Auto-advance at 12s (voice ends ~9.2s + buffer)
    t(() => {
      stopCurrentAudio();
      onComplete();
    }, 12000);

    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const networkStyle = useAnimatedStyle(() => ({
    opacity: networkOpacity.value,
  }));

  const centerGlowStyle = useAnimatedStyle(() => ({
    opacity: centerGlowOpacity.value,
  }));

  const titanScoreStyle = useAnimatedStyle(() => ({
    opacity: titanScoreOpacity.value,
  }));

  const tapHintStyle = useAnimatedStyle(() => ({
    opacity: tapHintOpacity.value,
  }));

  return (
    <Pressable style={styles.container} onPress={handleTap}>
      {/* Diamond formation of engine icons */}
      <View style={styles.diamondContainer}>
        {/* Network lines (SVG-free: just 4 thin rotated View lines) */}
        <Animated.View style={[styles.networkLines, networkStyle]}>
          {/* Top to left */}
          <View
            style={[
              styles.netLine,
              {
                width: 100,
                transform: [{ rotate: "45deg" }],
                top: -5,
                left: -50,
              },
            ]}
          />
          {/* Top to right */}
          <View
            style={[
              styles.netLine,
              {
                width: 100,
                transform: [{ rotate: "-45deg" }],
                top: -5,
                right: -50,
              },
            ]}
          />
          {/* Bottom to left */}
          <View
            style={[
              styles.netLine,
              {
                width: 100,
                transform: [{ rotate: "-45deg" }],
                bottom: -5,
                left: -50,
              },
            ]}
          />
          {/* Bottom to right */}
          <View
            style={[
              styles.netLine,
              {
                width: 100,
                transform: [{ rotate: "45deg" }],
                bottom: -5,
                right: -50,
              },
            ]}
          />
        </Animated.View>

        {/* Center glow dot */}
        <Animated.View style={[styles.centerGlow, centerGlowStyle]} />

        {/* Engine icons in diamond: top, left, right, bottom */}
        {ENGINES.map((eng, i) => (
          <EngineIcon
            key={eng.key}
            icon={eng.icon}
            label={eng.label}
            desc={eng.desc}
            color={eng.color}
            offsetX={"offsetX" in eng ? eng.offsetX : 0}
            offsetY={"offsetY" in eng ? eng.offsetY : 0}
            delayMs={ENGINE_TIMINGS[i]}
            nextDelayMs={i < ENGINE_TIMINGS.length - 1 ? ENGINE_TIMINGS[i + 1] : null}
          />
        ))}
      </View>

      {/* TITAN SCORE text below diamond */}
      <Animated.Text style={[styles.titanScore, titanScoreStyle]}>
        TITAN SCORE
      </Animated.Text>

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

  // ── Diamond formation ──
  diamondContainer: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  engineNode: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  engineCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    justifyContent: "center",
    alignItems: "center",
  },
  engineGlow: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
  },

  // ── Pulse ring (flash on light-up) ──
  pulseRing: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    backgroundColor: "transparent",
  },

  // ── Typewriter label ──
  labelContainer: {
    marginTop: 6,
    height: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  typewriterLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  cursor: {
    opacity: 0.6,
  },

  // ── Description text ──
  descContainer: {
    marginTop: 2,
    height: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  descText: {
    fontSize: 8,
    fontWeight: "500",
    letterSpacing: 0.5,
    opacity: 0.7,
  },

  // ── Network lines ──
  networkLines: {
    position: "absolute",
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  netLine: {
    position: "absolute",
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },

  // ── Center glow ──
  centerGlow: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },

  // ── TITAN SCORE ──
  titanScore: {
    marginTop: 80,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 4,
    textTransform: "uppercase",
  },

  // ── Tap hint ──
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
