import React, { useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { PanGestureHandler, State as GestureState } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import type { EngineKey } from "../../../db/schema";

type Props = { onNext: () => void; onBack: () => void };

const ITEM_HEIGHT = 72;
const ITEM_GAP = spacing.sm;
const SWAP_THRESHOLD = (ITEM_HEIGHT + ITEM_GAP) / 2;

const ENGINE_META: { id: EngineKey; label: string; icon: string; desc: string; color: string }[] = [
  { id: "body",    label: "Body",    icon: "\u{1F4AA}", desc: "Physical health, fitness, nutrition, sleep", color: colors.body },
  { id: "mind",    label: "Mind",    icon: "\u{1F9E0}", desc: "Learning, focus, mental clarity, reading",   color: colors.mind },
  { id: "money",   label: "Money",   icon: "\u{1F4B0}", desc: "Income, budgets, savings, career growth",    color: colors.money },
  { id: "charisma", label: "Charisma", icon: "\u{1F5E3}\u{FE0F}", desc: "Confidence, public speaking, networking, presence", color: colors.charisma },
];

function DraggableRow({
  eng,
  index,
  total,
  meta,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
}: {
  eng: EngineKey;
  index: number;
  total: number;
  meta: (typeof ENGINE_META)[number];
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
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

  const handleDragStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDragStart();
  }, [onDragStart]);

  const handleDragEnd = useCallback(() => {
    onDragEnd();
  }, [onDragEnd]);

  return (
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
          scale.value = withSpring(1.03, { damping: 15, stiffness: 200 });
          zIdx.value = 10;
          swapAccumulator.current = 0;
          runOnJS(handleDragStart)();
        } else if (
          e.nativeEvent.state === GestureState.END ||
          e.nativeEvent.state === GestureState.CANCELLED ||
          e.nativeEvent.state === GestureState.FAILED
        ) {
          translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
          scale.value = withSpring(1, { damping: 15, stiffness: 200 });
          zIdx.value = 0;
          runOnJS(handleDragEnd)();
        }
      }}
    >
      <Animated.View style={[styles.row, { borderLeftColor: meta.color }, animatedStyle]}>
        <Text style={styles.dragHandle}>{"\u2801\u2801\u2801"}</Text>
        <Text style={styles.rank}>#{index + 1}</Text>
        <Text style={styles.icon}>{meta.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.desc}>{meta.desc}</Text>
        </View>
        <View style={styles.arrows}>
          <Pressable onPress={() => onMoveUp(index)} hitSlop={6} style={styles.arrow}>
            <Text style={[styles.arrowText, index === 0 && { opacity: 0.2 }]}>{"\u25B2"}</Text>
          </Pressable>
          <Pressable onPress={() => onMoveDown(index)} hitSlop={6} style={styles.arrow}>
            <Text style={[styles.arrowText, index === total - 1 && { opacity: 0.2 }]}>{"\u25BC"}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </PanGestureHandler>
  );
}

export function StepEngines({ onNext, onBack }: Props) {
  const enginePriority = useOnboardingStore((s) => s.enginePriority);
  const setEnginePriority = useOnboardingStore((s) => s.setEnginePriority);
  const scrollRef = useRef<ScrollView>(null);
  const isDragging = useRef(false);

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
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isDragging.current}
      >
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.backText}>{"\u2190"} BACK</Text>
        </Pressable>
        <Text style={styles.kicker}>STEP 4 OF 6</Text>
        <Text style={styles.title}>ENGINE PRIORITY</Text>
        <Text style={styles.subtitle}>
          Arrange your engines by importance. Your top engine gets featured first on the dashboard.
        </Text>

        <Text style={styles.hint}>
          Hold and drag to reorder your engines. Your #1 engine gets dashboard priority.
        </Text>

        <View style={styles.list}>
          {enginePriority.map((eng, i) => {
            const meta = ENGINE_META.find((m) => m.id === eng)!;
            return (
              <DraggableRow
                key={eng}
                eng={eng}
                index={i}
                total={enginePriority.length}
                meta={meta}
                onMoveUp={moveUp}
                onMoveDown={moveDown}
                onDragStart={() => { isDragging.current = true; }}
                onDragEnd={() => { isDragging.current = false; }}
              />
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
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },

  hint: {
    ...fonts.caption,
    fontStyle: "italic",
    textAlign: "center",
    textTransform: "none",
    marginBottom: spacing.md,
  },

  list: { gap: ITEM_GAP },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.03)", borderRadius: radius.md,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderLeftWidth: 3,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.md,
    height: ITEM_HEIGHT,
  },
  dragHandle: {
    fontSize: 16,
    color: colors.textMuted,
    opacity: 0.5,
    width: 20,
    textAlign: "center",
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
