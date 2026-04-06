import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts } from "../../../theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const TAGLINE_1 = "Your performance operating system.";
const TAGLINE_2 = "Four engines. One mission.";
const FULL_TAGLINE = TAGLINE_1 + "\n" + TAGLINE_2;

type Props = { onNext: () => void };

export function StepWelcome({ onNext }: Props) {
  // ── Phase 1: Logo shared values ──
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.7);
  const logoLetterSpacing = useSharedValue(16);

  // ── Phase 2: Divider width ──
  const dividerWidth = useSharedValue(0);

  // ── Phase 3: Typewriter state ──
  const [typedCount, setTypedCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Phase 4: Scan line ──
  const scanY = useSharedValue(-1);
  const scanOpacity = useSharedValue(0.12);

  // ── Phase 5: Ambient glow ──
  const glowOpacity = useSharedValue(0);

  // ── Kick off all phases on mount ──
  useEffect(() => {
    // Phase 1 — Logo reveal (200ms delay, 800ms duration)
    const cubicOut = Easing.out(Easing.cubic);
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 800, easing: cubicOut }));
    logoScale.value = withDelay(200, withTiming(1, { duration: 800, easing: cubicOut }));
    logoLetterSpacing.value = withDelay(200, withTiming(8, { duration: 800, easing: cubicOut }));

    // Phase 2 — Divider width (1000ms delay)
    dividerWidth.value = withDelay(1000, withTiming(40, { duration: 500, easing: cubicOut }));

    // Phase 3 — Typewriter (starts at 1400ms)
    const typewriterTimeout = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setTypedCount((prev) => {
          const next = prev + 1;
          if (next >= FULL_TAGLINE.length) {
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
          return next;
        });
      }, 30);
    }, 1400);

    // Phase 4 — Scan line (2800ms delay)
    scanOpacity.value = withDelay(2800, withTiming(0.12, { duration: 0 }));
    scanY.value = withDelay(
      2800,
      withTiming(SCREEN_HEIGHT, { duration: 1200, easing: Easing.linear }),
    );
    scanOpacity.value = withDelay(
      3600,
      withTiming(0, { duration: 400, easing: Easing.linear }),
    );

    // Phase 5 — Ambient glow (3000ms delay, repeating pulse)
    glowOpacity.value = withDelay(
      3000,
      withRepeat(
        withSequence(
          withTiming(0.12, { duration: 2000 }),
          withTiming(0.04, { duration: 2000 }),
        ),
        -1,
        true,
      ),
    );

    return () => {
      clearTimeout(typewriterTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Animated styles ──
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
    letterSpacing: logoLetterSpacing.value,
  }));

  const dividerStyle = useAnimatedStyle(() => ({
    width: dividerWidth.value,
  }));

  const scanLineStyle = useAnimatedStyle(() => ({
    opacity: scanOpacity.value,
    transform: [{ translateY: scanY.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // ── Button handler ──
  const handleBegin = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onNext();
  }, [onNext]);

  // ── Derived tagline text ──
  const visibleText = FULL_TAGLINE.slice(0, typedCount);

  return (
    <View style={styles.container}>
      {/* Phase 4 — Scan line (absolute, behind everything) */}
      <Animated.View style={[styles.scanLine, scanLineStyle]} />

      {/* Phase 5 — Ambient glow */}
      <Animated.View style={[styles.glow, glowStyle]} />

      {/* Center content cluster */}
      <View style={styles.center}>
        {/* Phase 1 — TITAN logo */}
        <Animated.Text style={[styles.logo, logoStyle]}>TITAN</Animated.Text>

        {/* Phase 2 — PROTOCOL subtitle */}
        <Animated.Text entering={FadeIn.delay(800).duration(500)} style={styles.subtitle}>
          PROTOCOL
        </Animated.Text>

        {/* Phase 2 — Divider */}
        <Animated.View style={[styles.divider, dividerStyle]} />

        {/* Phase 3 — Typewriter tagline */}
        <Text style={styles.tagline}>
          {visibleText}
          {typedCount < FULL_TAGLINE.length && <Text style={styles.cursor}>|</Text>}
        </Text>
      </View>

      {/* Phase 6 — BEGIN SETUP button */}
      <Animated.View entering={FadeInDown.delay(3200).duration(400)}>
        <Pressable style={styles.btn} onPress={handleBegin}>
          <Text style={styles.btnText}>BEGIN SETUP</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["3xl"],
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Phase 1 — Logo
  logo: {
    fontSize: 56,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
  },

  // Phase 2 — Subtitle + Divider
  subtitle: {
    fontSize: 20,
    fontWeight: "300",
    letterSpacing: 12,
    color: colors.textSecondary,
    textTransform: "uppercase",
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.30)",
    marginVertical: spacing.xl,
  },

  // Phase 3 — Tagline
  tagline: {
    ...fonts.body,
    color: colors.textSecondary,
    textAlign: "center",
    minHeight: 52,
  },
  cursor: {
    color: "rgba(255,255,255,0.40)",
  },

  // Phase 4 — Scan line
  scanLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  // Phase 5 — Ambient glow
  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.primary,
    alignSelf: "center",
    top: SCREEN_HEIGHT * 0.3,
  },

  // Phase 6 — Button
  btn: {
    backgroundColor: colors.warning,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    alignItems: "center",
    alignSelf: "stretch",
    width: "100%",
  },
  btnText: {
    ...fonts.kicker,
    fontSize: 13,
    color: "#000",
    letterSpacing: 2,
  },
});
