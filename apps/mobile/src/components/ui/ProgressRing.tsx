import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from "react-native-reanimated";
import { colors, fonts } from "../../theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  progress: number; // 0-1
  label: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
};

export const ProgressRing = React.memo(function ProgressRing({
  progress,
  label,
  size = 60,
  strokeWidth = 5,
  color = colors.success,
}: Props) {
  const animProgress = useSharedValue(0);
  const lastProgress = useRef(-1);

  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  useEffect(() => {
    if (lastProgress.current !== progress) {
      lastProgress.current = progress;
      animProgress.value = withTiming(Math.min(1, Math.max(0, progress)), {
        duration: 800,
        easing: Easing.bezierFn(0.25, 0.1, 0.25, 1),
      });
    }
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animProgress.value),
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    position: "absolute",
    ...fonts.mono,
    fontSize: 11,
    color: colors.text,
    textAlign: "center",
  },
});
