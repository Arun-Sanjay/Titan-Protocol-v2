import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  LayoutAnimation,
} from "react-native";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, fonts, radius } from "../../../theme";
import {
  useEngineStore,
  selectAllTasksForDate,
  ENGINES,
  type TaskWithStatus,
} from "../../../stores/useEngineStore";
import { useProfileStore, XP_REWARDS } from "../../../stores/useProfileStore";
import { getTodayKey } from "../../../lib/date";
import { getCurrentChapter, getDayNumber } from "../../../data/chapters";
import { getJSON } from "../../../db/storage";
import { evaluateAllTrees } from "../../../lib/skill-tree-evaluator";

/* ─── Try Skia import ─────────────────────────────────────────────── */
let SkiaAvailable = false;
let Canvas: any;
let SkiaCircle: any;
let SkiaLine: any;
let SkiaGroup: any;
let SkiaPaint: any;
let SkiaText: any;
let SkiaPath: any;
let useFont: any;
let Blur: any;
let Shadow: any;

try {
  const Skia = require("@shopify/react-native-skia");
  Canvas = Skia.Canvas;
  SkiaCircle = Skia.Circle;
  SkiaLine = Skia.Line;
  SkiaGroup = Skia.Group;
  SkiaPaint = Skia.Paint;
  SkiaText = Skia.Text as any;
  SkiaPath = Skia.Path;
  useFont = Skia.useFont;
  Blur = Skia.Blur;
  Shadow = Skia.Shadow;
  SkiaAvailable = true;
} catch {
  SkiaAvailable = false;
}

/* ─── Constants ────────────────────────────────────────────────────── */
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CANVAS_HEIGHT = 320;
const CANVAS_PADDING = 24;

const ENGINE_COLORS: Record<string, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  charisma: colors.charisma,
};

const ENGINE_DIM_COLORS: Record<string, string> = {
  body: colors.bodyDim,
  mind: colors.mindDim,
  money: colors.moneyDim,
  charisma: colors.charismaDim,
};

/* ─── Pin position calculator ──────────────────────────────────────── */
type PinData = {
  x: number;
  y: number;
  r: number;
  color: string;
  dimColor: string;
  label: string;
  completed: boolean;
  kind: "boss" | "main" | "secondary";
  taskId?: number;
  engine?: string;
};

