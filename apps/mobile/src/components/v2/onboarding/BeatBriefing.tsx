import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  Easing,
  FadeInRight,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { playVoiceLineAsync } from "../../../lib/protocol-audio";

// ── Types ────────────────────────────────────────────────────────────────────

type TaskItem = {
  title: string;
  engine: string;
};

type Props = {
  tasks: TaskItem[];
  onComplete: () => void;
};

// ── Engine color map ─────────────────────────────────────────────────────────

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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ── Phase components ─────────────────────────────────────────────────────────

function ConfigLocked({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(0);
  const pulseOpacity = useSharedValue(0);
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);
  const dot4 = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 400 });
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.4, { duration: 400 }),
        ),
        3,
        true,
      );
      // Engine dots light up in sequence
      setTimeout(() => { dot1.value = withTiming(1, { duration: 200 }); }, 200);
      setTimeout(() => { dot2.value = withTiming(1, { duration: 200 }); }, 500);
      setTimeout(() => { dot3.value = withTiming(1, { duration: 200 }); }, 800);
      setTimeout(() => { dot4.value = withTiming(1, { duration: 200 }); }, 1100);
    } else {
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const dotStyle = (sv: Animated.SharedValue<number>, color: string) =>
    useAnimatedStyle(() => ({
      opacity: sv.value,
      backgroundColor: color,
    }));

  const dot1Style = dotStyle(dot1, colors.body);
  const dot2Style = dotStyle(dot2, colors.mind);
  const dot3Style = dotStyle(dot3, colors.money);
  const dot4Style = dotStyle(dot4, colors.charisma);

  return (
    <Animated.View style={[styles.phaseCenter, containerStyle]}>
      <Text style={styles.configText}>CONFIGURATION LOCKED</Text>
      <Animated.Text style={[styles.systemsText, pulseStyle]}>
        ALL SYSTEMS ONLINE
      </Animated.Text>
      <View style={styles.dotRow}>
        <Animated.View style={[styles.engineDot, dot1Style]} />
        <Animated.View style={[styles.engineDot, dot2Style]} />
        <Animated.View style={[styles.engineDot, dot3Style]} />
        <Animated.View style={[styles.engineDot, dot4Style]} />
      </View>
    </Animated.View>
  );
}

function OpTitle({ visible }: { visible: boolean }) {
  const scale = useSharedValue(1.3);
  const opacity = useSharedValue(0);
  const statusOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1.0, { damping: 12, stiffness: 150, mass: 0.8 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      setTimeout(() => {
        statusOpacity.value = withTiming(1, { duration: 300 });
      }, 400);
    }
  }, [visible]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const statusStyle = useAnimatedStyle(() => ({
    opacity: statusOpacity.value,
  }));

  return (
    <View style={styles.opTitleWrap}>
      <Animated.Text style={[styles.opTitle, titleStyle]}>
        OPERATION: FIRST LIGHT
      </Animated.Text>
      <Animated.Text style={[styles.opStatus, statusStyle]}>
        STATUS: ACTIVE
      </Animated.Text>
    </View>
  );
}

function TaskRow({
  task,
  index,
  visible,
}: {
  task: TaskItem;
  index: number;
  visible: boolean;
}) {
  const dotColor = ENGINE_COLORS[task.engine] ?? colors.textMuted;
  const engineLabel = ENGINE_LABELS[task.engine] ?? task.engine.toUpperCase();

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 400).duration(400).springify()}
      style={styles.taskRow}
    >
      <View style={[styles.taskDot, { backgroundColor: dotColor }]} />
      <Text style={styles.taskTitle} numberOfLines={1}>
        {task.title}
      </Text>
      <Text style={[styles.taskEngine, { color: dotColor }]}>
        {engineLabel}
      </Text>
    </Animated.View>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function BeatBriefing({ tasks, onComplete }: Props) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [phase, setPhase] = useState(0);
  const [tasksVisible, setTasksVisible] = useState(false);

  // Screen flash for execute moment
  const flashOpacity = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  useEffect(() => {
    const t = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timers.current.push(id);
      return id;
    };

    // Phase 1 (0s): Config locked
    setPhase(1);
    playVoiceLineAsync("ONBO-015");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Phase 2 (4s): Fade out config, darken
    t(() => {
      setPhase(2);
    }, 4000);

    // Phase 3 (6s): Op title slams in
    t(() => {
      setPhase(3);
      playVoiceLineAsync("ONBO-016");
    }, 6000);

    // Phase 4 (10s): Tasks appear
    t(() => {
      setPhase(4);
      setTasksVisible(true);
    }, 10000);

    // Phase 5: Execute — after all tasks visible (stagger 400ms each + buffer)
    const executeTime = 10000 + tasks.length * 400 + 1500;
    t(() => {
      setPhase(5);
      playVoiceLineAsync("ONBO-017");

      // Heavy double-tap haptic
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 100);

      // Flash/pulse across screen
      flashOpacity.value = withSequence(
        withTiming(0.4, { duration: 100 }),
        withTiming(0, { duration: 400 }),
      );
    }, executeTime);

    // Complete after 1.5s hold
    t(() => {
      onComplete();
    }, executeTime + 1500);

    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Phase 1: Config locked */}
      {(phase === 1) && <ConfigLocked visible={true} />}

      {/* Phase 2: Dark pause */}
      {(phase === 2) && <View style={styles.darkPause} />}

      {/* Phase 3+: Op title and tasks */}
      {phase >= 3 && (
        <View style={styles.briefingContent}>
          <OpTitle visible={phase >= 3} />

          {/* Task list */}
          {tasksVisible && (
            <View style={styles.taskList}>
              {tasks.map((task, i) => (
                <TaskRow
                  key={i}
                  task={task}
                  index={i}
                  visible={true}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Flash overlay */}
      <Animated.View
        style={[styles.flash, flashStyle]}
        pointerEvents="none"
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },

  // ── Phase 1: Config locked ──
  phaseCenter: {
    alignItems: "center",
    gap: spacing.md,
  },

  configText: {
    ...fonts.mono,
    fontSize: 16,
    fontWeight: "700",
    color: colors.success,
    letterSpacing: 3,
    textTransform: "uppercase",
  },

  systemsText: {
    ...fonts.mono,
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  dotRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },

  engineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  // ── Phase 2: Dark pause ──
  darkPause: {
    flex: 1,
  },

  // ── Phase 3+: Briefing content ──
  briefingContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },

  opTitleWrap: {
    alignItems: "center",
    marginBottom: spacing["3xl"],
  },

  opTitle: {
    ...fonts.mono,
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 3,
    textTransform: "uppercase",
    textAlign: "center",
    textShadowColor: "rgba(255,255,255,0.30)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  opStatus: {
    ...fonts.mono,
    fontSize: 12,
    fontWeight: "600",
    color: colors.success,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: spacing.sm,
  },

  // ── Task list ──
  taskList: {
    width: "100%",
    gap: spacing.md,
  },

  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },

  taskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  taskTitle: {
    flex: 1,
    ...fonts.mono,
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.80)",
  },

  taskEngine: {
    ...fonts.mono,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  // ── Flash overlay ──
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
  },
});
