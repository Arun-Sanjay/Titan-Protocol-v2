import React, { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing, shadows } from "../../theme";
import { useIsOnline } from "../../hooks/useIsOnline";

/**
 * Phase 3.4b: Thin offline status banner.
 *
 * Slides in from the top when the device loses network. Uses the same
 * useIsOnline hook every other consumer uses, so there's one source of
 * truth for online state.
 *
 * Design:
 *   - Only appears while offline — zero visual impact when connected
 *   - Absolute-positioned at the top (below the safe-area inset) so it
 *     overlays any screen without reflowing content
 *   - Small pointerEvents="none" so it doesn't swallow taps (users can
 *     still interact with whatever's behind it)
 *   - Phase 2.1A cleanup pattern: cancelAnimation on unmount
 */
export function OfflineBanner() {
  const isOnline = useIsOnline();
  const insets = useSafeAreaInsets();

  // Opacity + translateY spring in from -100%.
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-40);

  useEffect(() => {
    if (isOnline) {
      opacity.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
      translateY.value = withTiming(-40, { duration: 200, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      translateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    }
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(translateY);
    };
  }, [isOnline, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { top: insets.top + spacing.xs },
        animatedStyle,
      ]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel="Offline. Changes will sync when you reconnect."
    >
      <Ionicons
        name="cloud-offline-outline"
        size={14}
        color={colors.text}
        style={styles.icon}
      />
      <Text style={styles.text}>OFFLINE · CHANGES WILL SYNC WHEN YOU RECONNECT</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceHero,
    borderWidth: 1,
    borderColor: colors.warningDim,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.card,
  },
  icon: {
    marginRight: spacing.sm,
  },
  text: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.text,
  },
});
