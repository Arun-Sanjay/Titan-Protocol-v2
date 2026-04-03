import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useOnboardingStore, ONBOARDING_STEPS } from "../../../stores/useOnboardingStore";
import { IDENTITY_LABELS } from "../../../stores/useModeStore";
import type { EngineKey } from "../../../db/schema";

type Props = {
  onNext: () => void;
  onBack: () => void;
  goToStep: (index: number) => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ENGINE_COLORS: Record<EngineKey, string> = {
  body: colors.body, mind: colors.mind, money: colors.money, charisma: colors.charisma,
};

const ENGINE_LABELS: Record<EngineKey, string> = {
  body: "Body", mind: "Mind", money: "Money", charisma: "Charisma",
};

const IDENTITY_ICONS: Record<string, string> = {
  titan: "\u26A1", athlete: "\uD83D\uDCAA", scholar: "\uD83D\uDCDA", hustler: "\uD83D\uDCB0",
  showman: "\uD83C\uDFA4", warrior: "\u2694\uFE0F", founder: "\uD83D\uDE80", charmer: "\u2728",
};

const MODE_LABELS: Record<string, string> = {
  full_protocol: "Full Protocol",
  tracker: "Tracker",
  zen: "Zen",
};

const GOAL_LABELS: Record<string, string> = {
  fit: "Get physically fit",
  health: "Improve my health",
  clarity: "Build mental clarity",
  read: "Read more books",
  skills: "Learn new skills",
  income: "Grow my income",
  money_mgmt: "Manage money better",
  habits: "Build better habits",
  discipline: "Become more disciplined",
  organized: "Be more organized",
};

const DAY_DESCRIPTIONS: Record<string, string> = {
  full_protocol:
    "Morning: Start with your Daily Protocol \u2014 a 3-minute guided session to set your intention, train your mind, and check your habits. Then complete your missions across each engine. Evening: Review your Titan Score and track your progress.",
  tracker:
    "Add your own tasks to each engine. Complete them throughout the day to earn XP and grow your Titan Score. Check your weekly analytics to spot trends.",
  zen:
    "Set a daily intention each morning. Track your core habits throughout the day. In the evening, write a brief journal reflection. No scores, no pressure.",
};

// ─── Summary Row Items ──────────────────────────────────────────────────────

const SUMMARY_ITEMS = ["identity", "mode", "engines", "goals", "schedule"] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function StepPreview({ onNext, onBack, goToStep }: Props) {
  const identity = useOnboardingStore((s) => s.identity);
  const goals = useOnboardingStore((s) => s.goals);
  const mode = useOnboardingStore((s) => s.mode);
  const enginePriority = useOnboardingStore((s) => s.enginePriority);
  const schedule = useOnboardingStore((s) => s.schedule);

  const activeDays = Object.entries(schedule).filter(([, v]) => v).map(([k]) => k);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(0).duration(400)}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={styles.backText}>{"\u2190"} BACK</Text>
          </Pressable>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(50).duration(400)}>
          <Text style={styles.kicker}>REVIEW</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={styles.title}>HERE'S YOUR SETUP</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Text style={styles.subtitle}>
            Review your choices below. You can change anything anytime in Settings.
          </Text>
        </Animated.View>

        {/* Summary Card */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.summaryCard}>
          {/* Identity */}
          <Animated.View entering={FadeIn.delay(300 + 0 * 80).duration(400)} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>IDENTITY</Text>
            <View style={styles.summaryValue}>
              <Text style={styles.summaryIcon}>{identity ? IDENTITY_ICONS[identity] : "?"}</Text>
              <Text style={styles.summaryText}>
                {identity ? IDENTITY_LABELS[identity] : "Not set"}
              </Text>
            </View>
          </Animated.View>

          <View style={styles.divider} />

          {/* Mode */}
          <Animated.View entering={FadeIn.delay(300 + 1 * 80).duration(400)} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>MODE</Text>
            <Text style={styles.summaryText}>
              {mode ? MODE_LABELS[mode] : "Not set"}
            </Text>
          </Animated.View>

          <View style={styles.divider} />

          {/* Engine Priority */}
          <Animated.View entering={FadeIn.delay(300 + 2 * 80).duration(400)} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>ENGINE PRIORITY</Text>
            <View style={styles.enginePills}>
              {enginePriority.map((eng, i) => (
                <View key={eng} style={[styles.enginePill, { borderColor: ENGINE_COLORS[eng] + "50" }]}>
                  <Text style={[styles.enginePillText, { color: ENGINE_COLORS[eng] }]}>
                    {i + 1}. {ENGINE_LABELS[eng]}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>

          <View style={styles.divider} />

          {/* Goals */}
          <Animated.View entering={FadeIn.delay(300 + 3 * 80).duration(400)} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>GOALS</Text>
            <Text style={styles.summaryGoals}>
              {goals.length > 0
                ? goals.map((g) => GOAL_LABELS[g] ?? g).join(", ")
                : "None selected"}
            </Text>
          </Animated.View>

          <View style={styles.divider} />

          {/* Schedule */}
          <Animated.View entering={FadeIn.delay(300 + 4 * 80).duration(400)} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>SCHEDULE</Text>
            <Text style={styles.summaryText}>
              {activeDays.length > 0 ? activeDays.join(", ") : "No days selected"}
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Day in the life */}
        <Animated.View entering={FadeInDown.delay(700).duration(400)} style={styles.dayCard}>
          <Text style={styles.dayCardKicker}>WHAT YOUR DAY WILL LOOK LIKE</Text>
          <Text style={styles.dayCardText}>
            {mode ? DAY_DESCRIPTIONS[mode] : DAY_DESCRIPTIONS.full_protocol}
          </Text>
        </Animated.View>

        {/* Change something */}
        <Animated.View entering={FadeIn.delay(900).duration(300)}>
          <Pressable
            style={styles.changeBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Go back to identity step (step index 1)
              goToStep(1);
            }}
          >
            <Text style={styles.changeBtnText}>CHANGE SOMETHING</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      <Pressable
        style={styles.btn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onNext();
        }}
      >
        <Text style={styles.btnText}>LOOKS GOOD</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing["3xl"] },
  scroll: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  backText: { ...fonts.kicker, fontSize: 10, color: colors.textMuted, marginBottom: spacing.xl },
  kicker: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.xs },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, letterSpacing: 1, marginBottom: spacing.sm },
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.xl },

  // Summary card
  summaryCard: {
    backgroundColor: "rgba(255,255,255,0.03)", borderRadius: radius.md,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryRow: { paddingVertical: spacing.sm },
  summaryLabel: { ...fonts.kicker, fontSize: 8, color: colors.textMuted, marginBottom: spacing.xs },
  summaryValue: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  summaryIcon: { fontSize: 20 },
  summaryText: { fontSize: 15, fontWeight: "600", color: colors.text },
  summaryGoals: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: spacing.xs },

  enginePills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: 4 },
  enginePill: {
    borderRadius: radius.sm, borderWidth: 1,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  enginePillText: { ...fonts.kicker, fontSize: 8 },

  // Day card
  dayCard: {
    backgroundColor: "rgba(255,255,255,0.03)", borderRadius: radius.md,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  dayCardKicker: { ...fonts.kicker, fontSize: 8, color: colors.textMuted, marginBottom: spacing.sm },
  dayCardText: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },

  // Change something
  changeBtn: {
    alignItems: "center", paddingVertical: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    marginBottom: spacing.md,
  },
  changeBtnText: { ...fonts.kicker, fontSize: 10, color: colors.textMuted },

  // CTA
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.lg, alignItems: "center",
  },
  btnText: { ...fonts.kicker, fontSize: 13, color: "#000", letterSpacing: 2 },
});
