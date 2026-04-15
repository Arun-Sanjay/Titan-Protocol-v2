import React, { useEffect } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
  interpolate,
} from "react-native-reanimated";
import Svg, { Line, Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { colors } from "../../theme";

const AnimatedView = Animated.View;

/* ---------- Constants ---------- */
const GRID_SPACING = 60;
const GRID_STROKE = "rgba(255,255,255,0.03)";
const SCAN_DURATION = 10000;
const PULSE_DURATION = 7200;

/* ---------- Grid overlay (SVG) ---------- */
const GridOverlay = React.memo(function GridOverlay() {
  const { width, height } = useWindowDimensions();

  const cols = Math.ceil(width / GRID_SPACING);
  const rows = Math.ceil(height / GRID_SPACING);

  const verticalLines: React.ReactNode[] = [];
  for (let i = 0; i <= cols; i++) {
    const x = i * GRID_SPACING;
    verticalLines.push(
      <Line
        key={`v${i}`}
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={GRID_STROKE}
        strokeWidth={0.5}
      />,
    );
  }

  const horizontalLines: React.ReactNode[] = [];
  for (let j = 0; j <= rows; j++) {
    const y = j * GRID_SPACING;
    horizontalLines.push(
      <Line
        key={`h${j}`}
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke={GRID_STROKE}
        strokeWidth={0.5}
      />,
    );
  }

  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {verticalLines}
      {horizontalLines}
    </Svg>
  );
});

/* ---------- Ambient glow pulse ---------- */
const AmbientGlow = React.memo(function AmbientGlow() {
  const { width, height } = useWindowDimensions();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: PULSE_DURATION / 2,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0, {
          duration: PULSE_DURATION / 2,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
    return () => {
      // Phase 2.1A: cancel infinite pulse on unmount
      cancelAnimation(pulse);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.04, 0.08]),
  }));

  return (
    <AnimatedView
      style={[
        StyleSheet.absoluteFill,
        glowStyle,
      ]}
      pointerEvents="none"
    >
      <Svg width={width} height={height} pointerEvents="none">
        <Defs>
          <RadialGradient id="ambientGlow" cx="50%" cy="30%" rx="60%" ry="40%">
            <Stop offset="0%" stopColor="rgba(188,202,247,1)" stopOpacity={1} />
            <Stop offset="100%" stopColor="rgba(188,202,247,0)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#ambientGlow)" />
      </Svg>
    </AnimatedView>
  );
});

/* ---------- Scan line ---------- */
const ScanLine = React.memo(function ScanLine() {
  const { height } = useWindowDimensions();
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(height, {
        duration: SCAN_DURATION,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    return () => {
      // Phase 2.1A: cancel infinite scan on unmount / height change
      cancelAnimation(translateY);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <AnimatedView
      style={[styles.scanLine, scanStyle]}
      pointerEvents="none"
    />
  );
});

/* ---------- Main background component ---------- */
export const HUDBackground = React.memo(function HUDBackground() {
  return (
    <View style={styles.container} pointerEvents="none">
      {/* Base black */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />
      {/* Ambient glow pulse */}
      <AmbientGlow />
      {/* Grid pattern */}
      <GridOverlay />
      {/* Scan sweep */}
      <ScanLine />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  scanLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});
