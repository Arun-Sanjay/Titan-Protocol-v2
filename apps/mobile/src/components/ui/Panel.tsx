import React, { useEffect } from "react";
import { View, Pressable, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  FadeInDown,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing, shadows } from "../../theme";

type PanelTone = "default" | "hero" | "subtle";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  glowColor?: string;
  /** @deprecated Use `tone="hero"` instead */
  hero?: boolean;
  tone?: PanelTone;
  /** Entrance animation delay in ms (FadeInDown). Omit to skip entrance anim. */
  delay?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/* ---------- Animated top-edge glow line ---------- */
const GlowLine = React.memo(function GlowLine({ color }: { color?: string }) {
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(12, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-12, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // infinite
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <AnimatedLinearGradient
      colors={[
        "transparent",
        color ?? colors.glowLine,
        color ?? colors.glowLine,
        "transparent",
      ]}
      locations={[0, 0.25, 0.75, 1]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[styles.glowLine, animatedStyle]}
    />
  );
});

/* ---------- Main Panel ---------- */
export const Panel = React.memo(function Panel({
  children,
  onPress,
  style,
  glowColor,
  hero,
  tone = hero ? "hero" : "default",
  delay,
}: Props) {
  const scale = useSharedValue(1);

  const pressAnimStyle = useAnimatedStyle(() => ({
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

  const toneStyle =
    tone === "hero"
      ? styles.hero
      : tone === "subtle"
        ? styles.subtle
        : undefined;

  const content = (
    <>
      {/* Animated top edge glow */}
      <GlowLine color={glowColor} />
      {/* Inner border overlay */}
      <View style={styles.innerBorder} pointerEvents="none" />
      {/* Hero radial gradient overlay */}
      {tone === "hero" && (
        <LinearGradient
          colors={["rgba(191,203,245,0.08)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
          pointerEvents="none"
        />
      )}
      {children}
    </>
  );

  const enteringAnim =
    delay != null
      ? FadeInDown.delay(delay).duration(500).easing(Easing.out(Easing.cubic))
      : undefined;

  if (onPress) {
    return (
      <Animated.View entering={enteringAnim}>
        <AnimatedPressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            styles.panel,
            shadows.panel,
            { borderColor },
            toneStyle,
            pressAnimStyle,
            style,
          ]}
        >
          {content}
        </AnimatedPressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={enteringAnim}
      style={[styles.panel, shadows.panel, { borderColor }, toneStyle, style]}
    >
      {content}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    padding: 20,
    overflow: "hidden",
  },
  hero: {
    backgroundColor: colors.surfaceHero,
  },
  subtle: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderColor: "rgba(255,255,255,0.06)",
  },
  glowLine: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    borderRadius: 1,
    zIndex: 2,
  },
  innerBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.panelInnerBorder,
    // Subtle inner glow matching desktop ::after overlay
    shadowColor: "rgba(255, 255, 255, 1)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
  },
  heroGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.xl,
  },
});
