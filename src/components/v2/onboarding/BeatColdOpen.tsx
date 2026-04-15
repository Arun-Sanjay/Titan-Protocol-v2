import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing } from "../../../theme";
import { playVoiceLine } from "../../../lib/protocol-audio";

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
    return () => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);
    };
  }, [translateX, translateY, driftX, driftY, duration]);

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

// Phase 4.2: helper — promisified delay for async sequencing
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function BeatColdOpen({ onComplete }: Props) {
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
  const activatedOpacity = useSharedValue(0);

  // Phase 4.2: audio-driven sequence — text appears synced to voice lines.
  // playVoiceLine returns a Promise that resolves when the audio finishes,
  // so each visual beat waits for the voice before advancing.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // ── Scan line sweep (immediate) ──
      scanOpacity.value = 1;
      scanY.value = withTiming(SCREEN_HEIGHT, {
        duration: 1200,
        easing: Easing.linear,
      });

      await delay(800);
      if (cancelled) return;

      // ── "WELCOME TO" subtitle + scan still sweeping ──
      welcomeOpacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });

      await delay(500);
      if (cancelled) return;

      // ── "TITAN PROTOCOL" scales in + ONBO-001 plays (voice says "Titan Protocol.") ──
      logoOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
      logoScale.value = withTiming(1.0, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });

      // Start glow effects
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.25, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.08, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
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

      // Voice: "Titan Protocol." — wait for it to finish
      await playVoiceLine("ONBO-001");
      if (cancelled) return;

      // Scan fades out after voice
      scanOpacity.value = withTiming(0, { duration: 300 });

      await delay(600);
      if (cancelled) return;

      // ── "ACTIVATED" subtitle + ONBO-002 plays + haptic + logo flare ──
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      activatedOpacity.value = withTiming(1, { duration: 200 });
      logoScale.value = withSequence(
        withTiming(1.05, { duration: 200, easing: Easing.out(Easing.cubic) }),
        withTiming(1.0, { duration: 300, easing: Easing.inOut(Easing.cubic) }),
      );

      // Voice: "Activated." — wait for it to finish
      await playVoiceLine("ONBO-002");
      if (cancelled) return;

      // ── Hold with breathing glow ──
      await delay(1500);
      if (cancelled) return;

      // ── Fade out everything + onComplete ──
      welcomeOpacity.value = withTiming(0, { duration: 400 });
      logoOpacity.value = withTiming(0, { duration: 400 });
      glowOpacity.value = withTiming(0, { duration: 400 });
      glowRingOpacity.value = withTiming(0, { duration: 400 });
      activatedOpacity.value = withTiming(0, { duration: 400 });

      await delay(500);
      if (!cancelled) onComplete();
    };

    run();

    return () => {
      cancelled = true;
      cancelAnimation(scanY);
      cancelAnimation(scanOpacity);
      cancelAnimation(welcomeOpacity);
      cancelAnimation(logoOpacity);
      cancelAnimation(logoScale);
      cancelAnimation(glowOpacity);
      cancelAnimation(glowRingOpacity);
      cancelAnimation(glowRingScale);
      cancelAnimation(activatedOpacity);
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

  const activatedStyle = useAnimatedStyle(() => ({
    opacity: activatedOpacity.value,
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

        {/* "TITAN PROTOCOL" text — synced to ONBO-001 */}
        <Animated.Text style={[styles.logo, logoStyle]}>
          TITAN PROTOCOL
        </Animated.Text>

        {/* "ACTIVATED" subtitle — synced to ONBO-002 */}
        <Animated.Text style={[styles.activatedText, activatedStyle]}>
          ACTIVATED
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
  activatedText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.success,
    letterSpacing: 4,
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: 16,
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
