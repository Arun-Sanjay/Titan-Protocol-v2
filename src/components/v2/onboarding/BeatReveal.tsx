import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
} from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  cancelAnimation,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import {
  playVoiceLineAsync,
  stopCurrentAudio,
  getArchetypeVoiceId,
} from "../../../lib/protocol-audio";

// ── Props ───────────────────────────────────────────────────────────────────

type Props = {
  archetype: string;
  onComplete: (finalArchetype: string) => void;
};

// ── Data ────────────────────────────────────────────────────────────────────

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

const ARCHETYPE_ICONS: Record<string, string> = {
  titan: "\u26A1",
  athlete: "\uD83D\uDCAA",
  scholar: "\uD83D\uDCDA",
  hustler: "\uD83D\uDCB0",
  showman: "\uD83C\uDFA4",
  warrior: "\u2694\uFE0F",
  founder: "\uD83D\uDE80",
  charmer: "\u2728",
};

const ALL_ARCHETYPES = [
  "titan", "athlete", "scholar", "hustler",
  "showman", "warrior", "founder", "charmer",
];

// ── Timing Constants ────────────────────────────────────────────────────────

const PHASE_1_START = 0;
const PHASE_2_START = 2000;
const PHASE_3_START = 4000;
const BAR_START_OFFSET = 1200; // After name slam + voice starts
const BAR_FILL_MS = 500;
const BAR_STAGGER_MS = 400;
const CONTINUE_APPEAR_MS = 3000; // After phase 3 start

// ── Particle burst constants ────────────────────────────────────────────────

const BURST_PARTICLE_COUNT = 30;

function generateBurstParticles() {
  const particles: Array<{
    angle: number;
    speed: number;
    size: number;
  }> = [];
  for (let i = 0; i < BURST_PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / BURST_PARTICLE_COUNT + (Math.random() - 0.5) * 0.5;
    particles.push({
      angle,
      speed: 60 + Math.random() * 100,
      size: 2 + Math.random() * 3,
    });
  }
  return particles;
}

// ── Single burst particle ───────────────────────────────────────────────────

