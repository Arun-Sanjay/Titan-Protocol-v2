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

type ExampleNode = {
  name: string;
  level: string;
  progress: number; // 0-1
  locked: boolean;
};

const ENGINE_NODES: Record<string, ExampleNode[]> = {
  body: [
    { name: "Iron Foundation", level: "Tier 1", progress: 0, locked: true },
    { name: "Endurance Runner", level: "Tier 1", progress: 0, locked: true },
    { name: "Recovery Master", level: "Tier 2", progress: 0, locked: true },
  ],
  mind: [
    { name: "Deep Focus", level: "Tier 1", progress: 0, locked: true },
    { name: "Speed Reader", level: "Tier 1", progress: 0, locked: true },
    { name: "Pattern Thinker", level: "Tier 2", progress: 0, locked: true },
  ],
  money: [
    { name: "Budget Architect", level: "Tier 1", progress: 0, locked: true },
    { name: "Income Streams", level: "Tier 1", progress: 0, locked: true },
    { name: "Compound Growth", level: "Tier 2", progress: 0, locked: true },
  ],
  charisma: [
    { name: "First Impression", level: "Tier 1", progress: 0, locked: true },
    { name: "Active Listener", level: "Tier 1", progress: 0, locked: true },
    { name: "Stage Presence", level: "Tier 2", progress: 0, locked: true },
  ],
};

const ENGINE_COLORS: Record<string, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  charisma: colors.charisma,
};

function getPrimaryEngine(identity: string | null): string {
  if (!identity) return "body";
  const meta = IDENTITIES.find((i) => i.id === identity);
  if (!meta || meta.primaryEngine === "all") return "body";
  return meta.primaryEngine;
}

export function WalkthroughSkillTrees({ onNext, onBack }: Props) {
  const identity = useOnboardingStore((s) => s.identity);
  const primaryEngine = getPrimaryEngine(identity);
  const engineColor = ENGINE_COLORS[primaryEngine] ?? colors.body;
  const nodes = ENGINE_NODES[primaryEngine] ?? ENGINE_NODES.body;
  const engineName = primaryEngine.charAt(0).toUpperCase() + primaryEngine.slice(1);

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
        {/* Header */}
        <Text style={styles.kicker}>SKILL TREES</Text>
        <Text style={styles.subtitle}>Earn your mastery.</Text>

        <Text style={styles.intro}>
          Each engine has a skill tree. Nodes unlock when you earn them through
          real performance{" \u2014 "}not by tapping a button.
        </Text>

        {/* Example nodes */}
        <Text style={[styles.sectionKicker, { color: engineColor }]}>
          {engineName.toUpperCase()} TREE {"\u2014"} PREVIEW
        </Text>

        {nodes.map((node, i) => (
          <Animated.View
            key={node.name}
            entering={FadeInDown.delay(i * 80).duration(400)}
            style={styles.nodeCard}
          >
            <View style={styles.nodeLeft}>
              <View style={[styles.lockIcon, { borderColor: engineColor + "44" }]}>
                <Text style={styles.lockEmoji}>{"\uD83D\uDD12"}</Text>
              </View>
            </View>
            <View style={styles.nodeContent}>
              <Text style={styles.nodeName}>{node.name}</Text>
              <Text style={[styles.nodeLevel, { color: engineColor }]}>
                {node.level}
              </Text>
              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${node.progress * 100}%`,
                      backgroundColor: engineColor,
                    },
                  ]}
                />
              </View>
            </View>
          </Animated.View>
        ))}

        <Animated.View
          entering={FadeInDown.delay(300).duration(400)}
          style={styles.hintCard}
        >
          <Text style={styles.hintText}>
            Complete tasks and missions. Watch your progress bars fill. When a
            node is ready, it glows{" \u2014 "}tap to claim.
          </Text>
        </Animated.View>
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
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  kicker: {
    ...fonts.kicker,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 23,
    marginBottom: spacing.lg,
  },
  intro: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing["2xl"],
  },
  sectionKicker: {
    ...fonts.kicker,
    marginBottom: spacing.md,
  },
  nodeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  nodeLeft: {
    marginRight: spacing.md,
  },
  lockIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  lockEmoji: {
    fontSize: 16,
  },
  nodeContent: {
    flex: 1,
  },
  nodeName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 2,
  },
  nodeLevel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  hintCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  hintText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: "center",
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
