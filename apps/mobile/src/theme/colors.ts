// Titan Protocol Mobile — Cyberpunk Theme (matches desktop Tauri build)
export const colors = {
  // Backgrounds — deep blue-black, not pure black
  bg: "#0b0b0d",
  surface: "rgba(0, 0, 0, 0.97)",
  surfaceLight: "rgba(4, 8, 16, 0.97)",
  surfaceSoft: "rgba(255, 255, 255, 0.04)",
  surfaceBorder: "rgba(56, 189, 248, 0.10)",

  // Primary accent — Cyberpunk Cyan
  primary: "#38bdf8",
  primaryDim: "rgba(56, 189, 248, 0.12)",
  primaryGlow: "rgba(56, 189, 248, 0.06)",
  primaryMuted: "rgba(56, 189, 248, 0.50)",
  primaryBright: "rgba(56, 189, 248, 0.95)",

  // Status
  success: "#5cc9a0",
  successDim: "rgba(92, 201, 160, 0.15)",
  warning: "#FBBF24",
  warningDim: "rgba(251, 191, 36, 0.15)",
  danger: "#de6b7d",
  dangerDim: "rgba(222, 107, 125, 0.15)",

  // Text — off-white, not pure white
  text: "rgba(245, 248, 255, 0.92)",
  textSecondary: "rgba(255, 255, 255, 0.55)",
  textMuted: "rgba(255, 255, 255, 0.30)",

  // Rank colors
  rankD: "#6B7280",
  rankC: "#A78BFA",
  rankB: "#60A5FA",
  rankA: "#34D399",
  rankS: "#FBBF24",
  rankSS: "#F97316",

  // Engine colors
  body: "#00FF88",
  mind: "#A78BFA",
  money: "#FBBF24",
  general: "#60A5FA",

  // Panel specific
  panelBorder: "rgba(56, 189, 248, 0.08)",
  panelBorderHover: "rgba(56, 189, 248, 0.25)",
  panelHighlight: "rgba(56, 189, 248, 0.12)",
  panelGradientTop: "rgba(56, 189, 248, 0.02)",

  // Tab bar
  tabBar: "#080809",
  tabBarBorder: "rgba(56, 189, 248, 0.15)",
} as const;

export type ColorKey = keyof typeof colors;