function layoutPins(
  bossName: string,
  isBossActive: boolean,
  mainMissions: TaskWithStatus[],
  sideQuests: TaskWithStatus[],
  canvasW: number,
): PinData[] {
  const pins: PinData[] = [];
  const cx = canvasW / 2;

  // Boss pin at top center
  pins.push({
    x: cx,
    y: 50,
    r: 30,
    color: isBossActive ? colors.danger : "rgba(248,113,113,0.4)",
    dimColor: colors.dangerDim,
    label: bossName,
    completed: false,
    kind: "boss",
  });

  // Main missions in an arc below the boss
  const mainCount = mainMissions.length;
  const mainY = 140;
  const mainSpread = Math.min(canvasW - 80, mainCount * 80);
  const mainStartX = cx - mainSpread / 2;
  const mainStep = mainCount > 1 ? mainSpread / (mainCount - 1) : 0;

  mainMissions.forEach((task, i) => {
    const eng = task.engine || "body";
    pins.push({
      x: mainCount === 1 ? cx : mainStartX + i * mainStep,
      y: mainY + (i % 2 === 0 ? 0 : 18),
      r: 20,
      color: ENGINE_COLORS[eng] || colors.body,
      dimColor: ENGINE_DIM_COLORS[eng] || colors.bodyDim,
      label: task.title.length > 14 ? task.title.slice(0, 12) + ".." : task.title,
      completed: task.completed,
      kind: "main",
      taskId: task.id!,
      engine: eng,
    });
  });

  // Side quests below main missions
  const sideCount = sideQuests.length;
  const sideY = 230;
  const sideSpread = Math.min(canvasW - 60, sideCount * 65);
  const sideStartX = cx - sideSpread / 2;
  const sideStep = sideCount > 1 ? sideSpread / (sideCount - 1) : 0;

  sideQuests.forEach((task, i) => {
    const eng = task.engine || "body";
    pins.push({
      x: sideCount === 1 ? cx : sideStartX + i * sideStep,
      y: sideY + (i % 2 === 0 ? 8 : -8),
      r: 15,
      color: ENGINE_COLORS[eng] || colors.body,
      dimColor: ENGINE_DIM_COLORS[eng] || colors.bodyDim,
      label: task.title.length > 12 ? task.title.slice(0, 10) + ".." : task.title,
      completed: task.completed,
      kind: "secondary",
      taskId: task.id!,
      engine: eng,
    });
  });

  return pins;
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Skia Canvas Board                                                 */
/* ═══════════════════════════════════════════════════════════════════ */
function SkiaPinBoard({
  pins,
  canvasWidth,
}: {
  pins: PinData[];
  canvasWidth: number;
}) {
  if (!SkiaAvailable || !Canvas) return null;

  const boss = pins.find((p) => p.kind === "boss");
  const mainPins = pins.filter((p) => p.kind === "main");
  const sidePins = pins.filter((p) => p.kind === "secondary");

  return (
    <Canvas style={{ width: canvasWidth, height: CANVAS_HEIGHT }}>
      {/* ── Background noise dots ────────────────────────────── */}
      <SkiaGroup opacity={0.06}>
        {Array.from({ length: 60 }).map((_, i) => (
          <SkiaCircle
            key={`noise-${i}`}
            cx={((i * 137 + 41) % canvasWidth)}
            cy={((i * 89 + 23) % CANVAS_HEIGHT)}
            r={1}
            color="white"
          />
        ))}
      </SkiaGroup>

      {/* ── Threads: boss -> main missions ───────────────────── */}
      {boss &&
        mainPins.map((pin, i) => (
          <SkiaGroup key={`thread-main-${i}`} opacity={pin.completed ? 0.25 : 0.6}>
            <SkiaLine
              p1={{ x: boss.x, y: boss.y + boss.r }}
              p2={{ x: pin.x, y: pin.y - pin.r }}
              color={pin.color}
              strokeWidth={pin.completed ? 1 : 1.5}
              style="stroke"
            >
              {!pin.completed && <Blur blur={3} />}
            </SkiaLine>
          </SkiaGroup>
        ))}

      {/* ── Threads: main -> side quests ──────────────────────── */}
      {mainPins.length > 0 &&
        sidePins.map((sidePin, si) => {
          // Connect each side quest to nearest main
          const nearest = mainPins.reduce(
            (best, mp) => {
              const d = Math.abs(mp.x - sidePin.x) + Math.abs(mp.y - sidePin.y);
              return d < best.d ? { pin: mp, d } : best;
            },
            { pin: mainPins[0], d: Infinity },
          ).pin;
          return (
            <SkiaGroup
              key={`thread-side-${si}`}
              opacity={sidePin.completed ? 0.15 : 0.35}
            >
              <SkiaLine
                p1={{ x: nearest.x, y: nearest.y + nearest.r }}
                p2={{ x: sidePin.x, y: sidePin.y - sidePin.r }}
                color={sidePin.color}
                strokeWidth={1}
                style="stroke"
              >
                {!sidePin.completed && <Blur blur={2} />}
              </SkiaLine>
            </SkiaGroup>
          );
        })}

      {/* ── Boss node ────────────────────────────────────────── */}
      {boss && (
        <SkiaGroup>
          {/* outer glow */}
          <SkiaCircle cx={boss.x} cy={boss.y} r={boss.r + 8} color={boss.color}>
            <Blur blur={12} />
          </SkiaCircle>
          {/* main circle */}
          <SkiaCircle cx={boss.x} cy={boss.y} r={boss.r} color={boss.color} />
          {/* inner dark */}
          <SkiaCircle cx={boss.x} cy={boss.y} r={boss.r - 4} color="#1a0505" />
          {/* skull icon dot */}
          <SkiaCircle cx={boss.x} cy={boss.y} r={6} color={boss.color} opacity={0.8} />
        </SkiaGroup>
      )}

      {/* ── Main mission pins ────────────────────────────────── */}
      {mainPins.map((pin, i) => (
        <SkiaGroup key={`main-${i}`} opacity={pin.completed ? 0.4 : 1}>
          {/* glow */}
          {!pin.completed && (
            <SkiaCircle cx={pin.x} cy={pin.y} r={pin.r + 6} color={pin.color}>
              <Blur blur={8} />
            </SkiaCircle>
          )}
          {/* pin body */}
          <SkiaCircle cx={pin.x} cy={pin.y} r={pin.r} color={pin.completed ? "rgba(255,255,255,0.12)" : pin.color} />
          <SkiaCircle cx={pin.x} cy={pin.y} r={pin.r - 3} color="#0a0a0a" />
          {/* pin head dot */}
          <SkiaCircle cx={pin.x} cy={pin.y - pin.r + 3} r={3} color={pin.color} />
          {/* completed check mark center */}
          {pin.completed && (
            <SkiaCircle cx={pin.x} cy={pin.y} r={5} color={colors.success} />
          )}
        </SkiaGroup>
      ))}

      {/* ── Side quest pins ──────────────────────────────────── */}
      {sidePins.map((pin, i) => (
        <SkiaGroup key={`side-${i}`} opacity={pin.completed ? 0.3 : 0.7}>
          {/* subtle glow */}
          {!pin.completed && (
            <SkiaCircle cx={pin.x} cy={pin.y} r={pin.r + 4} color={pin.color}>
              <Blur blur={5} />
            </SkiaCircle>
          )}
          {/* pin body */}
          <SkiaCircle cx={pin.x} cy={pin.y} r={pin.r} color={pin.completed ? "rgba(255,255,255,0.08)" : pin.color} opacity={0.7} />
          <SkiaCircle cx={pin.x} cy={pin.y} r={pin.r - 2} color="#0a0a0a" />
          {/* pin head */}
          <SkiaCircle cx={pin.x} cy={pin.y - pin.r + 2} r={2} color={pin.color} />
          {pin.completed && (
            <SkiaCircle cx={pin.x} cy={pin.y} r={4} color={colors.success} opacity={0.8} />
          )}
        </SkiaGroup>
      ))}
    </Canvas>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Fallback RN Pin Board (no Skia)                                   */
/* ═══════════════════════════════════════════════════════════════════ */
function FallbackPinBoard({ pins }: { pins: PinData[] }) {
  return (
    <View style={fb.board}>
      {/* Noise dots */}
      {Array.from({ length: 20 }).map((_, i) => (
        <View
          key={`dot-${i}`}
          style={[
            fb.noiseDot,
            {
              left: ((i * 137 + 41) % (SCREEN_WIDTH - 48)),
              top: ((i * 89 + 23) % CANVAS_HEIGHT),
            },
          ]}
        />
      ))}

      {/* Thread lines (simplified as absolute positioned thin views) */}
      {pins
        .filter((p) => p.kind === "boss")
        .map((boss) =>
          pins
            .filter((p) => p.kind === "main")
            .map((pin, i) => {
              const dx = pin.x - boss.x;
              const dy = pin.y - (boss.y + boss.r);
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              return (
                <View
                  key={`line-b-m-${i}`}
                  style={[
                    fb.thread,
                    {
                      left: boss.x,
                      top: boss.y + boss.r,
                      width: len,
                      backgroundColor: pin.completed
                        ? "rgba(255,255,255,0.06)"
                        : pin.color + "40",
                      transform: [{ rotate: `${angle}deg` }],
                    },
                  ]}
                />
              );
            }),
        )}

      {/* Pins */}
      {pins.map((pin, i) => (
        <View
          key={`pin-${i}`}
          style={[
            fb.pin,
            {
              left: pin.x - pin.r,
              top: pin.y - pin.r,
              width: pin.r * 2,
              height: pin.r * 2,
              borderRadius: pin.r,
              borderColor: pin.completed ? "rgba(255,255,255,0.15)" : pin.color,
              opacity: pin.completed
                ? 0.4
                : pin.kind === "secondary"
                  ? 0.7
                  : 1,
              shadowColor: pin.completed ? "transparent" : pin.color,
            },
          ]}
        >
          {/* Inner dark */}
          <View
            style={[
              fb.pinInner,
              {
                width: (pin.r - 3) * 2,
                height: (pin.r - 3) * 2,
                borderRadius: pin.r - 3,
              },
            ]}
          />
          {/* Pin head dot */}
          <View
            style={[
              fb.pinHead,
              {
                backgroundColor: pin.color,
                top: 2,
              },
            ]}
          />
          {/* Completed indicator */}
          {pin.completed && (
            <View style={fb.checkDot}>
              <Ionicons name="checkmark" size={pin.r > 20 ? 14 : 10} color="#fff" />
            </View>
          )}
        </View>
      ))}

      {/* Labels */}
      {pins.map((pin, i) => (
        <Text
          key={`label-${i}`}
          style={[
            fb.pinLabel,
            {
              left: pin.x - 40,
              top: pin.y + pin.r + 4,
              color: pin.kind === "boss" ? colors.danger : "rgba(255,255,255,0.45)",
              fontSize: pin.kind === "boss" ? 10 : 8,
              fontWeight: pin.kind === "boss" ? "700" : "500",
            },
          ]}
          numberOfLines={1}
        >
          {pin.label}
        </Text>
      ))}
    </View>
  );
}

/* Fallback board styles */
const fb = StyleSheet.create({
  board: {
    width: "100%",
    height: CANVAS_HEIGHT,
    position: "relative",
    overflow: "hidden",
  },
  noiseDot: {
    position: "absolute",
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  thread: {
    position: "absolute",
    height: 1,
    transformOrigin: "left center",
  },
  pin: {
    position: "absolute",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  pinInner: {
    backgroundColor: "#0a0a0a",
    position: "absolute",
  },
  pinHead: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  checkDot: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  pinLabel: {
    position: "absolute",
    width: 80,
    textAlign: "center",
    letterSpacing: 0.5,
    fontFamily: "SpaceMono",
  },
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  Pulsing Boss Glow (Reanimated)                                    */
/* ═══════════════════════════════════════════════════════════════════ */
function PulsingGlow({ color, active }: { color: string; active: boolean }) {
  const opacity = useSharedValue(active ? 0.3 : 0.08);

  useEffect(() => {
    if (active) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    }
  }, [active]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: color,
          backgroundColor: color + "10",
        },
        style,
      ]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Main Component                                                     */
/* ═══════════════════════════════════════════════════════════════════ */
export function WarRoom() {
  const router = useRouter();
  const today = getTodayKey();

  // Stores
  const tasks = useEngineStore((s) => s.tasks);
  const completions = useEngineStore((s) => s.completions);
  const loadAllEngines = useEngineStore((s) => s.loadAllEngines);
  const toggleTask = useEngineStore((s) => s.toggleTask);
  const awardXP = useProfileStore((s) => s.awardXP);

  const [completedExpanded, setCompletedExpanded] = useState(false);

  useEffect(() => {
    loadAllEngines(today);
  }, []);

  // Chapter / boss info
  const firstActiveDate = getJSON<string | null>("first_active_date", null);
  const dayNumber = getDayNumber(firstActiveDate);
  const chapter = getCurrentChapter(dayNumber);
  const chapterEndDay = chapter.weekEnd * 7;
  const isBossActive = dayNumber > chapterEndDay - 7 && dayNumber <= chapterEndDay;

  // All tasks for today
  const allTasks = useMemo(
    () => selectAllTasksForDate(tasks, completions, today),
    [tasks, completions, today],
  );

  const mainMissions = useMemo(
    () => allTasks.filter((t) => t.kind === "main"),
    [allTasks],
  );
  const sideQuests = useMemo(
    () => allTasks.filter((t) => t.kind === "secondary"),
    [allTasks],
  );
  const activeMains = useMemo(() => mainMissions.filter((t) => !t.completed), [mainMissions]);
  const activeSides = useMemo(() => sideQuests.filter((t) => !t.completed), [sideQuests]);
  const completedTasks = useMemo(() => allTasks.filter((t) => t.completed), [allTasks]);

  // Pin layout for the canvas
  const canvasWidth = SCREEN_WIDTH - CANVAS_PADDING * 2;
  const pins = useMemo(
    () => layoutPins(chapter.bossName, isBossActive, mainMissions, sideQuests, canvasWidth),
    [chapter.bossName, isBossActive, mainMissions, sideQuests, canvasWidth],
  );

  // Toggle handler
  const handleToggle = useCallback(
    (task: TaskWithStatus) => {
      const completed = toggleTask(task.engine, task.id!, today);
      if (completed) {
        const xp =
          task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
        awardXP(today, `task:${task.id}`, xp);
        evaluateAllTrees();
      }
    },
    [today, toggleTask, awardXP],
  );

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={["top"]}>
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerKicker}>OPERATIONS BOARD</Text>
            <Text style={s.headerTitle}>WAR ROOM</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Pin Board Canvas ─────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(100).duration(600)}>
            <View style={s.canvasContainer}>
              <PulsingGlow color={isBossActive ? colors.danger : "rgba(255,255,255,0.15)"} active={isBossActive} />

              {/* Scanline effect */}
              <View style={s.scanlines} />

              {/* Corner brackets */}
              <View style={[s.cornerBracket, s.cornerTL]} />
              <View style={[s.cornerBracket, s.cornerTR]} />
              <View style={[s.cornerBracket, s.cornerBL]} />
              <View style={[s.cornerBracket, s.cornerBR]} />

              {/* Board title */}
              <View style={s.boardTitleRow}>
                <View style={s.boardTitleLine} />
                <Text style={s.boardTitleText}>TACTICAL MAP</Text>
                <View style={s.boardTitleLine} />
              </View>

              {/* Skia or Fallback board */}
              <View style={s.canvasInner}>
                {SkiaAvailable ? (
                  <SkiaPinBoard pins={pins} canvasWidth={canvasWidth} />
                ) : (
                  <FallbackPinBoard pins={pins} />
                )}
              </View>

              {/* Legend */}
              <View style={s.legend}>
                {ENGINES.map((eng) => (
                  <View key={eng} style={s.legendItem}>
                    <View
                      style={[s.legendDot, { backgroundColor: ENGINE_COLORS[eng] }]}
                    />
                    <Text style={s.legendLabel}>{eng.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* ── Boss Challenge Banner ────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <View
              style={[
                s.bossCard,
                {
                  borderColor: isBossActive
                    ? colors.danger + "50"
                    : "rgba(255,255,255,0.08)",
                },
              ]}
            >
              <View style={s.bossRow}>
                <View
                  style={[
                    s.bossIcon,
                    {
                      borderColor: isBossActive
                        ? colors.danger
                        : "rgba(255,255,255,0.2)",
                      shadowColor: isBossActive ? colors.danger : "transparent",
                    },
                  ]}
                >
                  <Ionicons
                    name="skull-outline"
                    size={18}
                    color={isBossActive ? colors.danger : colors.textMuted}
                  />
                </View>
                <View style={s.bossInfo}>
                  <Text style={s.bossKicker}>BOSS CHALLENGE</Text>
                  <Text style={s.bossName}>{chapter.bossName}</Text>
                </View>
                <View
                  style={[
                    s.statusPill,
                    isBossActive ? s.statusActive : s.statusLocked,
                  ]}
                >
                  <Text
                    style={[
                      s.statusText,
                      { color: isBossActive ? colors.danger : colors.textMuted },
                    ]}
                  >
                    {isBossActive ? "ACTIVE" : "LOCKED"}
                  </Text>
                </View>
              </View>
              <Text style={s.bossDesc}>{chapter.bossDescription}</Text>
            </View>
          </Animated.View>

          {/* ── Task List: Main Missions ──────────────────────── */}
          <Animated.View entering={FadeInDown.delay(350).duration(500)}>
            <View style={s.sectionRow}>
              <View style={s.sectionLine} />
              <Text style={s.sectionTitle}>MAIN MISSIONS</Text>
              <Text style={s.sectionCount}>
                {mainMissions.filter((t) => t.completed).length}/{mainMissions.length}
              </Text>
              <View style={s.sectionLine} />
            </View>
          </Animated.View>

          {activeMains.length > 0 ? (
            activeMains.map((task, idx) => (
              <Animated.View
                key={task.id}
                entering={FadeInDown.delay(400 + idx * 50).duration(400)}
              >
                <TaskRow task={task} onToggle={() => handleToggle(task)} />
              </Animated.View>
            ))
          ) : (
            <View style={s.emptyBox}>
              <Ionicons name="checkmark-done-outline" size={16} color={colors.success} />
              <Text style={s.emptyText}>All main missions completed</Text>
            </View>
          )}

          {/* ── Task List: Side Quests ────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(500).duration(500)}>
            <View style={s.sectionRow}>
              <View style={s.sectionLine} />
              <Text style={s.sectionTitle}>SIDE QUESTS</Text>
              <Text style={s.sectionCount}>
                {sideQuests.filter((t) => t.completed).length}/{sideQuests.length}
              </Text>
              <View style={s.sectionLine} />
            </View>
          </Animated.View>

          {activeSides.length > 0 ? (
            activeSides.map((task, idx) => (
              <Animated.View
                key={task.id}
                entering={FadeInDown.delay(550 + idx * 50).duration(400)}
                style={{ opacity: 0.85 }}
              >
                <TaskRow task={task} onToggle={() => handleToggle(task)} kind="side" />
              </Animated.View>
            ))
          ) : (
            <View style={s.emptyBox}>
              <Ionicons name="checkmark-done-outline" size={16} color={colors.success} />
              <Text style={s.emptyText}>All side quests completed</Text>
            </View>
          )}

          {/* ── Completed Tasks ───────────────────────────────── */}
          {completedTasks.length > 0 && (
            <Animated.View entering={FadeInDown.delay(650).duration(500)}>
              <Pressable
                style={s.completedToggle}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCompletedExpanded((v) => !v);
                }}
              >
                <View style={s.sectionRow}>
                  <View style={s.sectionLine} />
                  <Text style={[s.sectionTitle, { color: colors.success + "80" }]}>
                    COMPLETED ({completedTasks.length})
                  </Text>
                  <Ionicons
                    name={completedExpanded ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={colors.textMuted}
                  />
                  <View style={s.sectionLine} />
                </View>
              </Pressable>

              {completedExpanded &&
                completedTasks.map((task, idx) => (
                  <Animated.View
                    key={task.id}
                    entering={FadeInDown.delay(idx * 30).duration(250)}
                    style={{ opacity: 0.45 }}
                  >
                    <TaskRow
                      task={task}
                      onToggle={() => handleToggle(task)}
                    />
                  </Animated.View>
                ))}
            </Animated.View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Task Row                                                           */
/* ═══════════════════════════════════════════════════════════════════ */
function TaskRow({
  task,
  onToggle,
  kind,
}: {
  task: TaskWithStatus;
  onToggle: () => void;
  kind?: "side";
}) {
  const engineColor = ENGINE_COLORS[task.engine] || colors.body;
  const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(
          task.completed
            ? Haptics.ImpactFeedbackStyle.Light
            : Haptics.ImpactFeedbackStyle.Medium,
        );
        onToggle();
      }}
      style={[
        s.taskRow,
        {
          borderLeftColor: task.completed ? colors.success + "30" : engineColor,
        },
      ]}
    >
      {/* Checkbox */}
      <View
        style={[
          s.checkbox,
          task.completed && {
            borderColor: colors.success,
            backgroundColor: colors.success,
          },
        ]}
      >
        {task.completed && (
          <Ionicons name="checkmark" size={12} color="#fff" />
        )}
      </View>

      {/* Content */}
      <View style={s.taskContent}>
        <Text
          style={[s.taskTitle, task.completed && s.taskTitleDone]}
          numberOfLines={1}
        >
          {task.title}
        </Text>
        <View style={s.taskMeta}>
          <View style={[s.engineDot, { backgroundColor: engineColor }]} />
          <Text style={[s.engineTag, { color: engineColor }]}>
            {task.engine.toUpperCase()}
          </Text>
          <Text style={s.metaSep}>{"\u00B7"}</Text>
          <Text style={s.kindTag}>
            {task.kind === "main" ? "MISSION" : "SIDE"}
          </Text>
        </View>
      </View>

      {/* XP badge */}
      <View style={[s.xpBadge, task.completed && s.xpBadgeDone]}>
        <Text style={[s.xpText, task.completed && { color: colors.success }]}>
          {task.completed ? "\u2713" : `+${xp}`}
        </Text>
      </View>
    </Pressable>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Styles                                                             */
/* ═══════════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  safe: {
    flex: 1,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerKicker: {
    ...fonts.kicker,
    fontSize: 8,
    color: colors.textMuted,
    letterSpacing: 4,
  },
  headerTitle: {
    ...fonts.heading,
    fontSize: 22,
    letterSpacing: 6,
    marginTop: 2,
  },

  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },

  /* Canvas container — the pin board frame */
  canvasContainer: {
    backgroundColor: "rgba(8, 8, 12, 0.95)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    marginBottom: spacing.lg,
    overflow: "hidden",
    position: "relative",
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
    // Simulated scanline via border
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cornerBracket: {
    position: "absolute",
    width: 12,
    height: 12,
    borderColor: "rgba(255,255,255,0.2)",
  },
  cornerTL: {
    top: 4,
    left: 4,
    borderTopWidth: 1,
    borderLeftWidth: 1,
  },
  cornerTR: {
    top: 4,
    right: 4,
    borderTopWidth: 1,
    borderRightWidth: 1,
  },
  cornerBL: {
    bottom: 4,
    left: 4,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
  },
  cornerBR: {
    bottom: 4,
    right: 4,
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },

  boardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    marginBottom: 4,
    gap: spacing.sm,
  },
  boardTitleLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  boardTitleText: {
    ...fonts.kicker,
    fontSize: 8,
    color: "rgba(255,255,255,0.25)",
    letterSpacing: 4,
  },

  canvasInner: {
    alignItems: "center",
  },

  /* Legend */
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    ...fonts.kicker,
    fontSize: 7,
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 1.5,
  },

  /* Boss card */
  bossCard: {
    backgroundColor: "rgba(248,113,113,0.04)",
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  bossRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  bossIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248,113,113,0.08)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  bossInfo: { flex: 1 },
  bossKicker: {
    ...fonts.kicker,
    fontSize: 8,
    color: colors.danger,
    letterSpacing: 3,
  },
  bossName: {
    ...fonts.heading,
    fontSize: 16,
    marginTop: 1,
  },
  bossDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: colors.dangerDim,
    borderColor: colors.danger + "40",
  },
  statusLocked: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  statusText: {
    ...fonts.kicker,
    fontSize: 7,
    letterSpacing: 2,
  },

  /* Section dividers */
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  sectionTitle: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 3,
  },
  sectionCount: {
    ...fonts.mono,
    fontSize: 9,
    color: "rgba(255,255,255,0.25)",
  },

  /* Empty state */
  emptyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: "rgba(52, 211, 153, 0.04)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.10)",
    borderStyle: "dashed",
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
  },

  /* Completed toggle */
  completedToggle: {
    marginTop: spacing.sm,
  },

  /* Task Row */
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.85)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderLeftWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  taskContent: { flex: 1 },
  taskTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  taskTitleDone: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  engineDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  engineTag: {
    ...fonts.kicker,
    fontSize: 8,
    letterSpacing: 1,
  },
  metaSep: {
    fontSize: 8,
    color: colors.textMuted,
  },
  kindTag: {
    ...fonts.kicker,
    fontSize: 8,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  xpBadge: {
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  xpBadgeDone: {
    backgroundColor: colors.successDim,
    borderColor: colors.success + "15",
  },
  xpText: {
    ...fonts.mono,
    fontSize: 10,
    color: colors.textSecondary,
  },
});
