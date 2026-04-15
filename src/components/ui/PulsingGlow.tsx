import React, { useEffect } from "react";
import { ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";

type Props = {
  children: React.ReactNode;
  active?: boolean;
  style?: ViewStyle;
  minOpacity?: number;
  maxOpacity?: number;
  duration?: number;
};

export const PulsingGlow = React.memo(function PulsingGlow({
  children,
  active = true,
  style,
  minOpacity = 0.85,
  maxOpacity = 1,
  duration = 3000,
}: Props) {
  const opacity = useSharedValue(maxOpacity);

  useEffect(() => {
    if (active) {
      opacity.value = withRepeat(
        withTiming(minOpacity, { duration, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      opacity.value = withTiming(1, { duration: 200 });
    }
    return () => {
      // Phase 2.1A: cancel infinite animation on unmount/rerun to avoid leak.
      cancelAnimation(opacity);
    };
  }, [active, minOpacity, duration]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[style, animStyle]}>
      {children}
    </Animated.View>
  );
});
