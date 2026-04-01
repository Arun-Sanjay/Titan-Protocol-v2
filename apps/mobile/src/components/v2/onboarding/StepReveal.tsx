import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import Animated, {
  FadeIn, FadeInDown,
  useSharedValue, useAnimatedStyle, withTiming, withSequence,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { titanColors } from "../../../theme/colors";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { IDENTITIES } from "../../../stores/useIdentityStore";
import { IDENTITY_LABELS, type IdentityArchetype } from "../../../stores/useModeStore";

type Props = { onNext: () => void; onBack: () => void };

const ENGINE_LABELS: Record<string, string> = {
  body: "BODY", mind: "MIND", money: "MONEY", charisma: "CHARISMA",
};
const ENGINE_COLORS: Record<string, string> = {
  body: colors.body, mind: colors.mind, money: colors.money, charisma: colors.charisma,
};
const ARCHETYPE_ICONS: Record<string, string> = {
  titan: "\u26A1", athlete: "\uD83D\uDCAA", scholar: "\uD83D\uDCDA", hustler: "\uD83D\uDCB0",
  showman: "\uD83C\uDFA4", warrior: "\u2694\uFE0F", founder: "\uD83D\uDE80", charmer: "\u2728",
};

export function StepReveal({ onNext, onBack }: Props) {
  const quizResult = useOnboardingStore((s) => s.quizResult);
  const identity = useOnboardingStore((s) => s.identity);
  const setIdentity = useOnboardingStore((s) => s.setIdentity);
  const [phase, setPhase] = useState<"pause" | "reveal" | "gallery">("pause");
  const [selectedOverride, setSelectedOverride] = useState<IdentityArchetype | null>(null);

  const matchedArchetype = quizResult?.archetype ?? identity ?? "athlete";
  const currentSelection = selectedOverride ?? matchedArchetype;
  const isTitan = matchedArchetype === "titan";
  const earnedTitan = (quizResult?.titanPoints ?? 0) >= 8 || matchedArchetype === "titan";

  const meta = useMemo(
    () => IDENTITIES.find((i) => i.id === currentSelection),
    [currentSelection],
  );

  // Dark pause before reveal
  useEffect(() => {
    const pauseDuration = isTitan ? 1000 : 500;
    const timer = setTimeout(() => setPhase("reveal"), pauseDuration);
    return () => clearTimeout(timer);
  }, []);

  // Scale animation for archetype name
  const nameScale = useSharedValue(0.8);
  const nameOpacity = useSharedValue(0);
  useEffect(() => {
    if (phase === "reveal") {
      const delay = isTitan ? 800 : 300;
      setTimeout(() => {
        nameScale.value = withTiming(1.0, { duration: 600 });
        nameOpacity.value = withTiming(1, { duration: 600 });
      }, delay);
    }
  }, [phase]);

  const nameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nameScale.value }],
    opacity: nameOpacity.value,
  }));

  const extraDelay = isTitan ? 500 : 0;

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("gallery");
  };

  const handleConfirm = () => {
    setIdentity(currentSelection);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onNext();
  };

  const handleSelectArchetype = (id: IdentityArchetype) => {
    // Block Titan selection if not earned
    if (id === "titan" && !earnedTitan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedOverride(id === matchedArchetype ? null : id);
  };

  // Dark pause phase
  if (phase === "pause") {
    return <View style={styles.container} />;
  }

  // Reveal phase
  if (phase === "reveal" && meta) {
    return (
      <View style={styles.container}>
        <View style={styles.revealCenter}>
          {/* Archetype name with scale animation */}
          <Animated.Text style={[styles.revealName, nameStyle, isTitan && { color: titanColors.accent }]}>
            {meta.name}
          </Animated.Text>

          {/* Tagline */}
          <Animated.Text
            entering={FadeIn.delay(900 + extraDelay).duration(500)}
            style={styles.revealTagline}
          >
            {meta.tagline}
          </Animated.Text>

          {/* Description */}
          <Animated.Text
            entering={FadeIn.delay(1400 + extraDelay).duration(500)}
            style={styles.revealDesc}
          >
            {meta.description}
          </Animated.Text>

          {/* Engine weight bars */}
          <Animated.View
            entering={FadeInDown.delay(2000 + extraDelay).duration(400)}
            style={styles.weightBars}
          >
            {Object.entries(meta.engineWeights).map(([engine, weight]) => (
              <View key={engine} style={styles.weightRow}>
                <Text style={[styles.weightLabel, { color: ENGINE_COLORS[engine] }]}>
                  {ENGINE_LABELS[engine]}
                </Text>
                <View style={styles.weightTrack}>
                  <View
                    style={[styles.weightFill, {
                      width: `${(weight as number) * 100}%`,
                      backgroundColor: ENGINE_COLORS[engine],
                    }]}
                  />
                </View>
                <Text style={styles.weightPct}>{Math.round((weight as number) * 100)}%</Text>
              </View>
            ))}
          </Animated.View>

          {/* "This is you." */}
          <Animated.Text
            entering={FadeIn.delay(2600 + extraDelay).duration(400)}
            style={styles.thisIsYou}
          >
            This is you.
          </Animated.Text>

          {/* Titan extra: "Few get this result." */}
          {isTitan && (
            <Animated.Text
              entering={FadeIn.delay(3000 + extraDelay).duration(400)}
              style={[styles.thisIsYou, { color: titanColors.accent, marginTop: spacing.xs }]}
            >
              Few get this result.
            </Animated.Text>
          )}

          {/* Continue button */}
          <Animated.View
            entering={FadeIn.delay(isTitan ? 3500 : 3000).duration(400)}
            style={{ width: "100%" }}
          >
            <Pressable
              style={[styles.continueBtn, isTitan && { borderColor: titanColors.accent }]}
              onPress={handleContinue}
            >
              <Text style={[styles.continueBtnText, isTitan && { color: titanColors.accent }]}>
                CONTINUE
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    );
  }

  // Gallery / confirmation phase
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.galleryScroll} showsVerticalScrollIndicator={false}>
        {/* YOUR MATCH */}
        <Text style={styles.sectionTitle}>YOUR MATCH</Text>
        <GalleryCard
          archetype={matchedArchetype}
          isMatched
          isSelected={!selectedOverride}
          isLocked={false}
          onPress={() => handleSelectArchetype(matchedArchetype)}
        />

        {/* ALL ARCHETYPES */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>ALL ARCHETYPES</Text>
        <Text style={styles.sectionSubtitle}>Want a different path? Explore all options.</Text>

        {IDENTITIES.filter((i) => i.id !== matchedArchetype).map((i) => {
          const locked = i.id === "titan" && !earnedTitan;
          return (
            <GalleryCard
              key={i.id}
              archetype={i.id}
              isMatched={false}
              isSelected={selectedOverride === i.id}
              isLocked={locked}
              onPress={() => handleSelectArchetype(i.id)}
            />
          );
        })}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable style={styles.btn} onPress={handleConfirm}>
          <Text style={styles.btnText}>
            CONFIRM {IDENTITY_LABELS[currentSelection].toUpperCase()}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function GalleryCard({
  archetype, isMatched, isSelected, isLocked, onPress,
}: {
  archetype: IdentityArchetype;
  isMatched: boolean;
  isSelected: boolean;
  isLocked: boolean;
  onPress: () => void;
}) {
  const meta = IDENTITIES.find((i) => i.id === archetype);
  if (!meta) return null;

  const isTitanCard = archetype === "titan";

  return (
    <Pressable
      onPress={isLocked ? undefined : onPress}
      style={[
        styles.galleryCard,
        isSelected && styles.galleryCardSelected,
        isMatched && styles.galleryCardMatched,
        isLocked && styles.galleryCardLocked,
      ]}
    >
      <View style={styles.galleryCardHeader}>
        <Text style={[styles.galleryIcon, isLocked && { opacity: 0.3 }]}>
          {ARCHETYPE_ICONS[archetype] ?? "?"}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={[
            styles.galleryName,
            isSelected && { color: colors.primary },
            isMatched && isTitanCard && { color: titanColors.accent },
            isLocked && { color: colors.textMuted },
          ]}>
            {meta.name}
          </Text>
          <Text style={styles.galleryTagline} numberOfLines={1}>{meta.tagline}</Text>
        </View>
        {isMatched && (
          <View style={[styles.matchBadge, isTitanCard && { backgroundColor: titanColors.accent }]}>
            <Text style={styles.matchBadgeText}>MATCHED</Text>
          </View>
        )}
        {isSelected && !isMatched && (
          <View style={styles.galleryCheck}>
            <Text style={styles.galleryCheckText}>{"\u2713"}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.galleryFocus, isLocked && { opacity: 0.3 }]}>{meta.engineFocus}</Text>
      {isLocked && (
        <Text style={styles.lockedText}>Score 4+ mastery answers in the quiz to unlock</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Reveal
  revealCenter: {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingHorizontal: spacing.xl, paddingBottom: spacing["3xl"],
  },
  revealName: {
    fontSize: 28, fontWeight: "700", color: colors.text,
    letterSpacing: 2, textAlign: "center", marginBottom: spacing.md,
  },
  revealTagline: {
    fontSize: 14, fontWeight: "400", color: colors.textSecondary,
    textAlign: "center", lineHeight: 20, marginBottom: spacing.xl,
  },
  revealDesc: {
    fontSize: 13, fontWeight: "400", color: colors.textMuted,
    textAlign: "center", lineHeight: 20, marginBottom: spacing.xl,
    paddingHorizontal: spacing.md, maxWidth: 300,
  },
  weightBars: { width: "100%", gap: spacing.sm, marginBottom: spacing.xl },
  weightRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  weightLabel: { ...fonts.kicker, fontSize: 11, width: 68, letterSpacing: 1 },
  weightTrack: {
    flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 2, overflow: "hidden",
  },
  weightFill: { height: "100%", borderRadius: 2 },
  weightPct: { ...fonts.mono, fontSize: 11, color: colors.textMuted, width: 32, textAlign: "right" },
  thisIsYou: {
    fontSize: 12, color: colors.textMuted, fontStyle: "italic",
    letterSpacing: 1, marginBottom: spacing.lg, textAlign: "center",
  },
  continueBtn: {
    borderRadius: radius.md, borderWidth: 1.5,
    borderColor: colors.primary, paddingVertical: spacing.lg, alignItems: "center",
  },
  continueBtnText: { ...fonts.kicker, fontSize: 13, color: colors.primary, letterSpacing: 2 },

  // Gallery
  galleryScroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  sectionTitle: { ...fonts.kicker, fontSize: 10, color: colors.textMuted, letterSpacing: 2, marginBottom: spacing.xs },
  sectionSubtitle: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md },
  galleryCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.md, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: spacing.md, marginBottom: spacing.sm,
  },
  galleryCardSelected: { borderColor: colors.primary, backgroundColor: "rgba(255,255,255,0.06)" },
  galleryCardMatched: { borderColor: "rgba(255, 215, 0, 0.40)" },
  galleryCardLocked: { opacity: 0.5 },
  galleryCardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: 6 },
  galleryIcon: { fontSize: 28 },
  galleryName: { fontSize: 16, fontWeight: "600", color: colors.text },
  galleryTagline: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  galleryFocus: { ...fonts.kicker, fontSize: 8, color: colors.textSecondary, letterSpacing: 0.5 },
  matchBadge: {
    backgroundColor: colors.primary, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  matchBadgeText: { ...fonts.kicker, fontSize: 8, color: "#000", letterSpacing: 1 },
  galleryCheck: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  galleryCheckText: { fontSize: 13, fontWeight: "700", color: "#000" },
  lockedText: { ...fonts.kicker, fontSize: 8, color: colors.textMuted, marginTop: 4, letterSpacing: 0.5 },

  // Bottom bar
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg, paddingBottom: spacing["3xl"], paddingTop: spacing.md,
    backgroundColor: colors.bg,
  },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.lg, alignItems: "center",
  },
  btnText: { ...fonts.kicker, fontSize: 13, color: "#000", letterSpacing: 2 },
});
