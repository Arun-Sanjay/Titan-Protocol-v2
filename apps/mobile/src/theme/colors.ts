// Titan Protocol Mobile — "Arc Reactor" Color System
export const colors = {
  // Backgrounds
  bg: "#000000",
  surface: "#0A0A0F",
  surfaceLight: "#111118",
  surfaceBorder: "#1A1A2E",

  // Primary accent — Arc Reactor Blue
  primary: "#00A8FF",
  primaryDim: "rgba(0, 168, 255, 0.15)",
  primaryGlow: "rgba(0, 168, 255, 0.08)",
  primaryMuted: "rgba(0, 168, 255, 0.5)",

  // Status
  success: "#00FF88",
  successDim: "rgba(0, 255, 136, 0.15)",
  warning: "#FFB800",
  warningDim: "rgba(255, 184, 0, 0.15)",
  danger: "#FF3366",
  dangerDim: "rgba(255, 51, 102, 0.15)",

  // Text
  text: "#FFFFFF",
  textSecondary: "#6B7280",
  textMuted: "#3B3B4F",

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
} as const;

export type ColorKey = keyof typeof colors;
