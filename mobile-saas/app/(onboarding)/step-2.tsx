import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { OnboardingChrome } from "../../src/components/ui/OnboardingChrome";
import { Panel } from "../../src/components/ui/Panel";
import { useOnboardingStore } from "../../src/stores/useOnboardingStore";
import { colors, fonts, radius, spacing } from "../../src/theme";

const ENGINES = [
  {
    key: "body",
    icon: "barbell-outline" as const,
    title: "BODY",
    desc: "Strength, sleep, nutrition. The physical platform.",
    color: colors.body,
  },
  {
    key: "mind",
    icon: "library-outline" as const,
    title: "MIND",
    desc: "Focus, learning, reflection. The cognitive edge.",
    color: colors.mind,
  },
  {
    key: "money",
    icon: "trending-up-outline" as const,
    title: "MONEY",
    desc: "Earn, save, build. The freedom multiplier.",
    color: colors.money,
  },
  {
    key: "charisma",
    icon: "people-outline" as const,
    title: "GENERAL",
    desc: "Voice, presence, connection. The signal you broadcast.",
    color: colors.charisma,
  },
];

export default function OnboardingStep2() {
  const router = useRouter();
  const finish = useOnboardingStore((s) => s.finish);

  const handleSkip = useCallback(() => {
    finish();
    router.replace("/(tabs)");
  }, [finish, router]);

  const handleContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(onboarding)/step-3");
  }, [router]);

  return (
    <OnboardingChrome step={2} onSkip={handleSkip}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>FOUR ENGINES</Text>
          <Text style={styles.title}>The system you'll run.</Text>
          <Text style={styles.subtitle}>
            Each day, every action ladders up to one of these. Your daily
            score is a weighted average — neglect one and it pulls everything
            down.
          </Text>
        </View>

        <View style={styles.list}>
          {ENGINES.map((e) => (
            <Panel key={e.key} style={styles.engineCard}>
              <View style={styles.engineRow}>
                <View
                  style={[
                    styles.iconBox,
                    { borderColor: e.color },
                  ]}
                >
                  <Ionicons name={e.icon} size={20} color={e.color} />
                </View>
                <View style={styles.engineText}>
                  <Text style={[styles.engineTitle, { color: e.color }]}>
                    {e.title}
                  </Text>
                  <Text style={styles.engineDesc}>{e.desc}</Text>
                </View>
              </View>
            </Panel>
          ))}
        </View>

        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.cta,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.ctaText}>CONTINUE</Text>
        </Pressable>
      </ScrollView>
    </OnboardingChrome>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg },
  heroBlock: { marginTop: spacing.lg, gap: spacing.md },
  kicker: { ...fonts.kicker, color: colors.textSecondary, letterSpacing: 2 },
  title: { ...fonts.title, fontSize: 26, letterSpacing: -0.5 },
  subtitle: { ...fonts.body, color: colors.textSecondary, lineHeight: 22 },
  list: { gap: spacing.sm, marginTop: spacing.md },
  engineCard: { padding: spacing.md },
  engineRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  engineText: { flex: 1, gap: 2 },
  engineTitle: { ...fonts.kicker, fontSize: 13, letterSpacing: 2 },
  engineDesc: { ...fonts.body, color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  cta: {
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  ctaText: { ...fonts.kicker, color: colors.bg, fontSize: 13, letterSpacing: 2 },
  pressed: { opacity: 0.7 },
});
