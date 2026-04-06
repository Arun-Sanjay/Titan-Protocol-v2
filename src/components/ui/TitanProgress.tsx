import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius } from "../../theme";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

type Props = {
  /** Progress value 0-100 */
  value: number;
  /** Override fill color (replaces gradient with solid) */
  color?: string;
  /** Track height in px. Default 7 */
  height?: number;
  /** Animate fill width. Default true */
  animated?: boolean;
  /** Show shimmer on fill. Default true */
  shimmer?: boolean;
};

/* ---------- Shimmer highlight strip ---------- */
const Shimmer = React.memo(function Shimmer() {
  const translate = useSharedValue(-1);

  useEffect(() => {
    translate.value = withRepeat(
      withTiming(2, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    return () => {
      // Phase 2.1A: cancel infinite shimmer on unmount — Shimmer renders
      // once per TitanProgress, and there can be many on a single screen.
      cancelAnimation(translate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${translate.value * 100}%` as any }],
    opacity: interpolate(
      translate.value,
      [-1, 0, 1, 2],
      [0, 0.5, 0.5, 0],
    ),
  }));

  return (
    <Animated.View style={[styles.shimmerStrip, shimmerStyle]} />
  );
});

/* ---------- Main Component ---------- */
export const TitanProgress = React.memo(function TitanProgress({
  value,
  color,
  height = 7,
  animated = true,
  shimmer = true,
}: Props) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const clamped = Math.max(0, Math.min(safeValue, 100));
  const isOverflow = safeValue > 100;
  const fillWidth = useSharedValue(animated ? 0 : clamped);

  useEffect(() => {
    if (animated) {
      fillWidth.value = withTiming(clamped, {
        duration: 600,
        easing: Easing.bezierFn(0.4, 0, 0.2, 1),
      });
    } else {
      fillWidth.value = clamped;
    }
  }, [clamped, animated]);

  const fillAnimStyle = useAnimatedStyle(() => ({
    width: `${fillWidth.value}%` as any,
  }));

  // Danger glow for overflow
  const trackOverflowStyle = isOverflow
    ? {
        borderColor: "rgba(248,113,113,0.40)",
        shadowColor: colors.danger,
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      }
    : undefined;

  return (
    <View style={[styles.track, { height }, trackOverflowStyle]}>
      <Animated.View style={[styles.fillContainer, { height }, fillAnimStyle]}>
        {color ? (
          <View
            style={[
              styles.fillSolid,
              {
                height,
                backgroundColor: isOverflow ? colors.danger : color,
              },
            ]}
          />
        ) : (
          <LinearGradient
            colors={
              isOverflow
                ? [colors.danger, "rgba(248,113,113,0.7)"]
                : ["rgba(210,220,233,0.58)", "rgba(244,248,255,0.95)"]
            }
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.fillGradient, { height }]}
          />
        )}
        {shimmer && clamped > 0 && <Shimmer />}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  track: {
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.92)",
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  fillContainer: {
    borderRadius: radius.full,
    overflow: "hidden",
  },
  fillSolid: {
    flex: 1,
    borderRadius: radius.full,
  },
  fillGradient: {
    flex: 1,
    borderRadius: radius.full,
  },
  shimmerStrip: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "50%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: radius.full,
  },
});
