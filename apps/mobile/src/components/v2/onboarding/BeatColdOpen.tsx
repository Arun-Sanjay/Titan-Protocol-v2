import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing } from "../../../theme";
import { playVoiceLineAsync } from "../../../lib/protocol-audio";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Props = { onComplete: () => void };

export function BeatColdOpen({ onComplete }: Props) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Shared values ──
  const scanY = useSharedValue(0);
  const scanOpacity = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    const t = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timers.current.push(id);
      return id;
    };

    // ── 1.5s: Play "Titan Protocol." + scan line sweep ──
    t(() => {
      playVoiceLineAsync("ONBO-001");
      scanOpacity.value = 1;
      scanY.value = withTiming(SCREEN_HEIGHT, {
        duration: 1500,
        easing: Easing.linear,
      });
    }, 1500);

    // Fade scan line out at end of sweep
    t(() => {
      scanOpacity.value = withTiming(0, { duration: 300 });
    }, 2800);

    // ── 3.0s: Logo fades in with subtle glow pulse ──
    t(() => {
      logoOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.25, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.08, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    }, 3000);

    // ── 5.0s: Play "Activated." + logo flare + heavy haptic ──
    t(() => {
      playVoiceLineAsync("ONBO-002");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      logoScale.value = withSequence(
        withTiming(1.05, { duration: 200, easing: Easing.out(Easing.cubic) }),
        withTiming(1.0, { duration: 300, easing: Easing.inOut(Easing.cubic) }),
      );
    }, 5000);

    // ── 6.5s: Hold with breathing glow (already running) ──

    // ── 7.5s: Logo fades out, call onComplete ──
    t(() => {
      logoOpacity.value = withTiming(0, { duration: 400 });
      glowOpacity.value = withTiming(0, { duration: 400 });
    }, 7500);

    t(() => {
      onComplete();
    }, 8000);

    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // ── Animated styles ──
  const scanLineStyle = useAnimatedStyle(() => ({
    opacity: scanOpacity.value,
    transform: [{ translateY: scanY.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Scan line */}
      <Animated.View style={[styles.scanLine, scanLineStyle]} />

      {/* Center glow behind logo */}
      <Animated.View style={[styles.glow, glowStyle]} />

      {/* Logo */}
      <View style={styles.center}>
        <Animated.Text style={[styles.logo, logoStyle]}>
          TITAN PROTOCOL
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 6,
    textTransform: "uppercase",
    textAlign: "center",
    textShadowColor: "rgba(255, 255, 255, 0.40)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  scanLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#00FF88",
  },
  glow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(0, 255, 136, 0.15)",
    alignSelf: "center",
  },
});
