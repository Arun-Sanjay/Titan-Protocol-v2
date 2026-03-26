import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors, radius } from "../../theme";

type Props = {
  value: number; // 0–1
  color?: string;
  height?: number;
};

export const TitanProgress = React.memo(function TitanProgress({
  value,
  color = colors.primary,
  height = 7,
}: Props) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.min(1, Math.max(0, value)), {
      duration: 800,
      easing: Easing.bezierFn(0.25, 0.1, 0.25, 1),
    });
  }, [value]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%` as any,
  }));

  return (
    <View style={[styles.track, { height }]}>
      <Animated.View
        style={[
          styles.fill,
          {
            height,
            backgroundColor: color,
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
          },
          fillStyle,
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  track: {
    width: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.06)",
    overflow: "hidden",
  },
  fill: {
    borderRadius: radius.full,
  },
});
