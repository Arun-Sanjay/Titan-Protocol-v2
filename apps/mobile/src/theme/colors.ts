// Titan Protocol Mobile — HUD Theme (matches desktop exactly)
export const colors = {
  // Backgrounds — pure black base
  bg: "#000000",
  bgGradient: "#010102",
  surface: "rgba(0, 0, 0, 0.97)",
  surfaceHero: "rgba(0, 0, 0, 0.985)",
  surfaceLight: "rgba(0, 0, 0, 0.95)",
  surfaceBorder: "rgba(255, 255, 255, 0.12)",
  surfaceBorderStrong: "rgba(255, 255, 255, 0.24)",

  // Primary accent — clean white (HUD uses white accents, not cyan)
  primary: "rgba(247, 250, 255, 0.96)",
  primaryDim: "rgba(255, 255, 255, 0.08)",
  primaryGlow: "rgba(188, 202, 247, 0.14)",
  primaryMuted: "rgba(255, 255, 255, 0.50)",

  // Status
  success: "#34d399",
  successDim: "rgba(52, 211, 153, 0.15)",
  warning: "#FBBF24",
  warningDim: "rgba(251, 191, 36, 0.15)",
  danger: "#f87171",
  dangerDim: "rgba(248, 113, 113, 0.15)",

  // Text
  text: "rgba(245, 248, 255, 0.92)",
  textSecondary: "rgba(210, 216, 230, 0.62)",
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
  bodyDim: "rgba(0, 255, 136, 0.12)",
  mind: "#A78BFA",
  mindDim: "rgba(167, 139, 250, 0.12)",
  money: "#FBBF24",
  moneyDim: "rgba(251, 191, 36, 0.12)",
  general: "#60A5FA",
  generalDim: "rgba(96, 165, 250, 0.12)",

  // Panel specific (HUD — white tinted, not cyan)
  panelBorder: "rgba(255, 255, 255, 0.12)",
  panelBorderHover: "rgba(255, 255, 255, 0.26)",
  panelHighlight: "rgba(255, 255, 255, 0.10)",
  panelInnerBorder: "rgba(255, 255, 255, 0.04)",
  glowLine: "rgba(242, 247, 255, 0.5)",
  glowSoft: "rgba(188, 202, 247, 0.14)",

  // Card chrome — matches web's chrome-panel gradient
  cardHighlight: "rgba(255, 255, 255, 0.06)",
  cardBorderActive: "rgba(255, 255, 255, 0.40)",

  // Heatmap colors — matches web exactly
  heatGreen: "rgba(90, 236, 160, 0.18)",
  heatGreenBorder: "rgba(112, 244, 176, 0.58)",
  heatYellow: "rgba(255, 204, 60, 0.20)",
  heatYellowBorder: "rgba(255, 212, 86, 0.60)",
  heatRed: "rgba(255, 82, 82, 0.24)",
  heatRedBorder: "rgba(255, 98, 98, 0.58)",
  heatGray: "rgba(140, 148, 166, 0.20)",
  heatGrayBorder: "rgba(190, 200, 220, 0.24)",

  // Tab bar — matches sidebar
  tabBar: "#080809",
  tabBarBorder: "rgba(255, 255, 255, 0.06)",

  // Accent for interactive elements
  accent: "#34d399",
  accentDim: "rgba(52, 211, 153, 0.15)",

  // Input surfaces
  inputBg: "rgba(255, 255, 255, 0.04)",
  inputBorder: "rgba(255, 255, 255, 0.10)",
  inputFocusBorder: "rgba(255, 255, 255, 0.30)",
} as const;

export type ColorKey = keyof typeof colors;

// Titan Mode gold accent (only active when mode === 'titan')
export const titanColors = {
  accent: "#FFD700",
  accentMuted: "rgba(255, 215, 0, 0.30)",
  accentGlow: "rgba(255, 215, 0, 0.15)",
  accentDim: "rgba(255, 215, 0, 0.06)",
  ringGlow: "rgba(255, 215, 0, 0.20)",
} as const;

/**
 * Get the appropriate accent color — gold in Titan Mode, default otherwise.
 */
export function getTitanAccent(isTitanMode: boolean): string {
  return isTitanMode ? titanColors.accent : colors.primary;
}
