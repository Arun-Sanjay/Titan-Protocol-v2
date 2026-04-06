/**
 * Haptic feedback system
 *
 * Wraps expo-haptics with a global disable flag (persisted in MMKV).
 * Use specific named functions for consistent haptic language:
 * - Light: habit toggle, option select, suggestion accept, quest progress
 * - Medium: phase advance, answer confirm, mode switch
 * - Heavy: achievement, quest complete, boss day, phase update
 * - Success: protocol complete, boss defeated, perfect day, titan unlock
 * - Warning: streak at risk
 * - Error: wrong answer
 */

import * as Haptics from "expo-haptics";
import { getJSON, setJSON } from "../db/storage";

const HAPTICS_KEY = "haptics_enabled";

// ─── Global flag ────────────────────────────────────────────────────────────

function isEnabled(): boolean {
  return getJSON<boolean>(HAPTICS_KEY, true);
}

export function setHapticsEnabled(enabled: boolean): void {
  setJSON(HAPTICS_KEY, enabled);
}

export function getHapticsEnabled(): boolean {
  return isEnabled();
}

// ─── Impact levels ──────────────────────────────────────────────────────────

/** Light: habit toggle, option select, suggestion accept, quest progress */
export function light(): void {
  if (!isEnabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Medium: phase advance, answer confirm, mode switch */
export function medium(): void {
  if (!isEnabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Heavy: achievement, quest complete, boss day, phase update */
export function heavy(): void {
  if (!isEnabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

// ─── Notification types ─────────────────────────────────────────────────────

/** Success: protocol complete, boss defeated, perfect day, titan unlock */
export function success(): void {
  if (!isEnabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Warning: streak at risk */
export function warning(): void {
  if (!isEnabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** Error: wrong answer */
export function error(): void {
  if (!isEnabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

// ─── Selection ──────────────────────────────────────────────────────────────

/** Selection change (tabs, pickers) */
export function selection(): void {
  if (!isEnabled()) return;
  Haptics.selectionAsync();
}

// ─── Compound patterns ──────────────────────────────────────────────────────

/** Celebration: heavy + success (with delay) */
export function celebration(): void {
  if (!isEnabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 300);
}

/** Titan unlock: triple haptic */
export function titanUnlock(): void {
  if (!isEnabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
  setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 400);
}

// ─── Legacy aliases (backward compat with existing code) ────────────────────

export const tapHaptic = light;
export const successHaptic = success;
export const impactHaptic = heavy;
export const celebrationHaptic = celebration;
