import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import type { AppMode } from "../../../stores/useModeStore";

type Props = { onNext: () => void; onBack: () => void };

const MODES: { id: AppMode; label: string; desc: string; features: string[] }[] = [
  {
    id: "full_protocol",
    label: "Full Protocol",
    desc: "The complete experience. Daily guided sessions, skill trees, gamification, and deep analytics.",
    features: ["Daily Protocol session", "Skill trees + XP", "Full analytics", "Suggested missions"],
  },
  {
    id: "tracker",
    label: "Tracker",
    desc: "Simple and focused. Track your tasks across all engines with scores and charts.",
    features: ["Task tracking", "Engine scores", "Weekly comparisons", "Activity heatmap"],
  },
  {
    id: "zen",
    label: "Zen",
    desc: "Calm and minimal. Set a daily intention, track habits, and journal.",
    features: ["Daily intention", "Habit tracking", "Journal reflection"],
  },
];

export function StepMode({ onNext, onBack }: Props) {
  const mode = useOnboardingStore((s) => s.mode);
  const setMode = useOnboardingStore((s) => s.setMode);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(0).duration(400)}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={styles.backText}>{"\u2190"} BACK</Text>
          </Pressable>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(50).duration(400)}>
          <Text style={styles.kicker}>STEP 3 OF 6</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={styles.title}>CHOOSE YOUR MODE</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Text style={styles.subtitle}>You can change this anytime in Settings.</Text>
        </Animated.View>

        <View style={styles.cards}>
          {MODES.map((m, index) => {
            const selected = mode === m.id;
            return (
              <Animated.View key={m.id} entering={FadeInDown.delay(200 + index * 80).duration(500)}>
                <Pressable
                  style={[styles.card, selected && styles.cardSelected]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode(m.id); }}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardLabel, selected && styles.cardLabelSelected]}>{m.label}</Text>
                    {selected && (
                      <View style={styles.checkBadge}><Text style={styles.checkText}>{"\u2713"}</Text></View>
                    )}
                  </View>
                  <Text style={styles.cardDesc}>{m.desc}</Text>
                  <View style={styles.features}>
                    {m.features.map((f) => (
                      <Text key={f} style={styles.feature}>{"\u00B7"} {f}</Text>
                    ))}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      <Pressable
        style={[styles.btn, !mode && styles.btnDisabled]}
        onPress={() => { if (mode) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onNext(); }}}
        disabled={!mode}
      >
        <Text style={[styles.btnText, !mode && styles.btnTextDisabled]}>CONTINUE</Text>
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

  cards: { gap: spacing.md },
  card: {
    backgroundColor: "rgba(255,255,255,0.03)", borderRadius: radius.md,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    padding: spacing.lg,
  },
  cardSelected: { borderColor: colors.primary, backgroundColor: "rgba(255,255,255,0.06)" },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  cardLabel: { fontSize: 18, fontWeight: "700", color: colors.text },
  cardLabelSelected: { color: colors.primary },
  cardDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.md },
  features: { gap: 4 },
  feature: { fontSize: 12, color: colors.textMuted },
  checkBadge: {
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
