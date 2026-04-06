import React, { useCallback, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  FadeInDown,
  Layout,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { playVoiceLineAsync } from "../../../lib/protocol-audio";
import type { EngineKey } from "../../../db/schema";

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  archetype: string;
  onComplete: (engines: string[]) => void;
};

// ── Engine metadata ──────────────────────────────────────────────────────────

const ENGINE_META: Record<EngineKey, { label: string; color: string }> = {
  body:     { label: "Body",     color: colors.body },
  mind:     { label: "Mind",     color: colors.mind },
  money:    { label: "Money",    color: colors.money },
  charisma: { label: "Charisma", color: colors.charisma },
};

// Archetype-based default ordering (highest weight first)
const ARCHETYPE_ENGINE_ORDER: Record<string, EngineKey[]> = {
  titan:    ["body", "mind", "money", "charisma"],
  athlete:  ["body", "charisma", "mind", "money"],
  scholar:  ["mind", "charisma", "body", "money"],
  hustler:  ["money", "mind", "charisma", "body"],
  showman:  ["charisma", "mind", "money", "body"],
  warrior:  ["mind", "body", "charisma", "money"],
  founder:  ["money", "mind", "charisma", "body"],
  charmer:  ["charisma", "body", "money", "mind"],
};

// ── Main component ───────────────────────────────────────────────────────────

export function BeatEnginePriority({ archetype, onComplete }: Props) {
  const defaultOrder = ARCHETYPE_ENGINE_ORDER[archetype] ?? ARCHETYPE_ENGINE_ORDER.titan;
  const [engines, setEngines] = useState<EngineKey[]>([...defaultOrder]);

  // Play voice line on mount
  const hasPlayedRef = useRef(false);
  if (!hasPlayedRef.current) {
    hasPlayedRef.current = true;
    playVoiceLineAsync("ONBO-011");
  }

  const swap = useCallback((idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    setEngines((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete(engines);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>ENGINE PRIORITY</Text>
        <Text style={styles.subtitle}>Tap arrows to reorder</Text>
      </View>

      {/* Engine cards */}
      <View style={styles.list}>
        {engines.map((eng, i) => {
          const meta = ENGINE_META[eng];
          return (
            <Animated.View
              key={eng}
              entering={FadeInDown.delay(i * 60).duration(300)}
              layout={Layout.springify().damping(25).stiffness(100)}
            >
              <View style={[styles.card, { borderLeftColor: meta.color }]}>
                {/* Left side: rank + dot + name */}
                <Text style={styles.rankNum}>#{i + 1}</Text>
                <View style={[styles.dot, { backgroundColor: meta.color }]} />
                <Text style={[styles.engineName, { color: meta.color }]}>
                  {meta.label}
                </Text>

                {/* Right side: arrow buttons */}
                <View style={styles.arrows}>
                  <Pressable
                    style={[styles.arrowBtn, i === 0 && styles.arrowBtnDisabled]}
                    onPress={() => swap(i, -1)}
                    disabled={i === 0}
                    hitSlop={8}
                  >
                    <Text style={[styles.arrowText, i === 0 && styles.arrowTextDisabled]}>
                      {"\u25B2"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.arrowBtn, i === engines.length - 1 && styles.arrowBtnDisabled]}
                    onPress={() => swap(i, 1)}
                    disabled={i === engines.length - 1}
                    hitSlop={8}
                  >
                    <Text style={[styles.arrowText, i === engines.length - 1 && styles.arrowTextDisabled]}>
                      {"\u25BC"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          );
        })}
      </View>

      {/* Confirm button */}
      <Pressable style={styles.btn} onPress={handleConfirm}>
        <Text style={styles.btnText}>CONFIRM</Text>
      </Pressable>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing["4xl"],
    paddingBottom: spacing["3xl"],
    justifyContent: "space-between",
  },

  header: {
    marginBottom: spacing.xl,
  },

  title: {
    ...fonts.mono,
    fontSize: 20,
    fontWeight: "700",
    color: "rgba(255,255,255,0.60)",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },

  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.40)",
  },

  list: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.sm,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },

  rankNum: {
    ...fonts.mono,
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.40)",
    width: 24,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  engineName: {
    ...fonts.mono,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    flex: 1,
  },

  arrows: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },

  arrowBtnDisabled: {
    opacity: 0.2,
  },

  arrowText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.50)",
  },

  arrowTextDisabled: {
    color: "rgba(255,255,255,0.15)",
  },

  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.xl,
  },

  btnText: {
    ...fonts.kicker,
    fontSize: 13,
    color: "#000",
    letterSpacing: 2,
  },
});
