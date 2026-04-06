import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { IDENTITIES, type Archetype } from "../../../stores/useIdentityStore";
import type { EngineKey } from "../../../db/schema";

type Props = {
  onNext: () => void;
  onBack: () => void;
};

type EngineInfo = {
  key: EngineKey;
  name: string;
  icon: string;
  color: string;
  description: string;
};

const ENGINES: EngineInfo[] = [
  {
    key: "body",
    name: "Body",
    icon: "\uD83D\uDCAA",
    color: colors.body,
    description: "Physical fitness, nutrition, sleep, health",
  },
  {
    key: "mind",
    name: "Mind",
    icon: "\uD83E\uDDE0",
    color: colors.mind,
    description: "Learning, focus, deep work, reflection",
  },
  {
    key: "money",
    name: "Money",
    icon: "\uD83D\uDCB0",
    color: colors.money,
    description: "Income, savings, career, investments",
  },
  {
    key: "charisma",
    name: "Charisma",
    icon: "\uD83D\uDDE3\uFE0F",
    color: colors.charisma,
    description: "Confidence, speaking, networking, presence",
  },
];

export function WalkthroughEnginesOverview({ onNext, onBack }: Props) {
  const identity = useOnboardingStore((s) => s.identity);
  const meta = identity ? IDENTITIES.find((i) => i.id === identity) : null;
  const weights = meta?.engineWeights ?? {
    body: 0.25,
    mind: 0.25,
    money: 0.25,
    charisma: 0.25,
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onNext();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Kicker */}
        <Text style={styles.kicker}>THE FOUR ENGINES</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          Your life runs on four systems. Each one tracks a different dimension
          of who you{"'"}re becoming.
        </Text>

        {/* Engine cards */}
        {ENGINES.map((engine, i) => {
          const weight = weights[engine.key] ?? 0.25;
          const pct = `${Math.round(weight * 100)}%`;
          return (
            <Animated.View
              key={engine.key}
              entering={FadeInDown.delay(i * 80).duration(400)}
              style={styles.card}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardLeft}>
                  <View
                    style={[styles.dot, { backgroundColor: engine.color }]}
                  />
                  <Text style={[styles.engineName, { color: engine.color }]}>
                    {engine.name}
                  </Text>
                  <Text style={styles.engineIcon}>{engine.icon}</Text>
                </View>
                <View style={[styles.pill, { borderColor: engine.color }]}>
                  <Text style={[styles.pillText, { color: engine.color }]}>
                    {pct}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardDesc}>{engine.description}</Text>
            </Animated.View>
          );
        })}

        {/* Bottom text */}
        <Text style={styles.bottomText}>
          Now let{"'"}s load each engine with your first tasks.
        </Text>
      </ScrollView>

      {/* Next button */}
      <Pressable onPress={handleNext} style={styles.button}>
        <Text style={styles.buttonText}>Next</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing["2xl"],
    paddingBottom: spacing["3xl"],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing["3xl"],
    paddingBottom: spacing.xl,
  },
  kicker: {
    ...fonts.kicker,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: spacing["3xl"],
    paddingHorizontal: spacing.sm,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  engineName: {
    fontSize: 16,
    fontWeight: "700",
  },
  engineIcon: {
    fontSize: 14,
  },
  pill: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 18,
  },
  bottomText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xl,
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
    color: colors.primary,
  },
});
