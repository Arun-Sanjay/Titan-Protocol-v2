/**
 * Phase 7.2: PostHog analytics taxonomy.
 *
 * Centralized event definitions so the rest of the app calls strongly-
 * typed wrapper functions instead of raw `posthog.capture("foo", ...)`.
 * Adding a new event means adding a function here, which keeps the
 * taxonomy reviewable in one place.
 *
 * Initialization happens in app/_layout.tsx via PostHogProvider. This
 * file just consumes the global instance via posthogClient — when no
 * EXPO_PUBLIC_POSTHOG_KEY is set, the wrapper functions are no-ops.
 *
 * Naming conventions:
 *   - Event names are snake_case past-tense (`task_completed`, not
 *     `complete_task`).
 *   - Property keys are snake_case.
 *   - Numeric properties are unprefixed; categorical properties get
 *     a suffix (`engine`, `kind`, `rarity`, `source`).
 */

import PostHog from "posthog-react-native";

// PostHog accepts a JSON-compatible property bag. We mirror that
// type so callers don't have to import from the SDK.
type AnalyticsValue =
  | string
  | number
  | boolean
  | null
  | AnalyticsValue[]
  | { [key: string]: AnalyticsValue };
type AnalyticsProps = { [key: string]: AnalyticsValue };

// Lazily-resolved PostHog client. The PostHogProvider in _layout.tsx
// initializes a singleton; we expose a getter so this module loads
// without depending on the provider being mounted at import time.
let _client: PostHog | null = null;

export function setPostHogClient(client: PostHog | null): void {
  _client = client;
}

export function getPostHogClient(): PostHog | null {
  return _client;
}

function capture(event: string, properties?: AnalyticsProps): void {
  try {
    _client?.capture(event, properties);
  } catch {
    // Analytics must never crash the app.
  }
}

// ─── User identity ──────────────────────────────────────────────────────────

export function identifyUser(userId: string, traits?: AnalyticsProps): void {
  try {
    _client?.identify(userId, traits);
  } catch {}
}

export function resetIdentity(): void {
  try {
    _client?.reset();
  } catch {}
}

// ─── App lifecycle ──────────────────────────────────────────────────────────

export function trackAppOpen(): void {
  capture("app_open");
}

export function trackAppForeground(): void {
  capture("app_foreground");
}

export function trackAppBackground(): void {
  capture("app_background");
}

// ─── Onboarding ─────────────────────────────────────────────────────────────

export function trackOnboardingStarted(): void {
  capture("onboarding_started");
}

export function trackOnboardingStepCompleted(step: string): void {
  capture("onboarding_step_completed", { step });
}

export function trackOnboardingFinished(props: { archetype: string }): void {
  capture("onboarding_finished", props);
}

// ─── Protocol session ───────────────────────────────────────────────────────

export function trackProtocolMorningStarted(): void {
  capture("protocol_morning_started");
}

export function trackProtocolMorningCompleted(props: { titan_score?: number }): void {
  capture("protocol_morning_completed", props);
}

export function trackProtocolEveningStarted(): void {
  capture("protocol_evening_started");
}

export function trackProtocolEveningCompleted(props: {
  titan_score?: number;
  identity_vote?: string | null;
}): void {
  capture("protocol_evening_completed", props);
}

// ─── Task / habit / progression ─────────────────────────────────────────────

export function trackTaskCompleted(props: { engine: string; kind: string }): void {
  capture("task_completed", props);
}

export function trackTaskCreated(props: { engine: string; kind: string }): void {
  capture("task_created", props);
}

export function trackHabitLogged(props: { engine: string }): void {
  capture("habit_logged", props);
}

export function trackHabitCreated(props: { engine: string }): void {
  capture("habit_created", props);
}

export function trackLevelUp(props: { from_level: number; to_level: number }): void {
  capture("level_up", props);
}

export function trackRankUp(props: { from_rank: string; to_rank: string }): void {
  capture("rank_up", props);
}

export function trackPhaseAdvanced(props: { from_phase: string; to_phase: string }): void {
  capture("phase_advanced", props);
}

// ─── Achievements / titles / quests / bosses ────────────────────────────────

export function trackAchievementUnlocked(props: { id: string; rarity: string }): void {
  capture("achievement_unlocked", props);
}

export function trackTitleUnlocked(props: { id: string }): void {
  capture("title_unlocked", props);
}

export function trackTitleEquipped(props: { id: string }): void {
  capture("title_equipped", props);
}

export function trackQuestCompleted(props: { type: string }): void {
  capture("quest_completed", props);
}

export function trackBossStarted(props: { id: string }): void {
  capture("boss_started", props);
}

export function trackBossCompleted(props: { id: string; days_taken: number }): void {
  capture("boss_completed", props);
}

export function trackBossFailed(props: { id: string }): void {
  capture("boss_failed", props);
}

// ─── Skill tree ─────────────────────────────────────────────────────────────

export function trackSkillNodeUnlocked(props: { engine: string; node_id: string }): void {
  capture("skill_node_unlocked", props);
}

export function trackSkillNodeClaimed(props: { engine: string; node_id: string }): void {
  capture("skill_node_claimed", props);
}

// ─── Hub usage ──────────────────────────────────────────────────────────────

export function trackHubScreenViewed(props: { screen: string }): void {
  capture("hub_screen_viewed", props);
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export function trackSignUp(props: { method: "email" | "magic_link" | "google" }): void {
  capture("sign_up", props);
}

export function trackSignIn(props: { method: "email" | "magic_link" | "google" }): void {
  capture("sign_in", props);
}

export function trackSignOut(): void {
  capture("sign_out");
}

// ─── Subscription (placeholder for v1.1) ────────────────────────────────────

export function trackPaywallShown(props: { trigger: string }): void {
  capture("paywall_shown", props);
}

export function trackSubscriptionStarted(props: {
  product_id: string;
  period: "monthly" | "yearly";
}): void {
  capture("subscription_started", props);
}

export function trackSubscriptionCancelled(props: { product_id: string }): void {
  capture("subscription_cancelled", props);
}
