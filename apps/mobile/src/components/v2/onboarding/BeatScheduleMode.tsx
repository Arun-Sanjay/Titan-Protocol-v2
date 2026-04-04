import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { playVoiceLineAsync } from "../../../lib/protocol-audio";

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  onComplete: (schedule: boolean[], mode: string, focusEngines?: string[]) => void;
};

type OperatingMode = "titan" | "focus";

// ── Day labels ───────────────────────────────────────────────────────────────

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const DEFAULT_SCHEDULE = [true, true, true, true, true, false, false]; // Mon-Fri

// ── Engine chip data ─────────────────────────────────────────────────────────

const ENGINE_CHIPS: { id: string; label: string; color: string }[] = [
  { id: "body",     label: "Body",     color: colors.body },
  { id: "mind",     label: "Mind",     color: colors.mind },
  { id: "money",    label: "Money",    color: colors.money },
  { id: "charisma", label: "Charisma", color: colors.charisma },
];

// ── Day button ───────────────────────────────────────────────────────────────

function DayButton({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
    }, 80);
    onToggle();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          styles.dayBtn,
          selected ? styles.dayBtnSelected : styles.dayBtnUnselected,
          animStyle,
        ]}
      >
        <Text
          style={[
            styles.dayLabel,
            selected ? styles.dayLabelSelected : styles.dayLabelUnselected,
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Mode card ────────────────────────────────────────────────────────────────

function ModeCard({
  title,
  subtitle,
  selected,
  borderColor,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  borderColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.modeCard,
        selected && { borderColor, borderWidth: 2 },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.modeTitle, selected && { color: borderColor }]}>
        {title}
      </Text>
      <Text style={styles.modeSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

// ── Engine selection chip ────────────────────────────────────────────────────

function EngineChip({
  label,
  color,
  selected,
  onToggle,
}: {
  label: string;
  color: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.chip,
        selected
          ? { backgroundColor: color + "20", borderColor: color }
          : { borderColor: "rgba(255,255,255,0.10)" },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
    >
      <View style={[styles.chipDot, { backgroundColor: selected ? color : "rgba(255,255,255,0.20)" }]} />
      <Text style={[styles.chipLabel, selected && { color }]}>{label}</Text>
    </Pressable>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function BeatScheduleMode({ onComplete }: Props) {
  const [schedule, setSchedule] = useState<boolean[]>([...DEFAULT_SCHEDULE]);
  const [mode, setMode] = useState<OperatingMode>("titan");
  const [focusEngines, setFocusEngines] = useState<string[]>([]);

  // Play voice on mount
  const hasPlayedRef = useRef(false);
  useEffect(() => {
    if (!hasPlayedRef.current) {
      hasPlayedRef.current = true;
      playVoiceLineAsync("ONBO-012");
    }
  }, []);

  const toggleDay = (index: number) => {
    setSchedule((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const toggleFocusEngine = (engineId: string) => {
    setFocusEngines((prev) => {
      if (prev.includes(engineId)) {
        return prev.filter((e) => e !== engineId);
      }
      // Max 3 engines in focus mode
      if (prev.length >= 3) return prev;
      return [...prev, engineId];
    });
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete(
      schedule,
      mode,
      mode === "focus" ? focusEngines : undefined,
    );
  };

  // Validate: at least 1 day selected, and if focus mode, at least 1 engine
  const isValid =
    schedule.some(Boolean) &&
    (mode === "titan" || focusEngines.length >= 1);

  return (
    <View style={styles.container}>
      {/* Active Days section */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={styles.sectionLabel}>ACTIVE DAYS</Text>
        <View style={styles.dayRow}>
          {DAY_LABELS.map((label, i) => (
            <DayButton
              key={i}
              label={label}
              selected={schedule[i]}
              onToggle={() => toggleDay(i)}
            />
          ))}
        </View>
      </Animated.View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Operating Mode section */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <Text style={styles.sectionLabel}>OPERATING MODE</Text>
        <View style={styles.modeRow}>
          <ModeCard
            title="TITAN MODE"
            subtitle="All 4 engines"
            selected={mode === "titan"}
            borderColor={colors.success}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMode("titan");
            }}
          />
          <ModeCard
            title="FOCUS MODE"
            subtitle="Choose 1-3"
            selected={mode === "focus"}
            borderColor={colors.charisma}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMode("focus");
            }}
          />
        </View>

        {/* Focus engine chips — visible only in focus mode */}
        {mode === "focus" && (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={styles.chipRow}
          >
            {ENGINE_CHIPS.map((eng) => (
              <EngineChip
                key={eng.id}
                label={eng.label}
                color={eng.color}
                selected={focusEngines.includes(eng.id)}
                onToggle={() => toggleFocusEngine(eng.id)}
              />
            ))}
          </Animated.View>
        )}
      </Animated.View>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Confirm button */}
      <Pressable
        style={[styles.btn, !isValid && styles.btnDisabled]}
        onPress={handleConfirm}
        disabled={!isValid}
      >
        <Text style={[styles.btnText, !isValid && { opacity: 0.4 }]}>CONFIRM</Text>
      </Pressable>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const DAY_BTN_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing["4xl"],
    paddingBottom: spacing["3xl"],
  },

  sectionLabel: {
    ...fonts.kicker,
    fontSize: 10,
    color: "rgba(255,255,255,0.50)",
    letterSpacing: 3,
    marginBottom: spacing.md,
  },

  // ── Days ───────────────────────────────────────────────────────────────────
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.xs,
  },

  dayBtn: {
    width: DAY_BTN_SIZE,
    height: DAY_BTN_SIZE,
    borderRadius: DAY_BTN_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },

  dayBtnSelected: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },

  dayBtnUnselected: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.20)",
  },

  dayLabel: {
    ...fonts.mono,
    fontSize: 13,
    fontWeight: "700",
  },

  dayLabelSelected: {
    color: "#000000",
  },

  dayLabelUnselected: {
    color: "rgba(255,255,255,0.40)",
  },

  // ── Divider ────────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginVertical: spacing.xl,
  },

  // ── Mode cards ─────────────────────────────────────────────────────────────
  modeRow: {
    flexDirection: "row",
    gap: spacing.md,
  },

  modeCard: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },

  modeTitle: {
    ...fonts.mono,
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.60)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },

  modeSubtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.30)",
  },

  // ── Engine chips ───────────────────────────────────────────────────────────
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },

  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  chipLabel: {
    ...fonts.mono,
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.40)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // ── Button ─────────────────────────────────────────────────────────────────
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },

  btnDisabled: {
    opacity: 0.3,
  },

  btnText: {
    ...fonts.kicker,
    fontSize: 13,
    color: "#000",
    letterSpacing: 2,
  },
});
