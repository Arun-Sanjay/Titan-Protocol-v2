import { TextStyle } from "react-native";

export const fonts = {
  hero: {
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1,
    color: "#FFFFFF",
  } satisfies TextStyle,

  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: "#FFFFFF",
  } satisfies TextStyle,

  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  } satisfies TextStyle,

  subheading: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  } satisfies TextStyle,

  body: {
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 24,
    color: "#FFFFFF",
  } satisfies TextStyle,

  caption: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  } satisfies TextStyle,

  small: {
    fontSize: 12,
    fontWeight: "400",
    color: "#6B7280",
  } satisfies TextStyle,

  mono: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: undefined, // Will use system monospace
    color: "#FFFFFF",
  } satisfies TextStyle,

  xpValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#00A8FF",
  } satisfies TextStyle,
};
