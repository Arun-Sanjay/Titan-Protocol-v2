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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type Props = { onComplete: () => void };

// ── Particle constants ──────────────────────────────────────────────────────
const PARTICLE_COUNT = 20;

// Pre-compute random particle positions and drift offsets (deterministic per mount)
function generateParticles() {
  const particles: Array<{
    startX: number;
    startY: number;
    driftX: number;
    driftY: number;
    duration: number;
  }> = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      startX: Math.random() * SCREEN_WIDTH,
      startY: Math.random() * SCREEN_HEIGHT,
      driftX: (Math.random() - 0.5) * 60,
      driftY: (Math.random() - 0.5) * 60,
      duration: 3000 + Math.random() * 4000,
    });
  }
  return particles;
}

// ── Single animated particle ────────────────────────────────────────────────
function Particle({
  startX,
  startY,
  driftX,
  driftY,
  duration,
}: {
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  duration: number;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(driftX, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    translateY.value = withRepeat(
      withSequence(
        withTiming(driftY, { duration: duration * 1.1, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: duration * 1.1, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        { left: startX, top: startY },
        style,
      ]}
    />
  );
}

export function BeatColdOpen({ onComplete }: Props) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const particlesRef = useRef(generateParticles());

  // ── Shared values ──
  const scanY = useSharedValue(0);
  const scanOpacity = useSharedValue(0);
  const welcomeOpacity = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.6);
  const glowOpacity = useSharedValue(0);
  const glowRingOpacity = useSharedValue(0);
  const glowRingScale = useSharedValue(1);

  useEffect(() => {
    const t = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timers.current.push(id);
      return id;
    };

    // ── 1.5s: Play "Welcome to Titan Protocol." + scan line sweep ──
    t(() => {
      playVoiceLineAsync("ONBO-001");
      scanOpacity.value = 1;
      scanY.value = withTiming(SCREEN_HEIGHT, {
        duration: 1500,
        easing: Easing.linear,
      });
    }, 1500);

    // ── 2.0s: "WELCOME TO" fades in (smaller text above logo) ──
    t(() => {
      welcomeOpacity.value = withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });
    }, 2000);

    // Fade scan line out at end of sweep
    t(() => {
      scanOpacity.value = withTiming(0, { duration: 300 });
    }, 2800);

    // ── 3.0s: "TITAN PROTOCOL" scale reveal + glow pulse + glow ring ──
    t(() => {
      logoOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
      logoScale.value = withTiming(1.0, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.25, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.08, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
      // Glow ring pulsing
      glowRingOpacity.value = withRepeat(
        withSequence(
          withTiming(0.2, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.06, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
      glowRingScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.95, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
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

    // ── 7.5s: Everything fades out, call onComplete ──
    t(() => {
      welcomeOpacity.value = withTiming(0, { duration: 400 });
      logoOpacity.value = withTiming(0, { duration: 400 });
      glowOpacity.value = withTiming(0, { duration: 400 });
      glowRingOpacity.value = withTiming(0, { duration: 400 });
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

  const welcomeStyle = useAnimatedStyle(() => ({
    opacity: welcomeOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const glowRingStyle = useAnimatedStyle(() => ({
    opacity: glowRingOpacity.value,
    transform: [{ scale: glowRingScale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Particle background */}
      {particlesRef.current.map((p, i) => (
        <Particle
          key={i}
          startX={p.startX}
          startY={p.startY}
          driftX={p.driftX}
          driftY={p.driftY}
          duration={p.duration}
        />
      ))}

      {/* Scan line (green) */}
      <Animated.View style={[styles.scanLine, scanLineStyle]} />

      {/* Center glow behind logo */}
      <Animated.View style={[styles.glow, glowStyle]} />

      {/* Glow ring around logo */}
      <Animated.View style={[styles.glowRing, glowRingStyle]} />

      {/* Logo area */}
      <View style={styles.center}>
        {/* "WELCOME TO" text */}
        <Animated.Text style={[styles.welcomeText, welcomeStyle]}>
          WELCOME TO
        </Animated.Text>

        {/* "TITAN PROTOCOL" text */}
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
  welcomeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.60)",
    letterSpacing: 5,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 8,
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
  glowRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: "rgba(247, 250, 255, 0.20)",
    alignSelf: "center",
  },
  particle: {
    position: "absolute",
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
});
