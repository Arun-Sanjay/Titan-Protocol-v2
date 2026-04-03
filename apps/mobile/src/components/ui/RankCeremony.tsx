import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors } from "../../theme";
import { getDailyRank, DAILY_RANKS } from "../../db/gamification";

const { width, height } = Dimensions.get("window");

type Props = {
  score: number;
  previousScore?: number;
  onDismiss: () => void;
};

/**
 * Daily Rank Ceremony — shown when protocol completes.
 * Terminal-style score reveal → rank letter slams on screen.
 */
export function RankCeremony({ score, previousScore, onDismiss }: Props) {
  const rank = getDailyRank(score);
  const prevRank = previousScore != null ? getDailyRank(previousScore) : null;
  const isRankUp = prevRank && DAILY_RANKS.indexOf(rank) > DAILY_RANKS.indexOf(prevRank);
  const isSS = rank.letter === "SS";

  // Animation values
  const bgOpacity = useSharedValue(0);
  const scoreTextOpacity = useSharedValue(0);
  const rankScale = useSharedValue(0);
  const rankOpacity = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const rankUpOpacity = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  const [showScore, setShowScore] = useState(false);
  const [showRank, setShowRank] = useState(false);
  const [showRankUp, setShowRankUp] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Phase 1: Background fade in
    bgOpacity.value = withTiming(1, { duration: 300 });

    // Phase 2: Score text types in
    timers.current.push(setTimeout(() => {
      setShowScore(true);
      scoreTextOpacity.value = withTiming(1, { duration: 400 });
    }, 400));

    // Phase 3: Rank letter slams in with shake
    timers.current.push(setTimeout(() => {
      setShowRank(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      rankOpacity.value = withTiming(1, { duration: 100 });
      rankScale.value = withSpring(1, { damping: 8, stiffness: 200, mass: 0.5 });
      shakeX.value = withSequence(
        withTiming(8, { duration: 50 }),
        withTiming(-8, { duration: 50 }),
        withTiming(4, { duration: 50 }),
        withTiming(-4, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }, 1200));

    // Phase 4: Rank-up flash if applicable
    if (isRankUp) {
      timers.current.push(setTimeout(() => {
        setShowRankUp(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        rankUpOpacity.value = withSequence(
          withTiming(1, { duration: 200 }),
          withDelay(800, withTiming(0, { duration: 400 })),
        );
      }, 1800));
    }

    // Phase 5: Dismiss
    timers.current.push(setTimeout(() => {
      containerOpacity.value = withTiming(0, { duration: 500, easing: Easing.in(Easing.ease) }, () => {
        runOnJS(onDismiss)();
      });
    }, 3500));

    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  const scoreStyle = useAnimatedStyle(() => ({
    opacity: scoreTextOpacity.value,
  }));

  const rankStyle = useAnimatedStyle(() => ({
    opacity: rankOpacity.value,
    transform: [
      { scale: rankScale.value },
      { translateX: shakeX.value },
    ],
  }));

  const rankUpStyle = useAnimatedStyle(() => ({
    opacity: rankUpOpacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={[styles.bg, bgStyle]} />

      <View style={styles.content}>
        {/* Score counter */}
        {showScore && (
          <Animated.View style={scoreStyle}>
            <Text style={styles.scoreLabel}>TITAN SCORE</Text>
            <Text style={styles.scoreValue}>{score}%</Text>
          </Animated.View>
        )}

        {/* Rank letter */}
        {showRank && (
          <Animated.View style={[styles.rankContainer, rankStyle]}>
            <Text style={[styles.rankLetter, { color: rank.color }]}>
              {rank.letter}
            </Text>
            {isSS && (
              <View style={[styles.ssGlow, { backgroundColor: rank.color }]} />
            )}
          </Animated.View>
        )}

        {/* Rank-up flash */}
        {showRankUp && (
          <Animated.View style={[styles.rankUpContainer, rankUpStyle]}>
            <Text style={[styles.rankUpText, { color: rank.color }]}>
              RANK UP
            </Text>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9000,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  content: {
    alignItems: "center",
  },
  scoreLabel: {
    fontFamily: "monospace",
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 3,
    marginBottom: 8,
    textAlign: "center",
  },
  scoreValue: {
    fontFamily: "monospace",
    fontSize: 42,
    fontWeight: "200",
    color: colors.text,
    textAlign: "center",
    marginBottom: 32,
  },
  rankContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  rankLetter: {
    fontSize: 120,
    fontWeight: "900",
    letterSpacing: -4,
    textAlign: "center",
  },
  ssGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.08,
  },
  rankUpContainer: {
    marginTop: 24,
  },
  rankUpText: {
    fontFamily: "monospace",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 6,
    textAlign: "center",
  },
});
