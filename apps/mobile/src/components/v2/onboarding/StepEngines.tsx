import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import type { EngineKey } from "../../../db/schema";

type Props = { onNext: () => void; onBack: () => void };

const ENGINE_META: { id: EngineKey; label: string; icon: string; desc: string; color: string }[] = [
  { id: "body",    label: "Body",    icon: "💪", desc: "Physical health, fitness, nutrition, sleep", color: colors.body },
  { id: "mind",    label: "Mind",    icon: "🧠", desc: "Learning, focus, mental clarity, reading",   color: colors.mind },
  { id: "money",   label: "Money",   icon: "💰", desc: "Income, budgets, savings, career growth",    color: colors.money },
  { id: "charisma", label: "Charisma", icon: "⚡", desc: "Social skills, confidence, speaking, presence", color: colors.charisma },
];

export function StepEngines({ onNext, onBack }: Props) {
  const enginePriority = useOnboardingStore((s) => s.enginePriority);
  const setEnginePriority = useOnboardingStore((s) => s.setEnginePriority);

  const moveUp = useCallback((idx: number) => {
    if (idx === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const arr = [...enginePriority];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    setEnginePriority(arr);
  }, [enginePriority, setEnginePriority]);

  const moveDown = useCallback((idx: number) => {
    if (idx === enginePriority.length - 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const arr = [...enginePriority];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    setEnginePriority(arr);
  }, [enginePriority, setEnginePriority]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.backText}>← BACK</Text>
        </Pressable>
        <Text style={styles.kicker}>STEP 4 OF 6</Text>
        <Text style={styles.title}>ENGINE PRIORITY</Text>
        <Text style={styles.subtitle}>
          Arrange your engines by importance. Your top engine gets featured first on the dashboard.
        </Text>

        <View style={styles.list}>
          {enginePriority.map((eng, i) => {
            const meta = ENGINE_META.find((m) => m.id === eng)!;
            return (
              <View key={eng} style={[styles.row, { borderLeftColor: meta.color }]}>
                <Text style={styles.rank}>#{i + 1}</Text>
                <Text style={styles.icon}>{meta.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
                  <Text style={styles.desc}>{meta.desc}</Text>
                </View>
                <View style={styles.arrows}>
                  <Pressable onPress={() => moveUp(i)} hitSlop={6} style={styles.arrow}>
                    <Text style={[styles.arrowText, i === 0 && { opacity: 0.2 }]}>▲</Text>
                  </Pressable>
                  <Pressable onPress={() => moveDown(i)} hitSlop={6} style={styles.arrow}>
                    <Text style={[styles.arrowText, i === enginePriority.length - 1 && { opacity: 0.2 }]}>▼</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Pressable
        style={styles.btn}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onNext(); }}
      >
        <Text style={styles.btnText}>CONTINUE</Text>
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

  list: { gap: spacing.sm },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: "rgba(255,255,255,0.03)", borderRadius: radius.md,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderLeftWidth: 3,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  rank: { ...fonts.mono, fontSize: 14, fontWeight: "700", color: colors.textMuted, width: 28 },
  icon: { fontSize: 22 },
  label: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  desc: { fontSize: 11, color: colors.textMuted, lineHeight: 14 },
  arrows: { gap: 2 },
  arrow: { padding: 4 },
  arrowText: { fontSize: 10, color: colors.textMuted },

  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.lg, alignItems: "center",
  },
  btnText: { ...fonts.kicker, fontSize: 13, color: "#000", letterSpacing: 2 },
});
