import { Platform, TextStyle } from "react-native";
import { colors } from "./colors";

const monoFont = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

export const fonts = {
  hero: {
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: 2,
    color: colors.text,
    textTransform: "uppercase" as const,
  } satisfies TextStyle,

  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.text,
  } satisfies TextStyle,

  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  } satisfies TextStyle,

  subheading: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  } satisfies TextStyle,

  body: {
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 24,
    color: colors.text,
  } satisfies TextStyle,

  // Desktop kicker style — uppercase, wide spacing, muted color
  kicker: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 3,
  } satisfies TextStyle,

  caption: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 1.5,
  } satisfies TextStyle,

  small: {
    fontSize: 12,
    fontWeight: "400",
    color: colors.textSecondary,
  } satisfies TextStyle,

  mono: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: monoFont,
    color: colors.text,
  } satisfies TextStyle,

  monoLarge: {
    fontSize: 48,
    fontWeight: "300",
    fontFamily: monoFont,
    color: colors.text,
    fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
  } satisfies TextStyle,

  monoValue: {
    fontSize: 24,
    fontWeight: "800",
    fontFamily: monoFont,
    color: colors.text,
  } satisfies TextStyle,

  xpValue: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: monoFont,
    color: colors.textSecondary,
  } satisfies TextStyle,
};
