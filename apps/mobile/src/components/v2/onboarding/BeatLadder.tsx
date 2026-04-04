import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  FadeInUp,
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type Props = { onComplete: () => void };

// ── Layout constants ────────────────────────────────────────────────────────
// Designed so 8 ranks + 7 connection lines + header space + button all fit
// within ~712px usable height (812px minus safe areas).

const RANK_COUNT = 8;
const NODE_SIZE = 12;
const TITAN_NODE_SIZE = 18;
const LINE_HEIGHT_PX = 16;
const LINE_WIDTH = 1.5;

// Row heights: compact enough to fit on one screen
const ROW_HEIGHT = 52; // each rank row
const TITAN_ROW_HEIGHT = 58; // titan gets a bit more

// ── Voice-sync timings (ms from mount) ──────────────────────────────────────
// UPDATED: Tightened timing to match faster speech in ONBO-010
// Previous timings were too slow (1.5s, 4.0s, 6.0s, ..., 16.0s)

const RANK_APPEAR_TIMES: number[] = [
  1000, // initiate
  2500, // operative
  4000, // agent
  5500, // specialist
  7000, // commander
  8500, // vanguard
  10000, // sentinel
  12000, // titan
];

// ── Requirement labels ──────────────────────────────────────────────────────

function getRequirementLabel(rank: Rank): string {
  const req = RANK_REQUIREMENTS[rank];
  if (rank === "initiate") return "Starting rank";
  if (rank === "titan")
    return `${req.avgScore}% avg / ${req.consecutiveDays}d + Field Op`;
  return `${req.avgScore}% avg / ${req.consecutiveDays}d streak`;
}

// ── Animated rank node ──────────────────────────────────────────────────────

