import React, { useCallback, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { PanGestureHandler, State as GestureState } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
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

// ── Layout constants ─────────────────────────────────────────────────────────

const ITEM_HEIGHT = 56;
const ITEM_GAP = spacing.sm;
const SWAP_THRESHOLD = (ITEM_HEIGHT + ITEM_GAP) / 2;
const SPRING_CONFIG = { damping: 25, stiffness: 100, mass: 0.8 };

// ── Draggable row ────────────────────────────────────────────────────────────

function DraggableCard({
  engine,
  index,
  total,
  onMoveUp,
  onMoveDown,
}: {
  engine: EngineKey;
  index: number;
  total: number;
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
}) {
  const meta = ENGINE_META[engine];
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIdx = useSharedValue(0);
  const swapAccumulator = useRef(0);
  const currentIndex = useRef(index);
  currentIndex.current = index;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    zIndex: zIdx.value,
    shadowOpacity: zIdx.value > 0 ? 0.3 : 0,
    shadowRadius: zIdx.value > 0 ? 8 : 0,
    shadowOffset: { width: 0, height: zIdx.value > 0 ? 4 : 0 },
    shadowColor: "#000",
    elevation: zIdx.value > 0 ? 8 : 0,
  }));

  const handleSwapDown = useCallback(() => {
    onMoveDown(currentIndex.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onMoveDown]);

  const handleSwapUp = useCallback(() => {
    onMoveUp(currentIndex.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onMoveUp]);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(300)}
      layout={Layout.springify().damping(25).stiffness(100)}
    >
      <PanGestureHandler
        activeOffsetY={[-10, 10]}
        onGestureEvent={(e) => {
          const { translationY } = e.nativeEvent;
          translateY.value = translationY;

          const swapDelta = translationY - swapAccumulator.current;
          if (swapDelta > SWAP_THRESHOLD && currentIndex.current < total - 1) {
            swapAccumulator.current += ITEM_HEIGHT + ITEM_GAP;
            runOnJS(handleSwapDown)();
          } else if (swapDelta < -SWAP_THRESHOLD && currentIndex.current > 0) {
            swapAccumulator.current -= ITEM_HEIGHT + ITEM_GAP;
            runOnJS(handleSwapUp)();
          }
        }}
        onHandlerStateChange={(e) => {
          if (e.nativeEvent.state === GestureState.BEGAN) {
            scale.value = withSpring(1.04, SPRING_CONFIG);
            zIdx.value = 10;
            swapAccumulator.current = 0;
            runOnJS(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium))();
          } else if (
            e.nativeEvent.state === GestureState.END ||
            e.nativeEvent.state === GestureState.CANCELLED ||
            e.nativeEvent.state === GestureState.FAILED
          ) {
            translateY.value = withSpring(0, SPRING_CONFIG);
            scale.value = withSpring(1, SPRING_CONFIG);
            zIdx.value = 0;
          }
        }}
      >
        <Animated.View style={[styles.card, animatedStyle]}>
          {/* Drag handle */}
          <Text style={styles.dragHandle}>{"\u2261"}</Text>

          {/* Rank number */}
          <Text style={styles.rankNum}>#{index + 1}</Text>

          {/* Engine colored dot */}
          <View style={[styles.dot, { backgroundColor: meta.color }]} />

          {/* Engine name */}
          <Text style={[styles.engineName, { color: meta.color }]}>
            {meta.label}
          </Text>
        </Animated.View>
      </PanGestureHandler>
    </Animated.View>
  );
}

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

  const moveUp = useCallback((idx: number) => {
    if (idx === 0) return;
    setEngines((prev) => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  }, []);

  const moveDown = useCallback((idx: number) => {
    setEngines((prev) => {
      if (idx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
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
        <Text style={styles.subtitle}>Drag to reorder</Text>
      </View>

      {/* Engine cards */}
      <View style={styles.list}>
        {engines.map((eng, i) => (
          <DraggableCard
            key={eng}
            engine={eng}
            index={i}
            total={engines.length}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
          />
        ))}
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
    flex: 1,
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
    gap: ITEM_GAP,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    height: ITEM_HEIGHT,
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },

  dragHandle: {
    fontSize: 20,
    color: "rgba(255,255,255,0.30)",
    width: 20,
    textAlign: "center",
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
