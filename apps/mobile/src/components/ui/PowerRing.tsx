import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors } from "../../theme";
import { getDailyRank } from "../../db/gamification";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  score: number; // 0–100
  size?: number;
  strokeWidth?: number;
  showRank?: boolean;
};

export const PowerRing = React.memo(function PowerRing({ score, size = 200, strokeWidth = 10, showRank = true }: Props) {
  const progress = useSharedValue(0);
  const lastScore = useRef(-1);
  const rank = getDailyRank(score);

  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  useEffect(() => {
    if (lastScore.current !== score) {
      lastScore.current = score;
      progress.value = withTiming(score / 100, {
        duration: 1200,
        easing: Easing.bezierFn(0.25, 0.1, 0.25, 1),
      });
    }
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  // Color based on score
  const ringColor =
    score >= 90 ? colors.warning : // Gold
    score >= 70 ? colors.primary : // Blue
    score >= 40 ? "#F97316" : // Orange
    colors.danger; // Red

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={ringColor} stopOpacity="1" />
            <Stop offset="100%" stopColor={ringColor} stopOpacity="0.6" />
          </LinearGradient>
        </Defs>

        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.surfaceBorder}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Animated progress */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {/* Center content */}
      <View style={styles.center}>
        {showRank && (
          <Text style={[styles.rank, { color: rank.color }]}>{rank.letter}</Text>
        )}
        <Text style={styles.score}>{score}%</Text>
        <Text style={styles.label}>POWER</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    alignItems: "center",
  },
  rank: {
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 2,
  },
  score: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginTop: -2,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSecondary,
    letterSpacing: 2,
    marginTop: 2,
  },
});
