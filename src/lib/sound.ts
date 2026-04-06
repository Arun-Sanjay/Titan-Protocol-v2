/**
 * Sound/Haptics manager — tactile feedback patterns for System events.
 *
 * Uses expo-haptics for haptic feedback gated by a user-togglable preference.
 * No audio files required; all feedback is delivered through the taptic engine.
 *
 * Usage:
 *   import { playRewardChime, toggleSound } from "../lib/sound";
 *   playRewardChime(); // triple-tap reward pattern
 *   toggleSound();     // flip pref on/off
 */

import * as Haptics from "expo-haptics";
import { getJSON, setJSON } from "../db/storage";

// ─── Preference ──────────────────────────────────────────────────────────────

const SOUND_KEY = "sound_enabled";

export function isSoundEnabled(): boolean {
  return getJSON<boolean>(SOUND_KEY, true);
}

export function toggleSound(): boolean {
  const next = !isSoundEnabled();
  setJSON(SOUND_KEY, next);
  return next;
}

// ─── Haptic patterns ─────────────────────────────────────────────────────────

/** Soft single tap — info confirmations, quest prompts. */
export function playSystemPing(): void {
  if (!isSoundEnabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** OS-level warning buzz. */
export function playWarning(): void {
  if (!isSoundEnabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** Triple-tap ascending pattern — XP gains, quest completions. */
export function playRewardChime(): void {
  if (!isSoundEnabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 100);
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
}

/** 4-tap ascending crescendo — rank-up / level-up moments. */
export function playRankUp(): void {
  if (!isSoundEnabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 120);
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 240);
  setTimeout(
    () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    400,
  );
}
