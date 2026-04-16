import React, { useEffect } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors } from "../../theme";

type Props = {
  label: string;
  value: string | number;
  size?: "sm" | "md" | "lg" | "hero";
  color?: string;
  suffix?: string;
  /** Animate numeric value counting up from 0. Default false. */
  animated?: boolean;
};

const MONO_FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

/* Size configuration matching web metric styles */
const sizeConfig = {
  sm: { fontSize: 18, fontWeight: "650" as any },
  md: { fontSize: 24, fontWeight: "650" as any },
  lg: { fontSize: 32, fontWeight: "650" as any },
  hero: { fontSize: 48, fontWeight: "650" as any },
} as const;

/* ---------- Animated number text ---------- */
const AnimatedTextInput = Animated.createAnimatedComponent(
  require("react-native").TextInput,
);

const CountUpValue = React.memo(function CountUpValue({
  target,
  size,
  color,
  suffix,
}: {
  target: number;
  size: "sm" | "md" | "lg" | "hero";
  color?: string;
  suffix?: string;
}) {
  const current = useSharedValue(0);

  useEffect(() => {
    current.value = withTiming(target, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [target]);

  const animProps = useAnimatedProps(() => {
    // Format: if target is integer, show integer; otherwise 1 decimal
    const isInteger = target === Math.floor(target);
    const display = isInteger
      ? Math.round(current.value).toString()
      : current.value.toFixed(1);
    return {
      text: suffix ? `${display}${suffix}` : display,
      defaultValue: suffix ? `0${suffix}` : "0",
    };
  });

  const config = sizeConfig[size];
  const heroShadow =
    size === "hero"
      ? {
          textShadowColor: "rgba(188,204,252,0.14)",
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 10,
        }
      : undefined;

  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      animatedProps={animProps}
      style={[
        styles.value,
        {
          fontSize: config.fontSize,
          fontWeight: config.fontWeight,
          color: color ?? colors.text,
        },
        heroShadow,
      ]}
    />
  );
});

/* ---------- Static value ---------- */
const StaticValue = React.memo(function StaticValue({
  value,
  size,
  color,
  suffix,
}: {
  value: string | number;
  size: "sm" | "md" | "lg" | "hero";
  color?: string;
  suffix?: string;
}) {
  const config = sizeConfig[size];
  const heroShadow =
    size === "hero"
      ? {
          textShadowColor: "rgba(188,204,252,0.14)",
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 10,
        }
      : undefined;

  const display = suffix ? `${value}${suffix}` : `${value}`;

  return (
    <Text
      style={[
        styles.value,
        {
          fontSize: config.fontSize,
          fontWeight: config.fontWeight,
          color: color ?? colors.text,
        },
        heroShadow,
      ]}
    >
      {display}
    </Text>
  );
});

/* ---------- Main Component ---------- */
export const MetricValue = React.memo(function MetricValue({
  label,
  value,
  size = "md",
  color,
  suffix,
  animated = false,
}: Props) {
  const isNumeric = typeof value === "number" && !isNaN(value) && isFinite(value);

  return (
    <View style={styles.container}>
      {animated && isNumeric ? (
        <CountUpValue
          target={value as number}
          size={size}
          color={color}
          suffix={suffix}
        />
      ) : (
        <StaticValue
          value={value}
          size={size}
          color={color}
          suffix={suffix}
        />
      )}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
  },
  value: {
    fontFamily: MONO_FONT,
    fontVariant: ["tabular-nums"],
    color: colors.text,
    includeFontPadding: false,
    padding: 0,
    margin: 0,
  },
  label: {
    fontSize: 10,
    fontWeight: "500",
    color: "rgba(233,240,255,0.72)",
    textTransform: "uppercase",
    letterSpacing: 2.0, // ~0.15em at 10px
    marginTop: 4,
  },
});
