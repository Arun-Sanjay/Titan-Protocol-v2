import { ViewStyle } from "react-native";

// Desktop-matching shadow presets for React Native
// RN doesn't support inset shadows or multiple shadows natively,
// so we approximate with elevation + shadowColor

export const shadows = {
  panel: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 27,
    elevation: 8,
  } satisfies ViewStyle,

  panelGlow: {
    shadowColor: "rgba(56, 189, 248, 1)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 6,
  } satisfies ViewStyle,

  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 4,
  } satisfies ViewStyle,

  glow: {
    shadowColor: "rgba(56, 189, 248, 1)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  } satisfies ViewStyle,

  ring: {
    shadowColor: "rgba(56, 189, 248, 1)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 6,
  } satisfies ViewStyle,
} as const;