function BurstParticle({
  angle,
  speed,
  size,
  color,
  active,
}: {
  angle: number;
  speed: number;
  size: number;
  color: string;
  active: boolean;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      const targetX = Math.cos(angle) * speed;
      const targetY = Math.sin(angle) * speed;

      opacity.value = withSequence(
        withTiming(0.8, { duration: 80 }),
        withDelay(200, withTiming(0, { duration: 1200, easing: Easing.out(Easing.cubic) })),
      );
      translateX.value = withTiming(targetX, {
        duration: 1500,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withTiming(targetY, {
        duration: 1500,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [active]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export function BeatReveal({ archetype, onComplete }: Props) {
  const [phase, setPhase] = useState(1);
  const [confirmTypedChars, setConfirmTypedChars] = useState(0);
  const [showName, setShowName] = useState(false);
  const [showBars, setShowBars] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  const [burstActive, setBurstActive] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedArchetype, setSelectedArchetype] = useState(archetype);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const archetypeKey = selectedArchetype.toLowerCase();
  const subtitle = SUBTITLES[archetypeKey] ?? "THE PROTOCOL ADAPTS";
  const weights = WEIGHTS[archetypeKey] ?? WEIGHTS.titan;

  // Compute primary engine color
  const primaryEngineColor = ENGINE_COLORS[
    ENGINE_ORDER.reduce((a, b) =>
      (weights[a] ?? 0) >= (weights[b] ?? 0) ? a : b,
    )
  ] ?? colors.body;

  // Pre-generate burst particles
  const burstParticles = useMemo(() => generateBurstParticles(), []);

  // Name slam animation
  const nameScale = useSharedValue(1.3);
  const nameOpacity = useSharedValue(0);

  const nameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nameScale.value }],
    opacity: nameOpacity.value,
  }));

  // Radial glow burst behind archetype name
  const radialGlowOpacity = useSharedValue(0);
  const radialGlowScale = useSharedValue(0);

  const radialGlowStyle = useAnimatedStyle(() => ({
    opacity: radialGlowOpacity.value,
    transform: [{ scale: radialGlowScale.value }],
    backgroundColor: primaryEngineColor,
  }));

  // Old particle burst shared values (kept for backward compat)
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
      cancelAnimation(nameScale);
      cancelAnimation(nameOpacity);
      cancelAnimation(radialGlowOpacity);
      cancelAnimation(radialGlowScale);
      cancelAnimation(particleOpacity);
      cancelAnimation(particleScale);
      cancelAnimation(continuePulse);
      barWidths.forEach((sv) => cancelAnimation(sv));
    };
  }, [
    nameScale,
    nameOpacity,
    radialGlowOpacity,
    radialGlowScale,
    particleOpacity,
    particleScale,
    continuePulse,
    barWidths,
  ]);

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

      // Radial glow burst: scales from 0 to 2.0 over 400ms then fades
      radialGlowOpacity.value = withSequence(
        withTiming(0.15, { duration: 100 }),
        withDelay(300, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) })),
      );
      radialGlowScale.value = withTiming(2.0, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      });

      // Legacy particle burst (background ring)
      particleOpacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withDelay(400, withTiming(0, { duration: 600 })),
      );
      particleScale.value = withSequence(
        withTiming(1.0, { duration: 150 }),
        withTiming(2.5, { duration: 800, easing: Easing.out(Easing.cubic) }),
      );

      // Activate burst particles (30 dots flying outward)
      setBurstActive(true);

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
    onComplete(selectedArchetype);
  };

  // Handle archetype change from gallery
  const handleArchetypeChange = (newArchetype: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedArchetype(newArchetype);
    setShowGallery(false);

    // Replay bar fill animation with new weights
    const newWeights = WEIGHTS[newArchetype.toLowerCase()] ?? WEIGHTS.titan;
    ENGINE_ORDER.forEach((engine, i) => {
      barWidths[i].value = 0;
      barWidths[i].value = withDelay(
        i * BAR_STAGGER_MS,
        withTiming(newWeights[engine] ?? 0, {
          duration: BAR_FILL_MS,
          easing: Easing.out(Easing.cubic),
        }),
      );
    });
  };

  // ── Phase 1: IDENTITY CONFIRMED typing ────────────────────────────────

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

  // ── Phase 2: Black screen tension ─────────────────────────────────────

  if (phase === 2) {
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        style={styles.container}
      />
    );
  }

  // ── Phase 3+: Name slam, bars, continue ───────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        {/* Radial glow burst behind name (archetype primary engine color) */}
        <Animated.View style={[styles.radialGlow, radialGlowStyle]} />

        {/* Legacy particle burst behind name */}
        <Animated.View
          style={[
            styles.particleBurst,
            particleStyle,
            { backgroundColor: primaryEngineColor },
          ]}
        />

        {/* 30 burst particle dots flying outward from center */}
        {burstActive && (
          <View style={styles.burstContainer}>
            {burstParticles.map((p, i) => (
              <BurstParticle
                key={i}
                angle={p.angle}
                speed={p.speed}
                size={p.size}
                color={primaryEngineColor}
                active={burstActive}
              />
            ))}
          </View>
        )}

        {/* Archetype name */}
        {showName && (
          <Animated.View style={nameStyle}>
            <Text style={styles.archetypeName}>
              {selectedArchetype.toUpperCase()}
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

        {/* Engine weight bars with shimmer */}
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
                shimmerDelay={i * BAR_STAGGER_MS}
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

            {/* Change class link */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowGallery(true);
              }}
              hitSlop={8}
              style={styles.changeClassLink}
            >
              <Text style={styles.changeClassText}>CHANGE CLASS</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Archetype gallery overlay */}
        {showGallery && (
          <Animated.View
            entering={FadeIn.duration(250)}
            style={styles.galleryOverlay}
          >
            <ScrollView
              contentContainerStyle={styles.galleryScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.galleryTitle}>SELECT YOUR CLASS</Text>
              <View style={styles.galleryGrid}>
                {ALL_ARCHETYPES.map((a) => {
                  const key = a.toLowerCase();
                  const isSelected = key === archetypeKey;
                  return (
                    <Pressable
                      key={a}
                      style={[
                        styles.galleryCard,
                        isSelected && styles.galleryCardSelected,
                      ]}
                      onPress={() => handleArchetypeChange(a)}
                    >
                      <Text style={styles.galleryIcon}>
                        {ARCHETYPE_ICONS[key] ?? "\u26A1"}
                      </Text>
                      <Text
                        style={[
                          styles.galleryName,
                          isSelected && styles.galleryNameSelected,
                        ]}
                      >
                        {a.toUpperCase()}
                      </Text>
                      <Text style={styles.gallerySubtitle}>
                        {SUBTITLES[key] ?? ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={styles.galleryClose}
                onPress={() => setShowGallery(false)}
              >
                <Text style={styles.galleryCloseText}>CANCEL</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

// ── Engine Bar Sub-component with shimmer ───────────────────────────────────

function EngineBar({
  label,
  color,
  weight,
  progress,
  shimmerDelay,
}: {
  label: string;
  color: string;
  weight: number;
  progress: SharedValue<number>;
  shimmerDelay: number;
}) {
  // Shimmer: a white highlight sweeps left to right across the bar
  const shimmerX = useSharedValue(-1);

  useEffect(() => {
    // Start shimmer after the bar has filled
    const timer = setTimeout(() => {
      shimmerX.value = withDelay(
        BAR_FILL_MS + 200,
        withTiming(1, {
          duration: 600,
          easing: Easing.inOut(Easing.cubic),
        }),
      );
    }, shimmerDelay);
    return () => clearTimeout(timer);
  }, []);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
    backgroundColor: color,
  }));

  const shimmerStyle = useAnimatedStyle(() => {
    // Map shimmerX from [-1, 1] to a left percentage for the highlight
    const leftPct = ((shimmerX.value + 1) / 2) * 100;
    return {
      left: `${leftPct}%`,
      opacity: shimmerX.value > -0.9 && shimmerX.value < 0.9 ? 0.4 : 0,
    };
  });

  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color }]}>{label}</Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, fillStyle]}>
          {/* Shimmer highlight */}
          <Animated.View style={[styles.shimmer, shimmerStyle]} />
        </Animated.View>
      </View>
      <Text style={styles.barPct}>{weight}%</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

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

  // Radial glow burst (new premium effect)
  radialGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
  },

  // Phase 3: legacy particle burst
  particleBurst: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0,
  },

  // Burst particles container (centered)
  burstContainer: {
    position: "absolute",
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
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
    overflow: "hidden",
  },
  barPct: {
    fontFamily: monoFont,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.50)",
    width: 32,
    textAlign: "right",
  },

  // Shimmer highlight on bars
  shimmer: {
    position: "absolute",
    top: 0,
    width: 20,
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.40)",
    borderRadius: 3,
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

  // Change class link
  changeClassLink: {
    marginTop: 14,
    alignItems: "center",
  },
  changeClassText: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.35)",
    letterSpacing: 2.5,
    textDecorationLine: "underline",
  },

  // Archetype gallery overlay
  galleryOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.96)",
    zIndex: 100,
  },
  galleryScroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 80,
    paddingBottom: 60,
    alignItems: "center",
  },
  galleryTitle: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.50)",
    letterSpacing: 3,
    marginBottom: 24,
    textAlign: "center",
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  galleryCard: {
    width: "47%",
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  galleryCardSelected: {
    borderColor: "rgba(255, 255, 255, 0.50)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  galleryIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  galleryName: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.80)",
    letterSpacing: 2,
    marginBottom: 4,
    textAlign: "center",
  },
  galleryNameSelected: {
    color: "#FFFFFF",
  },
  gallerySubtitle: {
    fontFamily: monoFont,
    fontSize: 8,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.30)",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  galleryClose: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  galleryCloseText: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.35)",
    letterSpacing: 2,
  },
});
