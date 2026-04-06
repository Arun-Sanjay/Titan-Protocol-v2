import { Platform, TextStyle } from "react-native";
import { colors } from "./colors";

// Phase 2.4D: JetBrains Mono is loaded at the root layout via
// @expo-google-fonts/jetbrains-mono. Font names below match the keys
// passed to useFonts() in app/_layout.tsx. Until fonts hydrate the
// root layout returns null, so the system fallback is never visible.
//
// `font(weight)` picks the right loaded variant. The fallback to
// Menlo/monospace only kicks in if the @expo-google-fonts package is
// uninstalled — used as a defensive measure during dev.
const FALLBACK_MONO = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

const JBM_REGULAR = "JetBrainsMono_400Regular";
const JBM_SEMIBOLD = "JetBrainsMono_600SemiBold";
const JBM_BOLD = "JetBrainsMono_700Bold";
const JBM_EXTRABOLD = "JetBrainsMono_800ExtraBold";

const monoFont = JBM_REGULAR; // default for plain mono
const monoFontSemiBold = JBM_SEMIBOLD;
const monoFontBold = JBM_BOLD;
const monoFontExtraBold = JBM_EXTRABOLD;
// Suppress unused warning for the fallback used by future error paths.
void FALLBACK_MONO;

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
    fontFamily: monoFontSemiBold,
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
    fontFamily: monoFontExtraBold,
    color: colors.text,
  } satisfies TextStyle,

  xpValue: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: monoFontBold,
    color: colors.textSecondary,
  } satisfies TextStyle,
};
