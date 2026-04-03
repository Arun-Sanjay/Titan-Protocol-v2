import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";

type Props = { onNext: () => void; onBack: () => void };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function StepSchedule({ onNext, onBack }: Props) {
  const schedule = useOnboardingStore((s) => s.schedule);
  const setSchedule = useOnboardingStore((s) => s.setSchedule);

  const toggleDay = (day: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSchedule({ ...schedule, [day]: !schedule[day] });
  };

  const activeDays = DAYS.filter((d) => schedule[d]).length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(0).duration(400)}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={styles.backText}>{"\u2190"} BACK</Text>
          </Pressable>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(50).duration(400)}>
          <Text style={styles.kicker}>STEP 5 OF 6</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={styles.title}>YOUR SCHEDULE</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Text style={styles.subtitle}>
            Which days will you show up? Select the days you commit to working on your engines.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.daysRow}>
          {DAYS.map((day) => {
            const active = schedule[day];
            return (
              <Pressable
                key={day}
                style={[styles.dayBtn, active && styles.dayBtnActive]}
                onPress={() => toggleDay(day)}
              >
                <Text style={[styles.dayText, active && styles.dayTextActive]}>{day}</Text>
              </Pressable>
            );
          })}
        </Animated.View>

        <Text style={styles.countText}>
          {activeDays} day{activeDays !== 1 ? "s" : ""} per week
        </Text>

        {/* Presets */}
        <Animated.View entering={FadeIn.delay(500).duration(300)} style={styles.presets}>
          <Pressable
            style={styles.preset}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSchedule({ Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false });
            }}
          >
            <Text style={styles.presetText}>WEEKDAYS</Text>
          </Pressable>
          <Pressable
            style={styles.preset}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSchedule({ Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: true });
            }}
          >
            <Text style={styles.presetText}>EVERY DAY</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      <Pressable
        style={[styles.btn, activeDays === 0 && styles.btnDisabled]}
        onPress={() => { if (activeDays > 0) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onNext(); }}}
        disabled={activeDays === 0}
      >
        <Text style={[styles.btnText, activeDays === 0 && styles.btnTextDisabled]}>CONTINUE</Text>
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
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing["2xl"] },

  daysRow: {
    flexDirection: "row", justifyContent: "space-between", gap: spacing.xs,
  },
  dayBtn: {
    flex: 1, aspectRatio: 1, borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
    maxWidth: 52,
  },
  dayBtnActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  dayText: { ...fonts.kicker, fontSize: 10, color: colors.textMuted },
  dayTextActive: { color: colors.primary },

  countText: {
    ...fonts.kicker, fontSize: 9, color: colors.textMuted,
    textAlign: "center", marginTop: spacing.lg, marginBottom: spacing.xl,
  },

  presets: { flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  preset: {
    borderRadius: radius.sm, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  presetText: { ...fonts.kicker, fontSize: 9, color: colors.textSecondary },

  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.lg, alignItems: "center",
  },
  btnDisabled: { backgroundColor: "rgba(255,255,255,0.08)" },
  btnText: { ...fonts.kicker, fontSize: 13, color: "#000", letterSpacing: 2 },
  btnTextDisabled: { color: colors.textMuted },
});
