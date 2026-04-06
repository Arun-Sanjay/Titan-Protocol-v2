import { ViewStyle } from "react-native";

// Desktop HUD theme shadows — white/neutral, no cyan
export const shadows = {
  panel: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.66,
    shadowRadius: 27,
    elevation: 8,
  } satisfies ViewStyle,

  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 4,
  } satisfies ViewStyle,

  glow: {
    shadowColor: "rgba(188, 202, 247, 1)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 4,
  } satisfies ViewStyle,

  ring: {
    shadowColor: "rgba(188, 202, 247, 1)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 6,
  } satisfies ViewStyle,

  panelGlow: {
    shadowColor: "rgba(188, 202, 247, 1)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 6,
  } satisfies ViewStyle,
} as const;
