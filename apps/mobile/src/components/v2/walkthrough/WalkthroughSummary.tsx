import React, { useEffect } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { titanColors } from "../../../theme/colors";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { useWalkthroughStore } from "../../../stores/useWalkthroughStore";
import { IDENTITY_LABELS, type IdentityArchetype } from "../../../stores/useModeStore";
import { IDENTITIES, type Archetype } from "../../../stores/useIdentityStore";
import type { EngineKey } from "../../../db/schema";

type Props = {
  onFinish: () => void;
  onBack: () => void;
};

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

const ENGINE_META: Record<EngineKey, { name: string; color: string }> = {
  body: { name: "Body", color: colors.body },
  mind: { name: "Mind", color: colors.mind },
  money: { name: "Money", color: colors.money },
  charisma: { name: "Charisma", color: colors.charisma },
};

const ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

const NEXT_STEPS = [
  "Complete your first Daily Protocol to cast your first identity vote.",
  "Finish tasks to earn XP and start climbing the ranks.",
  "Check your Skill Trees to see what you\u2019re working toward.",
];

export function WalkthroughSummary({ onFinish, onBack }: Props) {
  const identity = useOnboardingStore((s) => s.identity);
  const engineTasks = useWalkthroughStore((s) => s.engineTasks);
  const habits = useWalkthroughStore((s) => s.habits);
  const goals = useWalkthroughStore((s) => s.goals);
  const pinnedTools = useWalkthroughStore((s) => s.pinnedTools);

  const identityLabel =
    identity && IDENTITY_LABELS[identity as IdentityArchetype]
      ? IDENTITY_LABELS[identity as IdentityArchetype]
      : "The Titan";
  const identityIcon = ARCHETYPE_ICONS[(identity as string) ?? "titan"] ?? "\u26A1";

  // Pulsing border animation
  const pulseOpacity = useSharedValue(0.4);

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200 }),
        withTiming(0.4, { duration: 1200 }),
      ),
      -1,
      false,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255, 215, 0, ${pulseOpacity.value})`,
  }));

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onFinish();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(0).duration(500)}
          style={styles.headerCenter}
        >
          <Text style={styles.readyTitle}>YOU{"\u2019"}RE READY</Text>
          <Text style={styles.readySub}>Here{"\u2019"}s your setup.</Text>
        </Animated.View>

        {/* Summary card */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(500)}
          style={styles.summaryCard}
        >
          {/* Identity */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Identity</Text>
            <View style={styles.identityValue}>
              <Text style={styles.identityIcon}>{identityIcon}</Text>
              <Text style={styles.identityName}>{identityLabel}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Engines */}
          <Text style={styles.summaryLabel}>Engines Configured</Text>
          <View style={styles.engineGrid}>
            {ENGINES.map((eng) => {
              const meta = ENGINE_META[eng];
              const count = engineTasks[eng]?.length ?? 0;
              return (
                <View key={eng} style={styles.engineItem}>
                  <View
                    style={[
                      styles.engineDot,
                      { backgroundColor: meta.color },
                    ]}
                  />
                  <Text style={styles.engineName}>{meta.name}</Text>
                  <Text
                    style={[
                      styles.engineCount,
                      count > 0 && { color: meta.color },
                    ]}
                  >
                    {count > 0 ? `${count} task${count !== 1 ? "s" : ""}` : "None yet"}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.divider} />

          {/* Habits */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Habits</Text>
            <Text style={styles.summaryValue}>
              {habits.length} added
            </Text>
          </View>

          {/* Goals */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Goals</Text>
            <Text style={styles.summaryValue}>
              {goals.length} set
            </Text>
          </View>

          {/* Pinned Tools */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Pinned Tools</Text>
            <Text style={styles.summaryValue} numberOfLines={2}>
              {pinnedTools.length > 0 ? pinnedTools.join(", ") : "None"}
            </Text>
          </View>
        </Animated.View>

        {/* What's next */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)}>
          <Text style={styles.nextKicker}>WHAT{"\u2019"}S NEXT</Text>
          {NEXT_STEPS.map((step, i) => (
            <View key={i} style={styles.nextRow}>
              <View style={styles.nextBullet} />
              <Text style={styles.nextText}>{step}</Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      {/* Enter button with pulsing border */}
      <Animated.View style={[styles.enterBtn, pulseStyle]}>
        <Pressable onPress={handleFinish} style={styles.enterBtnInner}>
          <Text style={styles.enterBtnText}>ENTER TITAN PROTOCOL</Text>
        </Pressable>
      </Animated.View>
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
  headerCenter: {
    alignItems: "center",
    marginBottom: spacing["2xl"],
  },
  readyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  readySub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  summaryCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing["2xl"],
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summaryValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "500",
    maxWidth: "60%",
    textAlign: "right",
  },
  identityValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  identityIcon: {
    fontSize: 18,
  },
  identityName: {
    fontSize: 14,
    fontWeight: "700",
    color: titanColors.accent,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: spacing.sm,
  },
  engineGrid: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  engineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  engineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  engineName: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "500",
    flex: 1,
  },
  engineCount: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500",
  },
  nextKicker: {
    ...fonts.kicker,
    marginBottom: spacing.md,
  },
  nextRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
    paddingRight: spacing.md,
  },
  nextBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 6,
    marginRight: spacing.md,
  },
  nextText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    flex: 1,
  },
  enterBtn: {
    borderWidth: 2,
    borderColor: titanColors.accent,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  enterBtnInner: {
    paddingVertical: spacing.xl,
    alignItems: "center",
    backgroundColor: titanColors.accentDim,
  },
  enterBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: titanColors.accent,
    letterSpacing: 2,
  },
});
