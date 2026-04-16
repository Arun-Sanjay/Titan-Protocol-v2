/**
 * MMKV key constants for device-local preferences.
 *
 * These are ONLY for data that stays on the device (UI prefs, flags).
 * User data goes through Supabase — see CLAUDE.md Golden Rule #1.
 */
export const K = {
  // ─── User profile (legacy fallback) ─────────────────────────────────
  userProfile: "user_profile",

  // ─── Device preferences ─────────────────────────────────────────────
  soundEnabled: "pref_sound_enabled",
  voiceEnabled: "pref_voice_enabled",
  hapticsEnabled: "pref_haptics_enabled",
  themeMode: "pref_theme_mode",

  // ─── UI mode ──────────────���─────────────────────────────────────────
  appMode: "app_mode",
  titanMode: "titan_mode_active",

  // ─── Dev flags ──────────────────────────────────────────────────────
  devDayOffset: "dev_day_offset",
  devBypassOnboarding: "dev_bypass_onboarding",

  // ─── Story/cinematic flags ──��───────────────────────────────────────
  cinematicPlayed: "cinematic_played",
  storyDay: "story_current_day",

  // ─── Onboarding ─────────────────────────────────────────────────────
  onboardingCompleted: "onboarding_completed",

  // ─── Focus timer ────────────────────────────────────────────────────
  focusSettings: "focus_settings",
} as const;
