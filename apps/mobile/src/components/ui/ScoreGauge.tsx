import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Svg, {
  Circle,
  G,
  Defs,
  LinearGradient,
  Stop,
  Line,
} from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
} from "react-native-reanimated";
import { colors, fonts } from "../../theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  score: number; // 0-100
  size?: number; // default 180
  strokeWidth?: number; // default 6
  label?: string; // text below score e.g. "TITAN SCORE"
  color?: string; // override gradient color
};

const TICK_ANGLES = [0, 90, 180, 270];

const monoFont = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

export const ScoreGauge = React.memo(function ScoreGauge({
  score,
  size = 180,
  strokeWidth = 6,
  label,
  color,
}: Props) {
  const progress = useSharedValue(0);
  const lastScore = useRef(-1);

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth * 2) / 2; // leave room for stroke on both sides
  const circumference = 2 * Math.PI * r;

  // Tick mark geometry
  const tickLength = size * 0.04; // ~7px at 180
  const tickOuterR = r + strokeWidth / 2 + 2;
  const tickInnerR = tickOuterR + tickLength;

  // Inner decorative ring
  const innerR = r - strokeWidth - 4;

  // Glow ring (slightly larger, lower opacity to fake blur)
  const glowR = r;
  const glowStrokeWidth = strokeWidth + 4;

  // Font sizing scales with gauge size
  const scoreFontSize = (size / 180) * 36;
  const labelFontSize = (size / 180) * 9;

  useEffect(() => {
    if (lastScore.current !== score) {
      lastScore.current = score;
      progress.value = withSpring(Math.min(100, Math.max(0, score)) / 100, {
        stiffness: 60,
        damping: 20,
      });
    }
  }, [score]);

  // Animated progress ring
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  // Animated glow ring (same progress, but thicker + lower opacity)
  const glowAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  // Gradient colors — use override or default HUD theme
  const gradStart = color ?? "rgba(210,220,233,0.58)";
  const gradEnd = color ? color + "F2" : "rgba(244,248,255,0.95)";

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={gradStart} stopOpacity="1" />
            <Stop offset="100%" stopColor={gradEnd} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="scoreGlowGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={gradStart} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={gradEnd} stopOpacity="0.35" />
          </LinearGradient>
        </Defs>

        {/* Inner decorative ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={innerR}
          stroke="rgba(56,189,248,0.06)"
          strokeWidth={1}
          fill="none"
        />

        {/* Background track */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.5}
        />

        {/* Glow ring (faked gaussian blur — thicker, lower opacity) */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={glowR}
          stroke="url(#scoreGlowGrad)"
          strokeWidth={glowStrokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={glowAnimatedProps}
          transform={`rotate(-90 ${cx} ${cy})`}
        />

        {/* Progress ring */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={r}
          stroke="url(#scoreGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${cx} ${cy})`}
        />

        {/* Tick marks at 0/90/180/270 degrees */}
        <G>
          {TICK_ANGLES.map((angleDeg) => {
            const angleRad = ((angleDeg - 90) * Math.PI) / 180; // -90 to start from top
            const x1 = cx + tickOuterR * Math.cos(angleRad);
            const y1 = cy + tickOuterR * Math.sin(angleRad);
            const x2 = cx + tickInnerR * Math.cos(angleRad);
            const y2 = cy + tickInnerR * Math.sin(angleRad);
            return (
              <Line
                key={angleDeg}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={1}
              />
            );
          })}
        </G>
      </Svg>

      {/* Center text overlay */}
      <View style={styles.center}>
        <Text
          style={[
            styles.score,
            { fontSize: scoreFontSize },
          ]}
        >
          {score}
        </Text>
        {label && (
          <Text
            style={[
              styles.label,
              { fontSize: labelFontSize },
            ]}
          >
            {label}
          </Text>
        )}
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
    justifyContent: "center",
  },
  score: {
    fontWeight: "700",
    fontFamily: monoFont,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  label: {
    fontWeight: "700",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: "rgba(210,220,242,0.52)",
    marginTop: 2,
  },
});
