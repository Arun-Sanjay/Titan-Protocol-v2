import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { OnboardingChrome } from "../../src/components/ui/OnboardingChrome";
import { Panel } from "../../src/components/ui/Panel";
import { useOnboardingStore } from "../../src/stores/useOnboardingStore";
import { upsertProfile } from "../../src/services/profile";
import { logError } from "../../src/lib/error-log";
import { useQueryClient } from "@tanstack/react-query";
import { profileQueryKey } from "../../src/hooks/queries/useProfile";
import type { Database } from "../../src/types/supabase";

import { colors, fonts, radius, spacing } from "../../src/theme";

type ArchetypeKey = Database["public"]["Enums"]["archetype"];

const ARCHETYPES: {
  key: ArchetypeKey;
  label: string;
  tagline: string;
  color: string;
}[] = [
  { key: "athlete", label: "Athlete", tagline: "Body-first", color: colors.body },
  { key: "scholar", label: "Scholar", tagline: "Mind-first", color: colors.mind },
  { key: "hustler", label: "Hustler", tagline: "Money-first", color: colors.money },
  { key: "showman", label: "Showman", tagline: "Charisma-first", color: colors.charisma },
  { key: "warrior", label: "Warrior", tagline: "Body + Discipline", color: colors.body },
  { key: "founder", label: "Founder", tagline: "Mind + Money", color: colors.money },
  { key: "charmer", label: "Charmer", tagline: "Charisma + Mind", color: colors.charisma },
  { key: "titan", label: "Titan", tagline: "All four", color: colors.text },
];

export default function OnboardingStep3() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const finish = useOnboardingStore((s) => s.finish);
  const [selected, setSelected] = useState<ArchetypeKey | null>(null);
  const [saving, setSaving] = useState(false);

  const completeOnboarding = useCallback(
    async (archetype: ArchetypeKey | null) => {
      setSaving(true);
      try {
        if (archetype) {
          await upsertProfile({
            archetype,
            onboarding_completed: true,
          });
        } else {
          await upsertProfile({ onboarding_completed: true });
        }
        await queryClient.invalidateQueries({ queryKey: profileQueryKey });
        finish();
        router.replace("/(tabs)");
      } catch (e) {
        logError("onboarding.step3.submit", e);
        Alert.alert("Save failed", "We couldn't save your choice. Try again or skip.");
        setSaving(false);
      }
    },
    [queryClient, finish, router],
  );

  const handleSkip = useCallback(() => {
    void completeOnboarding(null);
  }, [completeOnboarding]);

  const handleSubmit = useCallback(() => {
    if (!selected) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void completeOnboarding(selected);
  }, [selected, completeOnboarding]);

  return (
    <OnboardingChrome step={3} onSkip={handleSkip}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>STEP 3 · OPTIONAL</Text>
          <Text style={styles.title}>Pick your archetype.</Text>
          <Text style={styles.subtitle}>
            Weights the daily Titan Score so your strongest engine carries
            more. You can change this any time in Profile, or skip and we'll
            weigh equally.
          </Text>
        </View>

        <View style={styles.grid}>
          {ARCHETYPES.map((a) => {
            const active = selected === a.key;
            return (
              <Pressable
                key={a.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelected(a.key);
                }}
                disabled={saving}
                style={({ pressed }) => [
                  styles.cell,
                  pressed && styles.pressed,
                ]}
              >
                <Panel
                  style={[
                    styles.archetypeCard,
                    active && {
                      borderColor: a.color,
                      backgroundColor: colors.surfaceBorderStrong,
                    },
                  ]}
                >
                  {active && (
                    <View style={[styles.checkBadge, { backgroundColor: a.color }]}>
                      <Ionicons name="checkmark" size={12} color={colors.bg} />
                    </View>
                  )}
                  <Text style={[styles.archetypeLabel, { color: a.color }]}>
                    {a.label}
                  </Text>
                  <Text style={styles.archetypeTag}>{a.tagline}</Text>
                </Panel>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={!selected || saving}
          style={({ pressed }) => [
            styles.cta,
            (!selected || saving) && styles.ctaDisabled,
            pressed && selected && styles.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.ctaText}>
              {selected ? "LOCK IN" : "PICK ONE OR SKIP"}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </OnboardingChrome>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg },
  heroBlock: { marginTop: spacing.md, gap: spacing.md },
  kicker: { ...fonts.kicker, color: colors.textMuted, letterSpacing: 2 },
  title: { ...fonts.title, fontSize: 26, letterSpacing: -0.5 },
  subtitle: { ...fonts.body, color: colors.textSecondary, lineHeight: 22 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
    marginTop: spacing.sm,
  },
  cell: { width: "50%", padding: spacing.xs },
  archetypeCard: {
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 80,
  },
  checkBadge: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  archetypeLabel: { ...fonts.kicker, fontSize: 13, letterSpacing: 1.5 },
  archetypeTag: { ...fonts.body, color: colors.textSecondary, fontSize: 12 },
  cta: {
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  ctaDisabled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.panelBorder },
  ctaText: { ...fonts.kicker, color: colors.bg, fontSize: 13, letterSpacing: 2 },
  pressed: { opacity: 0.7 },
});
