import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Panel } from "./Panel";
import { colors, spacing, fonts, shadows } from "../../theme";
import type { EngineKey } from "../../db/schema";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ENGINE_META: Record<EngineKey, { icon: string; label: string; color: string }> = {
  body: { icon: "⚡", label: "Body", color: colors.body },
  mind: { icon: "🧠", label: "Mind", color: colors.mind },
  money: { icon: "💰", label: "Money", color: colors.money },
  general: { icon: "⚙️", label: "General", color: colors.general },
};

type Props = {
  engine: EngineKey;
  score: number;
  completedCount: number;
  totalCount: number;
  onPress: () => void;
};

export const EngineCard = React.memo(function EngineCard({ engine, score, completedCount, totalCount, onPress }: Props) {
  const meta = ENGINE_META[engine];
  const progress = useSharedValue(0);
  const lastScore = useRef(-1);

  const size = 52;
  const strokeWidth = 4;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  useEffect(() => {
    if (lastScore.current !== score) {
      lastScore.current = score;
      progress.value = withTiming(score / 100, {
        duration: 800,
        easing: Easing.bezierFn(0.25, 0.1, 0.25, 1),
      });
    }
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <Panel onPress={onPress} glowColor={meta.color} style={styles.card}>
      <View style={styles.top}>
        <View style={styles.ringWrap}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth={strokeWidth}
              fill="none"
            />
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={meta.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              animatedProps={animatedProps}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
          <Text style={styles.ringIcon}>{meta.icon}</Text>
        </View>

        <Text style={[styles.score, { color: meta.color, textShadowColor: meta.color + "30", textShadowRadius: 8 }]}>
          {score}%
        </Text>
      </View>

      <Text style={styles.label}>{meta.label}</Text>
      <Text style={styles.count}>
        {completedCount}/{totalCount} cleared
      </Text>
    </Panel>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  ringWrap: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  ringIcon: {
    position: "absolute",
    fontSize: 20,
  },
  score: {
    ...fonts.monoValue,
    fontSize: 22,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  count: {
    ...fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
