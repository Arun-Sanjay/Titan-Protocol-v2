import React, { useCallback, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  FadeInDown,
  Layout,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius, shadows } from "../../../theme";
import { playVoiceLineAsync } from "../../../lib/protocol-audio";
import { Panel } from "../../ui/Panel";
import type { EngineKey } from "../../../db/schema";

// -- Types --------------------------------------------------------------------

type Props = {
  archetype: string;
  onComplete: (engines: string[]) => void;
};

// -- Engine metadata ----------------------------------------------------------

const ENGINE_META: Record<EngineKey, { label: string; color: string; icon: string }> = {
  body:     { label: "Body",     color: colors.body,     icon: "\uD83D\uDCAA" },
  mind:     { label: "Mind",     color: colors.mind,     icon: "\uD83E\udDE0" },
  money:    { label: "Money",    color: colors.money,    icon: "\uD83D\uDCB0" },
  charisma: { label: "Charisma", color: colors.charisma, icon: "\u2728" },
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

// -- Main component -----------------------------------------------------------

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
      <Animated.View
        entering={FadeInDown.delay(0).duration(400)}
        style={styles.header}
      >
        <Text style={styles.kicker}>CONFIGURE</Text>
        <Text style={styles.title}>ENGINE PRIORITY</Text>
        <Text style={styles.subtitle}>
          Drag to rank your engines by importance. Your highest-priority
          engine carries the most weight in your daily score.
        </Text>
      </Animated.View>

      {/* Engine cards */}
      <View style={styles.list}>
        {engines.map((eng, i) => {
          const meta = ENGINE_META[eng];
          return (
            <Animated.View
              key={eng}
              entering={FadeInDown.delay(200 + i * 80).duration(400)}
              layout={Layout.springify().damping(25).stiffness(100)}
            >
              <Panel
                glowColor={meta.color}
                style={styles.cardPanel}
              >
                {/* Rank badge */}
                <View style={[styles.rankBadge, { backgroundColor: meta.color + "18" }]}>
                  <Text style={[styles.rankNum, { color: meta.color }]}>
                    #{i + 1}
                  </Text>
                </View>

                {/* Engine icon + name */}
                <Text style={styles.engineIcon}>{meta.icon}</Text>
                <View style={styles.engineInfo}>
                  <Text style={[styles.engineName, { color: meta.color }]}>
                    {meta.label.toUpperCase()}
                  </Text>
                  <View style={[styles.engineBar, { backgroundColor: meta.color + "30" }]}>
                    <View
                      style={[
                        styles.engineBarFill,
                        {
                          backgroundColor: meta.color,
                          width: `${100 - i * 20}%` as any,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Arrow buttons */}
                <View style={styles.arrows}>
                  <Pressable
                    style={[
                      styles.arrowBtn,
                      i === 0 && styles.arrowBtnDisabled,
                    ]}
                    onPress={() => swap(i, -1)}
                    disabled={i === 0}
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        styles.arrowText,
                        i === 0 && styles.arrowTextDisabled,
                      ]}
                    >
                      {"\u25B2"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.arrowBtn,
                      i === engines.length - 1 && styles.arrowBtnDisabled,
                    ]}
                    onPress={() => swap(i, 1)}
                    disabled={i === engines.length - 1}
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        styles.arrowText,
                        i === engines.length - 1 && styles.arrowTextDisabled,
                      ]}
                    >
                      {"\u25BC"}
                    </Text>
                  </Pressable>
                </View>
              </Panel>
            </Animated.View>
          );
        })}
      </View>

      {/* Confirm button */}
      <Animated.View
        entering={FadeInDown.delay(600).duration(400)}
        style={styles.bottomBar}
      >
        <Pressable style={styles.btn} onPress={handleConfirm}>
          <LinearGradient
            colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.04)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.btnGradient}
          />
          <Text style={styles.btnText}>CONFIRM PRIORITY</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// -- Styles -------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing["4xl"],
    paddingBottom: spacing["3xl"],
    justifyContent: "space-between",
  },

  // Header
  header: {
    marginBottom: spacing.lg,
  },
  kicker: {
    ...fonts.kicker,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  title: {
    ...fonts.heading,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...fonts.small,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Engine list
  list: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
  },
  cardPanel: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },

  // Rank badge
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  rankNum: {
    ...fonts.mono,
    fontSize: 13,
    fontWeight: "800",
  },

  // Engine info
  engineIcon: {
    fontSize: 20,
  },
  engineInfo: {
    flex: 1,
    gap: 6,
  },
  engineName: {
    ...fonts.mono,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
  },
  engineBar: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  engineBarFill: {
    height: "100%",
    borderRadius: 2,
    opacity: 0.7,
  },

  // Arrow buttons
  arrows: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.panelHighlight,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  arrowBtnDisabled: {
    opacity: 0.2,
  },
  arrowText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  arrowTextDisabled: {
    color: colors.textMuted,
  },

  // Confirm button
  bottomBar: {
    marginTop: spacing.xl,
  },
  btn: {
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadows.panel,
  },
  btnGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  btnText: {
    ...fonts.mono,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 3,
    color: colors.text,
  },
});
