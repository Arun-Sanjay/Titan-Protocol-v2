import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { IDENTITIES, type Archetype } from "../../../stores/useIdentityStore";
import type { EngineKey } from "../../../db/schema";

type Props = {
  onNext: () => void;
};

const ARCHETYPE_ICONS: Record<Archetype, string> = {
  titan: "\u26A1",
  athlete: "\uD83D\uDCAA",
  scholar: "\uD83D\uDCDA",
  hustler: "\uD83D\uDCB0",
  showman: "\uD83C\uDFA4",
  warrior: "\u2694\uFE0F",
  founder: "\uD83D\uDE80",
  charmer: "\u2728",
};

function getNameColor(archetype: Archetype | null): string {
  if (!archetype || archetype === "titan") return "#FFD700";
  const entry = IDENTITIES.find((i) => i.key === archetype);
  if (!entry || entry.primaryEngine === "all") return "#FFD700";
  const engineColors: Record<EngineKey, string> = {
    body: colors.body,
    mind: colors.mind,
    money: colors.money,
    charisma: colors.charisma,
  };
  return engineColors[entry.primaryEngine as EngineKey] ?? "#FFD700";
}

export function WalkthroughIdentity({ onNext }: Props) {
  const identity = useOnboardingStore((s) => s.identity);
  const entry = identity ? IDENTITIES.find((i) => i.key === identity) : null;
  const nameColor = getNameColor(identity as Archetype | null);
  const icon = identity ? ARCHETYPE_ICONS[identity as Archetype] ?? "\u26A1" : "\u26A1";

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onNext();
  };

  return (
    <View style={styles.container}>
      <View style={styles.centerContent}>
        {/* Icon */}
        <Text style={styles.icon}>{icon}</Text>

        {/* Name */}
        <Text style={[styles.name, { color: nameColor }]}>
          {entry?.meta?.name ?? "The Titan"}
        </Text>

        {/* Tagline */}
        <Text style={styles.tagline}>
          {entry?.meta?.tagline ?? "No ceiling. No excuses. Every engine at full power."}
        </Text>

        {/* Transition text */}
        <Text style={styles.transition}>
          Your identity shapes everything {"\u2014"} which tasks are suggested, how your
          score is weighted, and what gets prioritized. Let{"'"}s set up your
          experience.
        </Text>
      </View>

      {/* Bottom button */}
      <Pressable onPress={handleNext} style={styles.button}>
        <Text style={[styles.buttonText, { color: colors.primary }]}>
          Let{"'"}s Begin
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing["2xl"],
    justifyContent: "space-between",
    paddingBottom: spacing["3xl"],
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing["2xl"],
    paddingHorizontal: spacing.lg,
  },
  transition: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: spacing.md,
  },
  button: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
