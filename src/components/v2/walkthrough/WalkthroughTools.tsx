import React, { useEffect } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { useWalkthroughStore } from "../../../stores/useWalkthroughStore";
import type { IdentityArchetype } from "../../../stores/useModeStore";

type Props = {
  onNext: () => void;
  onBack: () => void;
};

type ToolDef = {
  name: string;
  icon: string;
};

const TOOLS: ToolDef[] = [
  { name: "Focus Timer", icon: "\u23F1\uFE0F" },
  { name: "Analytics", icon: "\uD83D\uDCCA" },
  { name: "Workouts", icon: "\uD83C\uDFCB\uFE0F" },
  { name: "Sleep", icon: "\uD83D\uDE34" },
  { name: "Weight", icon: "\u2696\uFE0F" },
  { name: "Nutrition", icon: "\uD83E\uDD57" },
  { name: "Cashflow", icon: "\uD83D\uDCB5" },
  { name: "Deep Work", icon: "\uD83E\uDDE0" },
];

const IDENTITY_TOOLS: Record<string, string[]> = {
  titan: ["Focus Timer", "Workouts", "Cashflow"],
  athlete: ["Workouts", "Nutrition", "Sleep"],
  scholar: ["Focus Timer", "Deep Work", "Analytics"],
  hustler: ["Cashflow", "Deep Work", "Analytics"],
  showman: ["Focus Timer", "Analytics"],
  warrior: ["Workouts", "Focus Timer", "Sleep"],
  founder: ["Deep Work", "Cashflow", "Analytics"],
  charmer: ["Workouts", "Analytics"],
};

export function WalkthroughTools({ onNext, onBack }: Props) {
  const identity = useOnboardingStore((s) => s.identity);
  const pinnedTools = useWalkthroughStore((s) => s.pinnedTools);
  const toggleTool = useWalkthroughStore((s) => s.toggleTool);
  const setPinnedTools = useWalkthroughStore((s) => s.setPinnedTools);

  // Initialize pinned tools on mount based on identity
  useEffect(() => {
    if (pinnedTools.length === 0) {
      const defaults =
        IDENTITY_TOOLS[(identity as string) ?? "titan"] ??
        IDENTITY_TOOLS.titan;
      setPinnedTools(defaults);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleTool(name);
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
        {/* Header */}
        <Text style={styles.kicker}>YOUR TOOLKIT</Text>
        <Text style={styles.subtitle}>
          Specialized tools for every engine.
        </Text>

        <Text style={styles.intro}>
          Pin the tools you{"\u2019"}ll use most. You can change these anytime.
        </Text>

        {/* Tool grid */}
        <View style={styles.grid}>
          {TOOLS.map((tool, i) => {
            const pinned = pinnedTools.includes(tool.name);
            return (
              <Animated.View
                key={tool.name}
                entering={FadeInDown.delay(i * 50).duration(350)}
                style={styles.gridItem}
              >
                <Pressable
                  onPress={() => handleToggle(tool.name)}
                  style={[
                    styles.toolCard,
                    pinned && styles.toolCardActive,
                  ]}
                >
                  <Text style={styles.toolIcon}>{tool.icon}</Text>
                  <Text
                    style={[
                      styles.toolName,
                      pinned && { color: colors.text },
                    ]}
                  >
                    {tool.name}
                  </Text>
                  <View
                    style={[
                      styles.pinBadge,
                      pinned && styles.pinBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pinBadgeText,
                        pinned && { color: colors.bg },
                      ]}
                    >
                      {pinned ? "\u2713" : "+"}
                    </Text>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <Text style={styles.countText}>
          {pinnedTools.length} tool{pinnedTools.length !== 1 ? "s" : ""} pinned
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
    marginBottom: spacing.sm,
  },
  intro: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing["2xl"],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  gridItem: {
    width: "47%",
  },
  toolCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    position: "relative",
  },
  toolCardActive: {
    backgroundColor: "rgba(52, 211, 153, 0.06)",
    borderColor: colors.accent,
  },
  toolIcon: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  toolName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    textAlign: "center",
  },
  pinBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  pinBadgeActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pinBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  countText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing["2xl"],
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
