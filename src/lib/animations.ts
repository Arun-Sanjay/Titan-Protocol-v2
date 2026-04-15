/**
 * Shared animation configurations for consistent motion across the app.
 *
 * All animations <800ms. Spring for interactive, ease-out for transitions.
 * Respects AccessibilityInfo.isReduceMotionEnabled.
 */

import { AccessibilityInfo } from "react-native";
import {
  withTiming,
  withSpring,
  withSequence,
  Easing,
  type WithTimingConfig,
  type WithSpringConfig,
} from "react-native-reanimated";

// ─── Reduce motion check ────────────────────────────────────────────────────

let _reduceMotion = false;

AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
  _reduceMotion = enabled;
});

AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
  _reduceMotion = enabled;
});

export function isReduceMotion(): boolean {
  return _reduceMotion;
}

// ─── Timing presets ─────────────────────────────────────────────────────────

export const TIMING = {
  /** Protocol phase slide transitions */
  phaseSlide: { duration: 300, easing: Easing.out(Easing.ease) } satisfies WithTimingConfig,

  /** Dashboard section stagger fade */
  staggerFade: { duration: 400, easing: Easing.out(Easing.ease) } satisfies WithTimingConfig,

  /** Score counter count-up */
  scoreCount: { duration: 800, easing: Easing.out(Easing.ease) } satisfies WithTimingConfig,

  /** Quest progress bar fill */
  progressFill: { duration: 400, easing: Easing.out(Easing.ease) } satisfies WithTimingConfig,

  /** Phase indicator fill */
  indicatorFill: { duration: 600, easing: Easing.out(Easing.ease) } satisfies WithTimingConfig,

  /** Quick fade (toasts, overlays) */
  quickFade: { duration: 200, easing: Easing.out(Easing.ease) } satisfies WithTimingConfig,

  /** Vote increment pulse */
  votePulse: { duration: 150 } satisfies WithTimingConfig,
} as const;

// ─── Spring presets ─────────────────────────────────────────────────────────

export const SPRING = {
  /** Habit checkbox toggle */
  checkbox: { damping: 10, stiffness: 200, mass: 0.8 } satisfies WithSpringConfig,

  /** Achievement popup entrance */
  popupEntrance: { damping: 8, stiffness: 200 } satisfies WithSpringConfig,

  /** Skill node unlock */
  nodeUnlock: { damping: 6, stiffness: 150 } satisfies WithSpringConfig,

  /** Boss day-dot pop */
  dayDotPop: { damping: 12, stiffness: 300, mass: 0.6 } satisfies WithSpringConfig,

  /** General interactive spring */
  interactive: { damping: 10, stiffness: 180 } satisfies WithSpringConfig,
} as const;

// ─── Dashboard stagger delay ────────────────────────────────────────────────

/** Calculate stagger delay for dashboard sections */
export function staggerDelay(index: number, baseDelay: number = 0): number {
  if (_reduceMotion) return 0;
  return baseDelay + index * 50;
}

// ─── Checkbox spring sequence ───────────────────────────────────────────────

/** Returns an animated value sequence for checkbox toggle */
export function checkboxSpring(toValue: number) {
  if (_reduceMotion) return withTiming(toValue, { duration: 0 });
  if (toValue === 0) {
    // Uncheck: 1 → 1.1 → 0
    return withSequence(
      withTiming(1.1, { duration: 80 }),
      withSpring(0, SPRING.checkbox),
    );
  }
  // Check: 0 → 0.8 → 1.1 → 1
  return withSequence(
    withTiming(0.8, { duration: 80 }),
    withSpring(1.1, SPRING.checkbox),
    withSpring(1, SPRING.checkbox),
  );
}
