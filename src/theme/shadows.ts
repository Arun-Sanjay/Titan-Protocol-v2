import { Platform, ViewStyle } from "react-native";

/**
 * Phase 2.1D: Android elevation was causing OOM crashes with 15+ task rows.
 *
 * Each `elevation` value on Android creates a separate native RenderNode
 * (GPU composition layer). At ~15+ MissionRow components each with
 * elevation: 4, the GPU compositor ran out of texture memory on mid-range
 * devices. iOS doesn't have this problem — `shadowColor`/`shadowOffset`/etc.
 * are cheap on iOS because shadows are drawn at rasterization time.
 *
 * Strategy: keep the full shadow look on iOS, cap elevation on Android at
 * 2 (panel) or 0 (card/row — depth is faked via borderColor in StyleSheet).
 *
 * When designing new shadows, prefer the `iosOnly` helper for per-row styles
 * and only add elevation to screen-level containers.
 */
import type {} from "react-native"; // keep import placement stable

const iosShadow = (s: Pick<ViewStyle, "shadowColor" | "shadowOffset" | "shadowOpacity" | "shadowRadius">): ViewStyle =>
  Platform.OS === "ios" ? s : {};

export const shadows = {
  /** Big panels — used for hero cards and screen containers (1-3 per screen). */
  panel: {
    ...iosShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.66,
      shadowRadius: 27,
    }),
    // Android: keep a small elevation for depth perception on hero panels.
    elevation: Platform.OS === "android" ? 2 : 8,
  } satisfies ViewStyle,

  /**
   * Per-row cards — MissionRow, HabitChain, QuestCard, etc. These can be
   * rendered 15+ times on a single screen. On Android, elevation is set to
   * 0 (no GPU layer) and depth is implied by the existing 1px border +
   * surface color. On iOS, keep the full shadow.
   */
  card: {
    ...iosShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
    }),
    elevation: 0,
  } satisfies ViewStyle,

  glow: {
    ...iosShadow({
      shadowColor: "rgba(188, 202, 247, 1)",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
    }),
    elevation: Platform.OS === "android" ? 1 : 4,
  } satisfies ViewStyle,

  ring: {
    ...iosShadow({
      shadowColor: "rgba(188, 202, 247, 1)",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
    }),
    elevation: Platform.OS === "android" ? 2 : 6,
  } satisfies ViewStyle,

  panelGlow: {
    ...iosShadow({
      shadowColor: "rgba(188, 202, 247, 1)",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.14,
      shadowRadius: 22,
    }),
    elevation: Platform.OS === "android" ? 2 : 6,
  } satisfies ViewStyle,
} as const;
