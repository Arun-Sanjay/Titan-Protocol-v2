import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { titanColors } from "../../../theme/colors";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { IDENTITIES, type Archetype } from "../../../stores/useIdentityStore";
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
  const [phase, setPhase] = useState<"reveal" | "gallery">("reveal");
  const [selectedOverride, setSelectedOverride] = useState<IdentityArchetype | null>(null);
  const { width: screenWidth } = useWindowDimensions();

  const matchedArchetype = quizResult?.archetype ?? identity ?? "athlete";
  const currentSelection = selectedOverride ?? matchedArchetype;
  const isTitan = matchedArchetype === "titan";

  const meta = useMemo(
    () => IDENTITIES.find((i) => i.id === currentSelection),
    [currentSelection],
  );

  const accentColor = isTitan && !selectedOverride ? titanColors.accent : colors.primary;
  const extraDelay = isTitan ? 500 : 0;

  const handleContinue = () => {
    if (phase === "reveal") {
      setPhase("gallery");
    } else {
      setIdentity(currentSelection);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onNext();
    }
  };

  const handleSelectArchetype = (id: IdentityArchetype) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedOverride(id === matchedArchetype ? null : id);
  };

  if (phase === "reveal" && meta) {
    return (
      <View style={styles.container}>
        <View style={styles.revealCenter}>
          {/* Archetype name */}
          <Animated.Text
            entering={FadeIn.delay(300 + extraDelay).duration(600)}
            style={[styles.revealName, { color: accentColor }]}
          >
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
            entering={FadeInDown.delay(2000 + extraDelay).duration(500)}
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

          {/* "This is you." / "Few get this result." */}
          <Animated.Text
            entering={FadeIn.delay(2600 + extraDelay).duration(400)}
            style={[styles.thisIsYou, isTitan && { color: titanColors.accent }]}
          >
            {isTitan ? "Few get this result." : "This is you."}
          </Animated.Text>

          {/* Continue button */}
          <Animated.View entering={FadeIn.delay(3000 + extraDelay).duration(400)} style={{ width: "100%" }}>
            <Pressable
              style={[styles.btn, isTitan && { backgroundColor: titanColors.accent }]}
              onPress={handleContinue}
              onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
            >
              <Text style={styles.btnText}>CONTINUE</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    );
  }

  // Gallery phase
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.galleryScroll} showsVerticalScrollIndicator={false}>
        {/* Matched card */}
        <Text style={styles.sectionTitle}>YOUR MATCH</Text>
        <ArchetypeCard
          archetype={matchedArchetype}
          isMatched
          isSelected={!selectedOverride}
          onPress={() => handleSelectArchetype(matchedArchetype)}
          screenWidth={screenWidth}
        />

        {/* All archetypes */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>ALL ARCHETYPES</Text>
        {IDENTITIES.filter((i) => i.id !== matchedArchetype).map((i) => (
          <ArchetypeCard
            key={i.id}
            archetype={i.id}
            isMatched={false}
            isSelected={selectedOverride === i.id}
            onPress={() => handleSelectArchetype(i.id)}
            screenWidth={screenWidth}
          />
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          style={styles.btn}
          onPress={handleContinue}
          onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
        >
          <Text style={styles.btnText}>
            {selectedOverride
              ? `CHOOSE ${IDENTITY_LABELS[selectedOverride].toUpperCase()}`
              : `KEEP ${IDENTITY_LABELS[matchedArchetype].toUpperCase()}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ArchetypeCard({
  archetype, isMatched, isSelected, onPress, screenWidth,
}: {
  archetype: IdentityArchetype;
  isMatched: boolean;
  isSelected: boolean;
  onPress: () => void;
  screenWidth: number;
}) {
  const meta = IDENTITIES.find((i) => i.id === archetype);
  if (!meta) return null;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.galleryCard,
        isSelected && styles.galleryCardSelected,
        isMatched && styles.galleryCardMatched,
      ]}
    >
      <View style={styles.galleryCardHeader}>
        <Text style={styles.galleryIcon}>{ARCHETYPE_ICONS[archetype] ?? "?"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.galleryName, isSelected && { color: colors.primary }]}>
            {meta.name}
          </Text>
          <Text style={styles.galleryTagline}>{meta.tagline}</Text>
        </View>
        {isSelected && (
          <View style={styles.galleryCheck}>
            <Text style={styles.galleryCheckText}>{"\u2713"}</Text>
          </View>
        )}
      </View>
      <Text style={styles.galleryFocus}>{meta.engineFocus}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Reveal phase
  revealCenter: {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingHorizontal: spacing.xl, paddingBottom: spacing["3xl"],
  },
  revealName: {
    fontSize: 32, fontWeight: "700", letterSpacing: 1,
    textAlign: "center", marginBottom: spacing.md,
  },
  revealTagline: {
    fontSize: 14, color: colors.textSecondary, textAlign: "center",
    lineHeight: 20, marginBottom: spacing.xl,
  },
  revealDesc: {
    fontSize: 13, color: colors.textMuted, textAlign: "center",
    lineHeight: 20, marginBottom: spacing.xl, paddingHorizontal: spacing.md,
  },
  weightBars: { width: "100%", gap: spacing.sm, marginBottom: spacing.xl },
  weightRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  weightLabel: { ...fonts.kicker, fontSize: 9, width: 60, letterSpacing: 1 },
  weightTrack: {
    flex: 1, height: 6, backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 3, overflow: "hidden",
  },
  weightFill: { height: "100%", borderRadius: 3 },
  weightPct: { ...fonts.mono, fontSize: 11, color: colors.textMuted, width: 32, textAlign: "right" },
  thisIsYou: {
    ...fonts.kicker, fontSize: 10, color: colors.textMuted,
    letterSpacing: 2, marginBottom: spacing.xl, textAlign: "center",
  },

  // Gallery phase
  galleryScroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  sectionTitle: { ...fonts.kicker, fontSize: 10, color: colors.textMuted, letterSpacing: 2, marginBottom: spacing.md },
  galleryCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.md, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: spacing.md, marginBottom: spacing.sm,
  },
  galleryCardSelected: { borderColor: colors.primary, backgroundColor: "rgba(255,255,255,0.06)" },
  galleryCardMatched: { borderColor: "rgba(255, 215, 0, 0.40)" },
  galleryCardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: 6 },
  galleryIcon: { fontSize: 28 },
  galleryName: { fontSize: 16, fontWeight: "600", color: colors.text },
  galleryTagline: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  galleryFocus: { ...fonts.kicker, fontSize: 8, color: colors.textSecondary, letterSpacing: 0.5 },
  galleryCheck: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  galleryCheckText: { fontSize: 13, fontWeight: "700", color: "#000" },

  // Bottom bar
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg, paddingBottom: spacing["3xl"], paddingTop: spacing.md,
    backgroundColor: colors.bg,
  },

  // Button
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.lg, alignItems: "center",
  },
  btnText: { ...fonts.kicker, fontSize: 13, color: "#000", letterSpacing: 2 },
});
