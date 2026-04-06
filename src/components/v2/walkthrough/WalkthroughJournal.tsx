import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";

type Props = {
  onNext: () => void;
  onBack: () => void;
};

const JOURNAL_CARDS = [
  {
    icon: "\uD83D\uDCD6",
    title: "Daily Journal",
    description: "Prompted questions that build self-awareness.",
  },
  {
    icon: "\uD83C\uDF19",
    title: "Evening Reflection",
    description: "A 2-minute end-of-day check-in.",
  },
  {
    icon: "\uD83C\uDFAF",
    title: "Goals",
    description: "Set longer-term objectives and break them into tasks.",
  },
];

export function WalkthroughJournal({ onNext, onBack }: Props) {
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
        <Text style={styles.kicker}>JOURNALING</Text>
        <Text style={styles.subtitle}>
          Reflection is how you turn experience into growth.
        </Text>

        <Text style={styles.intro}>
          Three built-in tools help you stay intentional. No setup needed
          {" \u2014 "}they{"\u2019"}re ready when you are.
        </Text>

        {/* Cards */}
        {JOURNAL_CARDS.map((card, i) => (
          <Animated.View
            key={card.title}
            entering={FadeInDown.delay(i * 100).duration(400)}
            style={styles.card}
          >
            <Text style={styles.cardIcon}>{card.icon}</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDesc}>{card.description}</Text>
            </View>
          </Animated.View>
        ))}

        <Text style={styles.footnote}>
          Journaling earns +15 XP per entry. Consistency compounds.
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
    marginBottom: spacing.lg,
  },
  intro: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing["2xl"],
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.sm,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardIcon: {
    fontSize: 28,
    marginRight: spacing.lg,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  footnote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing["2xl"],
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
