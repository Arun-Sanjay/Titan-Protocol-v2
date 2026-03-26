// Titan Protocol Mobile — HUD Theme (matches desktop exactly)
export const colors = {
  // Backgrounds — pure black base
  bg: "#000000",
  bgGradient: "#010102",
  surface: "rgba(0, 0, 0, 0.97)",
  surfaceHero: "rgba(0, 0, 0, 0.985)",
  surfaceLight: "rgba(0, 0, 0, 0.95)",
  surfaceBorder: "rgba(255, 255, 255, 0.11)",
  surfaceBorderStrong: "rgba(255, 255, 255, 0.24)",

  // Primary accent — clean white (HUD uses white accents, not cyan)
  primary: "rgba(247, 250, 255, 0.96)",
  primaryDim: "rgba(255, 255, 255, 0.08)",
  primaryGlow: "rgba(188, 202, 247, 0.14)",
  primaryMuted: "rgba(255, 255, 255, 0.50)",

  // Status
  success: "#5cc9a0",
  successDim: "rgba(92, 201, 160, 0.15)",
  warning: "#FBBF24",
  warningDim: "rgba(251, 191, 36, 0.15)",
  danger: "#de6b7d",
  dangerDim: "rgba(222, 107, 125, 0.15)",

  // Text
  text: "rgba(247, 250, 255, 0.96)",
  textSecondary: "rgba(233, 240, 255, 0.72)",
  textMuted: "rgba(210, 220, 242, 0.52)",

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

  // Panel specific (HUD — white tinted, not cyan)
  panelBorder: "rgba(255, 255, 255, 0.11)",
  panelBorderHover: "rgba(255, 255, 255, 0.26)",
  panelHighlight: "rgba(255, 255, 255, 0.10)",
  panelInnerBorder: "rgba(255, 255, 255, 0.03)",
  glowLine: "rgba(242, 247, 255, 0.5)",
  glowSoft: "rgba(188, 202, 247, 0.14)",

  // Tab bar — matches sidebar
  tabBar: "#080809",
  tabBarBorder: "rgba(255, 255, 255, 0.06)",

  // Accent for interactive elements (using success green like desktop)
  accent: "#5cc9a0",
  accentDim: "rgba(92, 201, 160, 0.15)",
} as const;

export type ColorKey = keyof typeof colors;
