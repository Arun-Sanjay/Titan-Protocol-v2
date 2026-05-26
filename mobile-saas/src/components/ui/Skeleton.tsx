import React, { useEffect } from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { colors, radius, spacing } from "../../theme";

/**
 * Phase 2.4B: Reusable skeleton loader.
 *
 * Replaces the "Loading…" text strings sprinkled across data-heavy
 * screens (HQ dashboard, engines, profile, hub subscreens). Animated
 * pulse uses Reanimated 4 with cleanup-on-unmount per the Phase 2.1A
 * convention — no leaks even if the screen unmounts mid-fetch.
 *
 * Usage:
 *   <Skeleton variant="card" />              // 200px tall card placeholder
 *   <Skeleton variant="metric" />            // 100px tall metric placeholder
 *   <Skeleton variant="text" width="80%" /> // line of text placeholder
 *   <Skeleton width={120} height={32} radius={16} /> // custom shape
 *   <SkeletonGroup>...children...</SkeletonGroup>     // shared rhythm wrapper
 */

type SkeletonVariant = "text" | "card" | "metric" | "circle" | "pill";

type SkeletonProps = {
  variant?: SkeletonVariant;
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

const VARIANT_DEFAULTS: Record<
  SkeletonVariant,
  { width: number | `${number}%`; height: number; radius: number }
> = {
  text: { width: "100%", height: 14, radius: 4 },
  card: { width: "100%", height: 200, radius: 16 },
  metric: { width: "100%", height: 100, radius: 12 },
  circle: { width: 48, height: 48, radius: 999 },
  pill: { width: 80, height: 28, radius: 999 },
};

export const Skeleton = React.memo(function Skeleton({
  variant = "text",
  width,
  height,
  radius: cornerRadius,
  style,
}: SkeletonProps) {
  const defaults = VARIANT_DEFAULTS[variant];
  const finalWidth = width ?? defaults.width;
  const finalHeight = height ?? defaults.height;
  const finalRadius = cornerRadius ?? defaults.radius;

  // Pulse animation: opacity oscillates between 0.4 and 0.8 in a 1.4s loop.
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    // Phase 2.1A pattern: cancel infinite animation on unmount.
    return () => {
      cancelAnimation(pulse);
    };
  }, [pulse]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width: finalWidth as ViewStyle["width"],
          height: finalHeight,
          borderRadius: finalRadius,
        },
        animStyle,
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      accessibilityHint="Content is loading"
    />
  );
});

/**
 * Convenience: vertical stack of N text-line skeletons. Useful for list
 * placeholders. Also accepts arbitrary children for custom layouts that
 * just need consistent vertical rhythm.
 */
export function SkeletonGroup({
  children,
  lines,
  gap = spacing.sm,
}: {
  children?: React.ReactNode;
  /** If set, render this many text-variant skeletons instead of children. */
  lines?: number;
  /** Gap between children/lines (default spacing.sm). */
  gap?: number;
}) {
  if (lines !== undefined) {
    return (
      <View style={{ gap }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            // Slightly varied widths feel more natural than uniform bars.
            width={i === lines - 1 ? "60%" : "100%"}
          />
        ))}
      </View>
    );
  }
  return <View style={{ gap }}>{children}</View>;
}

/**
 * Card-shaped placeholder with a kicker line + 2 body lines. The most
 * common skeleton for engine/profile/hub screens.
 */
export function SkeletonCard() {
  return (
    <View style={styles.cardContainer}>
      <Skeleton variant="text" width="40%" height={10} />
      <View style={{ height: spacing.md }} />
      <Skeleton variant="text" height={20} />
      <View style={{ height: spacing.sm }} />
      <Skeleton variant="text" width="80%" height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceBorder,
  },
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    padding: spacing.lg,
  },
});
