import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import {
  playVoiceLineAsync,
  stopCurrentAudio,
  getArchetypeVoiceId,
} from "../../../lib/protocol-audio";

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  archetype: string;
  onComplete: () => void;
};

// ─── Data ────────────────────────────────────────────────────────────────────

const SUBTITLES: Record<string, string> = {
  titan: "MASTER OF ALL DOMAINS",
  athlete: "THE PHYSICAL ENGINE",
  scholar: "THE STRATEGIC MIND",
  hustler: "THE EMPIRE BUILDER",
  showman: "THE FORCE OF PRESENCE",
  warrior: "BODY + MIND FORGED",
  founder: "THE SYSTEM ARCHITECT",
  charmer: "THE SOCIAL STRATEGIST",
};

const WEIGHTS: Record<string, Record<string, number>> = {
  titan: { body: 25, mind: 25, money: 25, charisma: 25 },
  athlete: { body: 40, mind: 20, money: 15, charisma: 25 },
  scholar: { body: 15, mind: 40, money: 20, charisma: 25 },
  hustler: { body: 15, mind: 20, money: 40, charisma: 25 },
  showman: { body: 15, mind: 20, money: 25, charisma: 40 },
  warrior: { body: 35, mind: 30, money: 15, charisma: 20 },
  founder: { body: 15, mind: 25, money: 35, charisma: 25 },
  charmer: { body: 15, mind: 20, money: 25, charisma: 40 },
};

const ENGINE_LABELS: Record<string, string> = {
  body: "BODY",
  mind: "MIND",
  money: "MONEY",
  charisma: "CHARM",
};

const ENGINE_COLORS: Record<string, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  charisma: colors.charisma,
};

const ENGINE_ORDER = ["body", "mind", "money", "charisma"];

// ─── Timing Constants ────────────────────────────────────────────────────────

const PHASE_1_START = 0;
const PHASE_2_START = 2000;
const PHASE_3_START = 4000;
const BAR_START_OFFSET = 1200; // After name slam + voice starts
const BAR_FILL_MS = 500;
const BAR_STAGGER_MS = 400;
const CONTINUE_APPEAR_MS = 3000; // After phase 3 start

// ─── Component ───────────────────────────────────────────────────────────────

