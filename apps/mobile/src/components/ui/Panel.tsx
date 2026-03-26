import React from "react";
import { View, Pressable, StyleSheet, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { LinearGradient } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing, shadows } from "../../theme";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  glowColor?: string;
  hero?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Panel = React.memo(function Panel({ children, onPress, style, glowColor, hero }: Props) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 200 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const borderColor = glowColor ? glowColor + "18" : colors.panelBorder;
  const glowShadow = glowColor
    ? { ...shadows.glow, shadowColor: glowColor }
    : shadows.panel;

  const content = (
    <>
      {/* Top edge highlight — simulates desktop inset top glow */}
      <View style={[styles.topEdge, hero && styles.topEdgeHero]} />
      {children}
    </>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.panel, glowShadow, { borderColor }, hero && styles.hero, animStyle, style]}
      >
        {content}
      </AnimatedPressable>
    );
  }

  return (
    <View style={[styles.panel, shadows.panel, { borderColor }, hero && styles.hero, style]}>
      {content}
    </View>
  );
});

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    padding: spacing.lg,
    overflow: "hidden",
  },
  hero: {
    backgroundColor: "rgba(4, 8, 16, 0.97)",
  },
  topEdge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.panelHighlight,
  },
  topEdgeHero: {
    backgroundColor: "rgba(56, 189, 248, 0.18)",
  },
});
