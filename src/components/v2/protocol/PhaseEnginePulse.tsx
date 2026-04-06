import React, { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { colors, spacing, fonts } from "../../../theme";
import { useProtocolStore } from "../../../stores/useProtocolStore";
import { useIdentityStore } from "../../../stores/useIdentityStore";
import { getTodayKey } from "../../../lib/date";

const ENGINE_COLORS: Record<string, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  charisma: colors.charisma,
};

const ENGINE_LABELS: Record<string, string> = {
  body: "BODY",
  mind: "MIND",
  money: "MONEY",
  charisma: "CHARISMA",
};

const ENGINE_OPTIONS: Record<string, { label: string; icon: string }[]> = {
  body: [
    { label: "Strength", icon: "barbell-outline" },
    { label: "Cardio", icon: "walk-outline" },
    { label: "Recovery", icon: "bed-outline" },
    { label: "Flexibility", icon: "body-outline" },
  ],
  mind: [
    { label: "Reading", icon: "book-outline" },
    { label: "Deep Work", icon: "code-slash-outline" },
    { label: "Learning", icon: "school-outline" },
    { label: "Reflection", icon: "leaf-outline" },
  ],
  money: [
    { label: "Track spending", icon: "receipt-outline" },
    { label: "Review budget", icon: "pie-chart-outline" },
    { label: "Save", icon: "wallet-outline" },
    { label: "Earn", icon: "trending-up-outline" },
  ],
  charisma: [
    { label: "Confidence", icon: "happy-outline" },
    { label: "Public Speaking", icon: "mic-outline" },
    { label: "Networking", icon: "people-outline" },
    { label: "Presence", icon: "star-outline" },
  ],
};

const IDENTITY_PRIMARY: Record<string, string> = {
  warrior: "body",
  monk: "mind",
  scholar: "mind",
  architect: "money",
  // operator and titan rotate daily
};

function getPrimaryEngine(archetype: string | null): string {
  if (!archetype) return "body";
  if (archetype === "operator" || archetype === "titan") {
    // Rotate through engines daily
    const today = getTodayKey();
    const dayNum = parseInt(today.replace(/-/g, ""), 10);
    const engines = ["body", "mind", "money", "charisma"];
    return engines[dayNum % 4];
  }
  return IDENTITY_PRIMARY[archetype] ?? "body";
}

export function PhaseEnginePulse() {
  const [selected, setSelected] = useState<string | null>(null);
  const completePhase = useProtocolStore((s) => s.completePhase);
  const archetype = useIdentityStore((s) => s.archetype);

  const engine = useMemo(() => getPrimaryEngine(archetype), [archetype]);
  const engineColor = ENGINE_COLORS[engine] ?? colors.primary;
  const options = ENGINE_OPTIONS[engine] ?? ENGINE_OPTIONS.body;

  function handleNext() {
    completePhase("engine_pulse", { engine, focus: selected });
  }

  return (
    <View style={styles.container}>
      <Animated.Text
        entering={FadeIn.duration(400)}
        style={[styles.header, { color: engineColor }]}
      >
        {ENGINE_LABELS[engine]} PULSE
      </Animated.Text>

      <Animated.Text entering={FadeIn.delay(200).duration(400)} style={styles.prompt}>
        What's your focus for {ENGINE_LABELS[engine].toLowerCase()} today?
      </Animated.Text>

      <View style={styles.grid}>
        {options.map((opt, idx) => {
          const isSelected = selected === opt.label;
          return (
            <Animated.View
              key={opt.label}
              entering={FadeInUp.delay(idx * 80).duration(400)}
              style={styles.cardWrapper}
            >
              <Pressable
                style={[
                  styles.card,
                  isSelected && { borderColor: engineColor, borderWidth: 1.5, backgroundColor: engineColor + "10" },
                ]}
                onPress={() => setSelected(opt.label)}
              >
                <Text style={[styles.cardLabel, isSelected && { color: engineColor }]}>
                  {opt.label}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.bottomSpacer} />

      <Pressable
        style={[styles.button, !selected && styles.buttonDisabled]}
        onPress={handleNext}
        disabled={!selected}
      >
        <Text style={[styles.buttonText, !selected && styles.buttonTextDisabled]}>
          NEXT
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    ...fonts.kicker,
    fontSize: 12,
    letterSpacing: 4,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  prompt: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing["2xl"],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "center",
  },
  cardWrapper: {
    width: "46%",
  },
  card: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    alignItems: "center",
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  bottomSpacer: {
    flex: 1,
  },
  button: {
    paddingVertical: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  buttonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.bg,
    letterSpacing: 2,
  },
  buttonTextDisabled: {
    color: colors.textMuted,
  },
});
