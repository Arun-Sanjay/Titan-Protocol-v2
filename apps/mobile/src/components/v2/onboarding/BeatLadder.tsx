import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { playVoiceLineAsync, stopCurrentAudio } from "../../../lib/protocol-audio";
import {
  RANK_ORDER,
  RANK_NAMES,
  RANK_COLORS,
  RANK_REQUIREMENTS,
  RANK_ABBREVIATIONS,
  type Rank,
} from "../../../lib/ranks-v2";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Props = { onComplete: () => void };

// ── Rank node sizing ─────────────────────────────────────────────────────────

const NODE_SIZE = 14;
const TITAN_NODE_SIZE = 20;
const ROW_HEIGHT = 44;
const LINE_WIDTH = 2;

// ── Requirement labels ───────────────────────────────────────────────────────

function getRequirementLabel(rank: Rank): string {
  const req = RANK_REQUIREMENTS[rank];
  if (rank === "initiate") return "Starting rank";
  if (rank === "titan") return `${req.avgScore}% avg, ${req.consecutiveDays}d + Field Op`;
  return `${req.avgScore}% avg, ${req.consecutiveDays}d`;
}

// ── Animated rank node ───────────────────────────────────────────────────────

function RankNode({
  rank,
  index,
  visible,
  isTitan,
  isFirst,
}: {
  rank: Rank;
  index: number;
  visible: boolean;
  isTitan: boolean;
  isFirst: boolean;
}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);
  const glowOpacity = useSharedValue(0);
  const youAreHereOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
      scale.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.5)) });

      if (isTitan) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.6, { duration: 800 }),
            withTiming(0.15, { duration: 800 }),
          ),
          -1,
          true,
        );
      }

      if (isFirst) {
        youAreHereOpacity.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 600 }),
            withTiming(0.4, { duration: 600 }),
          ),
          -1,
          true,
        );
      }
    }
  }, [visible]);

  const nodeStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const youAreHereStyle = useAnimatedStyle(() => ({
    opacity: youAreHereOpacity.value,
  }));

  const size = isTitan ? TITAN_NODE_SIZE : NODE_SIZE;
  const color = RANK_COLORS[rank];

  return (
    <Animated.View style={[styles.rankRow, nodeStyle]}>
      {/* Abbreviation (left) */}
      <Text style={[styles.abbreviation, { color: "rgba(255,255,255,0.35)" }]}>
        {RANK_ABBREVIATIONS[rank]}
      </Text>

      {/* Node circle */}
      <View style={styles.nodeWrap}>
        {isTitan && (
          <Animated.View
            style={[
              styles.titanGlow,
              { backgroundColor: color },
              glowStyle,
            ]}
          />
        )}
        <View
          style={[
            styles.node,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
            },
          ]}
        />
      </View>

      {/* Name + requirement (right) */}
      <View style={styles.rankInfo}>
        <Text style={[styles.rankName, { color }, isTitan && styles.titanName]}>
          {RANK_NAMES[rank]}
        </Text>
        <Text style={styles.requirement}>{getRequirementLabel(rank)}</Text>
      </View>

      {/* "YOU ARE HERE" for Initiate */}
      {isFirst && (
        <Animated.View style={[styles.youAreHereWrap, youAreHereStyle]}>
          <Text style={styles.youAreHere}>YOU ARE HERE</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ── Connection line ──────────────────────────────────────────────────────────

function ConnectionLine({ visible, index }: { visible: boolean; index: number }) {
  const height = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      height.value = withTiming(ROW_HEIGHT - NODE_SIZE - 4, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [visible]);

  const lineStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <View style={styles.lineWrap}>
      <Animated.View style={[styles.line, lineStyle]} />
    </View>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function BeatLadder({ onComplete }: Props) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const pulseOpacity = useSharedValue(0);

  // Reversed order: bottom (initiate) → top (titan)
  const ranksBottomUp = [...RANK_ORDER];

  useEffect(() => {
    const t = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timers.current.push(id);
      return id;
    };

    // Play rank narration
    playVoiceLineAsync("ONBO-010");

    // Stagger rank appearances bottom→top at 1500ms intervals
    for (let i = 0; i < ranksBottomUp.length; i++) {
      t(() => {
        setVisibleCount(i + 1);
        if (i < ranksBottomUp.length - 1) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }, 500 + i * 1500);
    }

    // After all visible: pulse the line once
    const allVisibleTime = 500 + ranksBottomUp.length * 1500 + 500;
    t(() => {
      pulseOpacity.value = withSequence(
        withTiming(0.6, { duration: 400 }),
        withTiming(0, { duration: 600 }),
      );
    }, allVisibleTime);

    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const handleContinue = () => {
    stopCurrentAudio();
    onComplete();
  };

  return (
    <View style={styles.container}>
      {/* Ladder container — rendered bottom-to-top visually */}
      <View style={styles.ladder}>
        {/* Energy pulse overlay on the line */}
        <Animated.View style={[styles.energyPulse, pulseStyle]} />

        {ranksBottomUp.map((rank, i) => {
          const isVisible = i < visibleCount;
          const isTitan = rank === "titan";
          const isFirst = rank === "initiate";
          // Render bottom-to-top: reverse the visual position
          const reverseIndex = ranksBottomUp.length - 1 - i;

          return (
            <React.Fragment key={rank}>
              {/* Connection line above (not for the bottom-most rank) */}
              {i > 0 && (
                <ConnectionLine visible={isVisible} index={i} />
              )}
              <RankNode
                rank={rank}
                index={i}
                visible={isVisible}
                isTitan={isTitan}
                isFirst={isFirst}
              />
            </React.Fragment>
          );
        }).reverse()}
      </View>

      {/* Continue button */}
      <Pressable
        style={styles.btn}
        onPress={handleContinue}
      >
        <Text style={styles.btnText}>CONTINUE</Text>
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
    paddingTop: spacing["3xl"],
    paddingBottom: spacing["3xl"],
    justifyContent: "space-between",
  },

  ladder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
    paddingVertical: spacing.lg,
  },

  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    height: ROW_HEIGHT,
    paddingHorizontal: spacing.sm,
  },

  abbreviation: {
    ...fonts.mono,
    fontSize: 10,
    width: 32,
    textAlign: "right",
    marginRight: spacing.sm,
    letterSpacing: 1,
  },

  nodeWrap: {
    width: TITAN_NODE_SIZE + 8,
    alignItems: "center",
    justifyContent: "center",
  },

  node: {
    zIndex: 1,
  },

  titanGlow: {
    position: "absolute",
    width: TITAN_NODE_SIZE + 16,
    height: TITAN_NODE_SIZE + 16,
    borderRadius: (TITAN_NODE_SIZE + 16) / 2,
    zIndex: 0,
  },

  rankInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },

  rankName: {
    ...fonts.mono,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  titanName: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 2,
  },

  requirement: {
    fontSize: 10,
    color: "rgba(255,255,255,0.30)",
    marginTop: 1,
  },

  youAreHereWrap: {
    position: "absolute",
    right: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    borderRadius: radius.sm,
  },

  youAreHere: {
    ...fonts.mono,
    fontSize: 8,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  lineWrap: {
    paddingLeft: 32 + spacing.sm + (TITAN_NODE_SIZE + 8) / 2 - LINE_WIDTH / 2,
  },

  line: {
    width: LINE_WIDTH,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  energyPulse: {
    position: "absolute",
    left: 32 + spacing.sm + (TITAN_NODE_SIZE + 8) / 2 - 2,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "rgba(255,255,255,0.40)",
    borderRadius: 2,
  },

  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.lg,
  },

  btnText: {
    ...fonts.kicker,
    fontSize: 13,
    color: "#000",
    letterSpacing: 2,
  },
});