export function BeatReveal({ archetype, onComplete }: Props) {
  const [phase, setPhase] = useState(1);
  const [confirmTypedChars, setConfirmTypedChars] = useState(0);
  const [showName, setShowName] = useState(false);
  const [showBars, setShowBars] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const archetypeKey = archetype.toLowerCase();
  const subtitle = SUBTITLES[archetypeKey] ?? "THE PROTOCOL ADAPTS";
  const weights = WEIGHTS[archetypeKey] ?? WEIGHTS.titan;

  // Name slam animation
  const nameScale = useSharedValue(1.3);
  const nameOpacity = useSharedValue(0);

  const nameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nameScale.value }],
    opacity: nameOpacity.value,
  }));

  // Particle burst shared values
  const particleOpacity = useSharedValue(0);
  const particleScale = useSharedValue(0.5);

  const particleStyle = useAnimatedStyle(() => ({
    opacity: particleOpacity.value,
    transform: [{ scale: particleScale.value }],
  }));

  // Continue button pulse
  const continuePulse = useSharedValue(1);
  const continueStyle = useAnimatedStyle(() => ({
    opacity: continuePulse.value,
  }));

  // Bar fill values - one per engine
  const barWidths = ENGINE_ORDER.map(() => useSharedValue(0));

  const CONFIRM_TEXT = "IDENTITY CONFIRMED";

  // Cleanup
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      stopCurrentAudio();
    };
  }, []);

  // Phase 1: "IDENTITY CONFIRMED" types out
  useEffect(() => {
    playVoiceLineAsync("ONBO-009");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Type out character by character
    const typeChars = () => {
      for (let i = 0; i <= CONFIRM_TEXT.length; i++) {
        const t = setTimeout(() => setConfirmTypedChars(i), 500 + i * 50);
        timeoutsRef.current.push(t);
      }
    };
    typeChars();
  }, []);

  // Phase 2: Black screen pause at 2s
  useEffect(() => {
    const t = setTimeout(() => setPhase(2), PHASE_2_START);
    timeoutsRef.current.push(t);
  }, []);

  // Phase 3: Name slam at 4s
  useEffect(() => {
    const t = setTimeout(() => {
      setPhase(3);
      setShowName(true);

      // Name slam: scale 1.3 -> 1.0 spring
      nameOpacity.value = withTiming(1, { duration: 100 });
      nameScale.value = withSpring(1.0, {
        damping: 12,
        stiffness: 300,
        mass: 0.5,
      });

      // Heavy haptic
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Particle burst in archetype color
      particleOpacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withDelay(400, withTiming(0, { duration: 600 })),
      );
      particleScale.value = withSequence(
        withTiming(1.0, { duration: 150 }),
        withTiming(2.5, { duration: 800, easing: Easing.out(Easing.cubic) }),
      );

      // Play archetype voice line
      playVoiceLineAsync(getArchetypeVoiceId(archetypeKey));

      // Start bar fills after a beat
      const barTimer = setTimeout(() => {
        setShowBars(true);
        ENGINE_ORDER.forEach((engine, i) => {
          const weight = weights[engine] ?? 0;
          barWidths[i].value = withDelay(
            i * BAR_STAGGER_MS,
            withTiming(weight, { duration: BAR_FILL_MS, easing: Easing.out(Easing.cubic) }),
          );
        });
      }, BAR_START_OFFSET);
      timeoutsRef.current.push(barTimer);

      // Show continue button
      const continueTimer = setTimeout(() => {
        setShowContinue(true);
        // Pulse animation
        continuePulse.value = withRepeat(
          withSequence(
            withTiming(0.5, { duration: 1200 }),
            withTiming(1, { duration: 1200 }),
          ),
          -1,
          true,
        );
      }, CONTINUE_APPEAR_MS);
      timeoutsRef.current.push(continueTimer);
    }, PHASE_3_START);
    timeoutsRef.current.push(t);
  }, []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete();
  };

  // ─── Phase 1: IDENTITY CONFIRMED typing ────────────────────────────────

  if (phase === 1) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.confirmText}>
            {CONFIRM_TEXT.slice(0, confirmTypedChars)}
            {confirmTypedChars < CONFIRM_TEXT.length && (
              <Text style={styles.cursor}>_</Text>
            )}
          </Text>
        </View>
      </View>
    );
  }

  // ─── Phase 2: Black screen tension ─────────────────────────────────────

  if (phase === 2) {
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        style={styles.container}
      />
    );
  }

  // ─── Phase 3+: Name slam, bars, continue ───────────────────────────────

  const primaryEngineColor = ENGINE_COLORS[
    ENGINE_ORDER.reduce((a, b) =>
      (weights[a] ?? 0) >= (weights[b] ?? 0) ? a : b,
    )
  ] ?? colors.body;

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        {/* Particle burst behind name */}
        <Animated.View
          style={[
            styles.particleBurst,
            particleStyle,
            { backgroundColor: primaryEngineColor },
          ]}
        />

        {/* Archetype name */}
        {showName && (
          <Animated.View style={nameStyle}>
            <Text style={styles.archetypeName}>
              {archetype.toUpperCase()}
            </Text>
          </Animated.View>
        )}

        {/* Subtitle */}
        {showName && (
          <Animated.Text
            entering={FadeIn.delay(400).duration(400)}
            style={styles.subtitle}
          >
            {subtitle}
          </Animated.Text>
        )}

        {/* Engine weight bars */}
        {showBars && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={styles.barsContainer}
          >
            {ENGINE_ORDER.map((engine, i) => (
              <EngineBar
                key={engine}
                label={ENGINE_LABELS[engine] ?? engine.toUpperCase()}
                color={ENGINE_COLORS[engine] ?? colors.text}
                weight={weights[engine] ?? 0}
                progress={barWidths[i]}
              />
            ))}
          </Animated.View>
        )}

        {/* Continue button */}
        {showContinue && (
          <Animated.View
            entering={FadeIn.duration(400)}
            style={styles.continueContainer}
          >
            <Pressable onPress={handleContinue}>
              <Animated.View style={[styles.continueBtn, continueStyle]}>
                <Text style={styles.continueBtnText}>CONTINUE</Text>
              </Animated.View>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

// ─── Engine Bar Sub-component ────────────────────────────────────────────────

function EngineBar({
  label,
  color,
  weight,
  progress,
}: {
  label: string;
  color: string;
  weight: number;
  progress: Animated.SharedValue<number>;
}) {
  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
    backgroundColor: color,
  }));

  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color }]}>{label}</Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, fillStyle]} />
      </View>
      <Text style={styles.barPct}>{weight}%</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const monoFont = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },

  // Phase 1: confirm text
  confirmText: {
    fontFamily: monoFont,
    fontSize: 14,
    color: colors.body,
    letterSpacing: 4,
    textAlign: "center",
  },
  cursor: {
    color: colors.body,
    fontWeight: "700",
  },

  // Phase 3: particle burst
  particleBurst: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0,
  },

  // Archetype name
  archetypeName: {
    fontSize: 36,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: 4,
    textAlign: "center",
    marginBottom: spacing.sm,
  },

  // Subtitle
  subtitle: {
    fontFamily: monoFont,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.50)",
    letterSpacing: 3,
    textAlign: "center",
    marginBottom: spacing["3xl"],
  },

  // Engine weight bars
  barsContainer: {
    width: "100%",
    maxWidth: 300,
    gap: spacing.md,
    marginBottom: spacing["2xl"],
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  barLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: "700",
    width: 52,
    letterSpacing: 1.5,
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  barPct: {
    fontFamily: monoFont,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.50)",
    width: 32,
    textAlign: "right",
  },

  // Continue button
  continueContainer: {
    position: "absolute",
    bottom: spacing["5xl"],
    left: spacing.xl,
    right: spacing.xl,
  },
  continueBtn: {
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.30)",
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  continueBtnText: {
    fontFamily: monoFont,
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 3,
  },
});
