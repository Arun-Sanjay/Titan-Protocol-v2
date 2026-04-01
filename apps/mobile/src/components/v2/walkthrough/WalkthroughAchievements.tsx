import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { titanColors } from "../../../theme/colors";

type Props = {
  onNext: () => void;
  onBack: () => void;
};

type AchievementPreview = {
  revealed: boolean;
  name?: string;
  description?: string;
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
};

const RARITY_COLORS: Record<string, string> = {
  Common: colors.textMuted,
  Rare: colors.rankC,
  Epic: colors.rankB,
  Legendary: titanColors.accent,
};

const ACHIEVEMENT_GRID: AchievementPreview[] = [
  {
    revealed: true,
    name: "First Blood",
    description: "Complete your first task",
    rarity: "Common",
  },
  { revealed: false, rarity: "Rare" },
  { revealed: false, rarity: "Epic" },
  { revealed: false, rarity: "Legendary" },
];

export function WalkthroughAchievements({ onNext, onBack }: Props) {
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
        <Text style={styles.kicker}>ACHIEVEMENTS</Text>
        <Text style={styles.subtitle}>Discover them as you grow.</Text>

        <Text style={styles.intro}>
          Hidden achievements trigger when you hit certain milestones. You won
          {"\u2019"}t see a list{" \u2014 "}they{"\u2019"}ll surprise you.
        </Text>

        {/* 2x2 grid */}
        <View style={styles.grid}>
          {ACHIEVEMENT_GRID.map((ach, i) => {
            const rarityColor = RARITY_COLORS[ach.rarity] ?? colors.textMuted;
            return (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(i * 100).duration(400)}
                style={styles.gridItem}
              >
                <View
                  style={[
                    styles.achievementCard,
                    ach.revealed && { borderColor: rarityColor + "55" },
                  ]}
                >
                  {ach.revealed ? (
                    <>
                      <View style={[styles.badge, { borderColor: rarityColor }]}>
                        <Text style={[styles.badgeIcon, { color: rarityColor }]}>
                          {"\u2605"}
                        </Text>
                      </View>
                      <Text style={styles.achName}>{ach.name}</Text>
                      <Text style={styles.achDesc}>{ach.description}</Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.mysteryBadge}>
                        <Text style={styles.mysteryText}>?</Text>
                      </View>
                      <Text style={styles.hiddenLabel}>Hidden</Text>
                    </>
                  )}
                  <View
                    style={[
                      styles.rarityTag,
                      { backgroundColor: rarityColor + "1A" },
                    ]}
                  >
                    <Text style={[styles.rarityText, { color: rarityColor }]}>
                      {ach.rarity}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </View>

        <Animated.View
          entering={FadeInDown.delay(500).duration(400)}
          style={styles.footerCard}
        >
          <Text style={styles.footerText}>
            There are 40+ achievements waiting. Some take days. Some take months.
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  gridItem: {
    width: "47%",
  },
  achievementCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    minHeight: 140,
    justifyContent: "center",
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  badgeIcon: {
    fontSize: 18,
  },
  achName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: 2,
  },
  achDesc: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 15,
  },
  mysteryBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  mysteryText: {
    fontSize: 20,
    fontWeight: "800",
    color: "rgba(255,255,255,0.15)",
  },
  hiddenLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.12)",
    fontWeight: "600",
  },
  rarityTag: {
    position: "absolute",
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  rarityText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  footerCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.sm,
    padding: spacing.lg,
  },
  footerText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: "center",
    fontStyle: "italic",
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
