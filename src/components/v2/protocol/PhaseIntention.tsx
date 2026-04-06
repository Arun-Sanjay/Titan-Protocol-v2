import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors, spacing, fonts } from "../../../theme";
import { useProtocolStore } from "../../../stores/useProtocolStore";
import { useJournalStore } from "../../../stores/useJournalStore";
import { useIdentityStore } from "../../../stores/useIdentityStore";
import { getTodayKey } from "../../../lib/date";

const MAX_CHARS = 140;

// Identity-specific suggestions
const SUGGESTIONS: Record<string, string[]> = {
  warrior: ["Crush today's training", "Push past yesterday's limits", "Lead with action"],
  monk: ["Find clarity in one moment", "Simplify one thing today", "Practice stillness"],
  titan: ["Outperform yesterday", "Maximize every hour", "Leave nothing undone"],
  architect: ["Build one system today", "Compound one habit", "Review one financial goal"],
  scholar: ["Learn one new concept", "Read for 30 minutes", "Reflect on what I know"],
  operator: ["Balance all four engines", "Fix the weakest link", "Execute the plan"],
};

export function PhaseIntention() {
  const [text, setText] = useState("");
  const completePhase = useProtocolStore((s) => s.completePhase);
  const saveEntry = useJournalStore((s) => s.saveEntry);
  const archetype = useIdentityStore((s) => s.archetype);

  const suggestions = archetype ? SUGGESTIONS[archetype] ?? SUGGESTIONS.operator : SUGGESTIONS.operator;

  function handleNext() {
    if (!text.trim()) return;
    const today = getTodayKey();
    // Save intention as journal entry prefix
    saveEntry(today, `[Intention] ${text.trim()}`);
    completePhase("intention", { text: text.trim() });
  }

  return (
    <View style={styles.container}>
      <Animated.Text entering={FadeIn.duration(400)} style={styles.prompt}>
        What is the one thing within your control today?
      </Animated.Text>

      <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={(t) => setText(t.slice(0, MAX_CHARS))}
          placeholder="Today I will..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={MAX_CHARS}
          autoFocus
        />
        <Text style={styles.counter}>{text.length}/{MAX_CHARS}</Text>
      </Animated.View>

      {/* Suggestion pills */}
      <Animated.View entering={FadeIn.delay(400).duration(400)} style={styles.suggestions}>
        {suggestions.map((s) => (
          <Pressable
            key={s}
            style={styles.pill}
            onPress={() => setText(s)}
          >
            <Text style={styles.pillText}>{s}</Text>
          </Pressable>
        ))}
      </Animated.View>

      <View style={styles.bottomSpacer} />

      <Pressable
        style={[styles.button, !text.trim() && styles.buttonDisabled]}
        onPress={handleNext}
        disabled={!text.trim()}
      >
        <Text style={[styles.buttonText, !text.trim() && styles.buttonTextDisabled]}>
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
  prompt: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: spacing["2xl"],
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    padding: spacing.lg,
    minHeight: 100,
  },
  input: {
    fontSize: 16,
    fontWeight: "400",
    color: colors.text,
    lineHeight: 24,
    flex: 1,
    textAlignVertical: "top",
  },
  counter: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "right",
    marginTop: spacing.sm,
  },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  pillText: {
    fontSize: 13,
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