function RankNode({
  rank,
  visible,
  isTitan,
  isFirst,
}: {
  rank: Rank;
  visible: boolean;
  isTitan: boolean;
  isFirst: boolean;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);
  const glowOpacity = useSharedValue(0);
  const youAreHereOpacity = useSharedValue(0);
  // Glow pulse on appear
  const appearGlowOpacity = useSharedValue(0);
  const appearGlowScale = useSharedValue(1.0);

  useEffect(() => {
    if (visible) {
      // FASTER appearance: 150ms slide-up instead of 500ms
      opacity.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withTiming(0, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
      });

      // Brief glow pulse on appear
      const color = RANK_COLORS[rank];
      appearGlowOpacity.value = withSequence(
        withTiming(0.5, { duration: 100 }),
        withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }),
      );
      appearGlowScale.value = withSequence(
        withTiming(1.0, { duration: 0 }),
        withTiming(1.8, { duration: 400, easing: Easing.out(Easing.cubic) }),
      );

      if (isTitan) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        glowOpacity.value = withDelay(
          150,
          withRepeat(
            withSequence(
              withTiming(0.7, { duration: 900 }),
              withTiming(0.15, { duration: 900 }),
            ),
            -1,
            true,
          ),
        );
      }

      if (isFirst) {
        youAreHereOpacity.value = withDelay(
          200,
          withRepeat(
            withSequence(
              withTiming(1, { duration: 700 }),
              withTiming(0.3, { duration: 700 }),
            ),
            -1,
            true,
          ),
        );
      }
    }
  }, [visible]);

  const nodeAnimStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const youAreHereStyle = useAnimatedStyle(() => ({
    opacity: youAreHereOpacity.value,
  }));

  const appearGlowStyle = useAnimatedStyle(() => ({
    opacity: appearGlowOpacity.value,
    transform: [{ scale: appearGlowScale.value }],
  }));

  const size = isTitan ? TITAN_NODE_SIZE : NODE_SIZE;
  const color = RANK_COLORS[rank];
  const height = isTitan ? TITAN_ROW_HEIGHT : ROW_HEIGHT;

  return (
    <Animated.View style={[styles.rankRow, { height }, nodeAnimStyle]}>
      {/* Abbreviation (left column, fixed width) */}
      <Text
        style={[
          styles.abbreviation,
          isTitan && { color: "rgba(255,255,255,0.50)" },
        ]}
      >
        {RANK_ABBREVIATIONS[rank]}
      </Text>

      {/* Node circle (center column, fixed width) */}
      <View style={styles.nodeWrap}>
        {/* Appear glow pulse */}
        <Animated.View
          style={[
            styles.appearGlow,
            { backgroundColor: color },
            appearGlowStyle,
          ]}
        />
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

      {/* Name + requirement (right column, flex) */}
      <View style={styles.rankInfo}>
        <Text
          style={[
            styles.rankName,
            { color },
            isTitan && styles.titanName,
          ]}
          numberOfLines={1}
        >
          {RANK_NAMES[rank]}
        </Text>
        <Text style={styles.requirement} numberOfLines={1}>
          {getRequirementLabel(rank)}
        </Text>
      </View>

      {/* "YOU ARE HERE" badge for Initiate */}
      {isFirst && (
        <Animated.View style={[styles.youAreHereWrap, youAreHereStyle]}>
          <Text style={styles.youAreHere}>YOU ARE HERE</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ── Connection line between ranks ───────────────────────────────────────────

function ConnectionLine({ visible }: { visible: boolean }) {
  const lineOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      lineOpacity.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: lineOpacity.value,
  }));

  return (
    <View style={styles.lineContainer}>
      <Animated.View style={[styles.line, animStyle]} />
    </View>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function BeatLadder({ onComplete }: Props) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const btnOpacity = useSharedValue(0);

  // Display order: bottom (initiate, index 0) to top (titan, index 7)
  // We render top-to-bottom in JSX but reverse the array so titan is at top
  const ranksBottomUp = [...RANK_ORDER]; // initiate first, titan last

  useEffect(() => {
    const t = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timers.current.push(id);
      return id;
    };

    // Play rank narration voice line
    playVoiceLineAsync("ONBO-010");

    // Stagger rank appearances synced with voice narration
    for (let i = 0; i < ranksBottomUp.length; i++) {
      t(() => {
        setVisibleCount(i + 1);
        if (i < ranksBottomUp.length - 1) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }, RANK_APPEAR_TIMES[i]);
    }

    // Show CONTINUE button after all ranks visible + short delay
    t(() => {
      setShowButton(true);
      btnOpacity.value = withTiming(1, { duration: 500 });
    }, RANK_APPEAR_TIMES[RANK_APPEAR_TIMES.length - 1] + 1500);

    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const btnAnimStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
  }));

  const handleContinue = () => {
    stopCurrentAudio();
    onComplete();
  };

  // Build the ladder: reversed so titan renders at the top of the list
  const ladderItems = ranksBottomUp
    .map((rank, i) => {
      const isVisible = i < visibleCount;
      const isTitan = rank === "titan";
      const isFirst = rank === "initiate";

      return (
        <React.Fragment key={rank}>
          {/* Connection line above each rank except the top-most (titan) */}
          {i > 0 && <ConnectionLine visible={isVisible} />}
          <RankNode
            rank={rank}
            visible={isVisible}
            isTitan={isTitan}
            isFirst={isFirst}
          />
        </React.Fragment>
      );
    })
    .reverse(); // Titan at top, Initiate at bottom

  return (
    <View style={styles.container}>
      {/* Ladder fills center area */}
      <View style={styles.ladderSection}>
        <View style={styles.ladder}>{ladderItems}</View>
      </View>

      {/* Continue button pinned at bottom */}
      <View style={styles.buttonSection}>
        {showButton && (
          <Animated.View style={btnAnimStyle}>
            <Pressable style={styles.btn} onPress={handleContinue}>
              <Text style={styles.btnText}>CONTINUE</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

// Calculate the center column offset for the connection line
const ABBR_WIDTH = 36;
const NODE_COL_WIDTH = TITAN_NODE_SIZE + 12;
const LINE_LEFT = ABBR_WIDTH + spacing.sm + NODE_COL_WIDTH / 2 - LINE_WIDTH / 2;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    zIndex: 10,
    paddingHorizontal: spacing.xl,
  },

  // ── Ladder area: centered vertically, takes up most of the screen ──

  ladderSection: {
    flex: 1,
    justifyContent: "center",
    paddingTop: 60, // safe area top offset
  },

  ladder: {
    alignItems: "stretch",
  },

  // ── Individual rank row ──

  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },

  abbreviation: {
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "600",
    width: ABBR_WIDTH,
    textAlign: "right",
    marginRight: spacing.sm,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.30)",
    textTransform: "uppercase",
  },

  nodeWrap: {
    width: NODE_COL_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },

  node: {
    zIndex: 1,
  },

  // Appear glow pulse on each rank
  appearGlow: {
    position: "absolute",
    width: NODE_SIZE + 16,
    height: NODE_SIZE + 16,
    borderRadius: (NODE_SIZE + 16) / 2,
    zIndex: 0,
  },

  titanGlow: {
    position: "absolute",
    width: TITAN_NODE_SIZE + 20,
    height: TITAN_NODE_SIZE + 20,
    borderRadius: (TITAN_NODE_SIZE + 20) / 2,
    zIndex: 0,
  },

  rankInfo: {
    flex: 1,
    marginLeft: spacing.sm,
    justifyContent: "center",
  },

  rankName: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  titanName: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2.5,
  },

  requirement: {
    fontSize: 9,
    fontWeight: "400",
    color: "rgba(255,255,255,0.25)",
    marginTop: 2,
  },

  // ── "YOU ARE HERE" badge ──

  youAreHereWrap: {
    position: "absolute",
    right: spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 4,
  },

  youAreHere: {
    fontFamily: "monospace",
    fontSize: 7,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  // ── Connection line between nodes ──

  lineContainer: {
    height: LINE_HEIGHT_PX,
    paddingLeft: LINE_LEFT,
    justifyContent: "center",
  },

  line: {
    width: LINE_WIDTH,
    height: LINE_HEIGHT_PX,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  // ── Button area pinned at bottom ──

  buttonSection: {
    paddingBottom: 50, // safe area bottom offset
    minHeight: 80,
  },

  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },

  btnText: {
    ...fonts.kicker,
    fontSize: 13,
    color: "#000",
    letterSpacing: 2,
  },
});
