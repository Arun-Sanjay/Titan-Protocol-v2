import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import type { IdentityArchetype } from "../../../stores/useModeStore";

type Props = { onNext: () => void; onBack: () => void };

const ARCHETYPES: { id: IdentityArchetype; label: string; icon: string; desc: string }[] = [
  { id: "athlete",    label: "The Athlete",    icon: "💪", desc: "Discipline through physical mastery" },
  { id: "scholar",    label: "The Scholar",    icon: "📚", desc: "Growth through knowledge and learning" },
  { id: "builder",    label: "The Builder",    icon: "🔨", desc: "Progress through creating and shipping" },
  { id: "warrior",    label: "The Warrior",    icon: "⚔️", desc: "Strength through relentless action" },
  { id: "creator",    label: "The Creator",    icon: "🎨", desc: "Excellence through expression and craft" },
  { id: "strategist", label: "The Strategist", icon: "♟️", desc: "Mastery through planning and execution" },
];

export function StepIdentity({ onNext, onBack }: Props) {
  const identity = useOnboardingStore((s) => s.identity);
  const setIdentity = useOnboardingStore((s) => s.setIdentity);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.backText}>← BACK</Text>
        </Pressable>
        <Text style={styles.kicker}>STEP 1 OF 6</Text>
        <Text style={styles.title}>WHO ARE YOU?</Text>
        <Text style={styles.subtitle}>Choose the archetype that resonates most with how you approach growth.</Text>

        <View style={styles.grid}>
          {ARCHETYPES.map((a) => {
            const selected = identity === a.id;
            return (
              <Pressable
                key={a.id}
                style={[styles.card, selected && styles.cardSelected]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIdentity(a.id);
                }}
              >
                <Text style={styles.cardIcon}>{a.icon}</Text>
                <Text style={[styles.cardLabel, selected && styles.cardLabelSelected]}>{a.label}</Text>
                <Text style={styles.cardDesc}>{a.desc}</Text>
                {selected && <View style={styles.checkBadge}><Text style={styles.checkText}>✓</Text></View>}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Pressable
        style={[styles.btn, !identity && styles.btnDisabled]}
        onPress={() => { if (identity) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onNext(); }}}
        disabled={!identity}
      >
        <Text style={[styles.btnText, !identity && styles.btnTextDisabled]}>CONTINUE</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing["3xl"] },
  scroll: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  backText: { ...fonts.kicker, fontSize: 10, color: colors.textMuted, marginBottom: spacing.xl },
  kicker: { ...fonts.kicker, fontSize: 9, color: colors.textMuted, marginBottom: spacing.xs },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, letterSpacing: 1, marginBottom: spacing.sm },
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.xl },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  card: {
    width: "48%", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: radius.md,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    padding: spacing.md, minHeight: 100,
  },
  cardSelected: { borderColor: colors.primary, backgroundColor: "rgba(255,255,255,0.06)" },
  cardIcon: { fontSize: 28, marginBottom: spacing.sm },
  cardLabel: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 4 },
  cardLabelSelected: { color: colors.primary },
  cardDesc: { fontSize: 11, color: colors.textMuted, lineHeight: 15 },
  checkBadge: {
    position: "absolute", top: spacing.sm, right: spacing.sm,
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  checkText: { fontSize: 12, fontWeight: "700", color: "#000" },

  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.lg, alignItems: "center",
  },
  btnDisabled: { backgroundColor: "rgba(255,255,255,0.08)" },
  btnText: { ...fonts.kicker, fontSize: 13, color: "#000", letterSpacing: 2 },
  btnTextDisabled: { color: colors.textMuted },
});
