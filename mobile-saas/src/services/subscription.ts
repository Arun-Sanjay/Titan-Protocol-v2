/**
 * Subscription / entitlement read-layer (billing).
 *
 * The `subscriptions` table is populated by Razorpay's webhook
 * (`razorpay-webhook`) — the source of truth for renewals. This read side
 * is deliberately provider-agnostic. All the app needs to know is: does
 * this user currently hold an active, unexpired entitlement? Everything
 * downstream (feature gating, the paywall) keys off `deriveEntitlement`.
 *
 * Checkout runs through `lib/razorpay.ts`; the webhook that writes this
 * table is server-side. Clients have SELECT-only RLS on `subscriptions`.
 *
 * Grandfathered Classic customers are handled by seeding a row with
 * `status='active'` / `store='grandfathered'` server-side — no special
 * client logic, they simply read as Pro here.
 *
 * Mirrors web's `web/src/services/subscription.ts` — `deriveEntitlement`
 * is byte-for-byte the same logic.
 */
import { requireUserId } from "../lib/supabase";
import { sqliteGet } from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

export type Subscription = Tables<"subscriptions">;
export type Plan = "free" | "pro";

// Statuses that grant the entitlement, matching the `subscriptions.status`
// enum (active | none | trial | grace | expired | cancelled | refunded).
// Grandfathered Classic customers are seeded server-side as status='active'
// with store='grandfathered' — no separate status value is needed.
const ACTIVE_STATUSES = new Set(["active", "trial", "grace"]);

/** The 1-day free trial window. */
export const TRIAL_MS = 24 * 60 * 60 * 1000;

export type EntitlementSource = "subscription" | "trial" | null;

export type Entitlement = {
  plan: Plan;
  isPro: boolean;
  /** What grants access right now (for the UI to label it). */
  source: EntitlementSource;
  status: string | null;
  expiresAt: string | null;
  willRenew: boolean;
  store: string | null;
  /** ISO end of the free trial (whether or not it's still active). */
  trialEndsAt: string | null;
  trialActive: boolean;
};

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Pure: turn a subscription row + the profile's trial marker into the
 * user's entitlement. Pro if an active, unexpired subscription exists OR
 * the 1-day trial is still running. `nowMs` is injectable for tests.
 */
export function deriveEntitlement(
  sub: Subscription | null,
  trialStartedAt?: string | null,
  nowMs: number = Date.now(),
): Entitlement {
  const status = sub?.status ?? null;
  const expiresAt = sub?.expires_at ?? null;
  const expMs = parseMs(expiresAt);
  const subActive =
    Boolean(status && ACTIVE_STATUSES.has(status)) &&
    (expMs === null || expMs > nowMs);

  const trialStartMs = parseMs(trialStartedAt);
  const trialEndMs = trialStartMs === null ? null : trialStartMs + TRIAL_MS;
  const trialActive = trialEndMs !== null && nowMs < trialEndMs;
  const trialEndsAt = trialEndMs === null ? null : new Date(trialEndMs).toISOString();

  const isPro = subActive || trialActive;
  const source: EntitlementSource = subActive
    ? "subscription"
    : trialActive
      ? "trial"
      : null;

  return {
    plan: isPro ? "pro" : "free",
    isPro,
    source,
    status,
    expiresAt,
    willRenew: Boolean(sub?.will_renew),
    store: sub?.store ?? null,
    trialEndsAt,
    trialActive,
  };
}

export async function getSubscription(): Promise<Subscription | null> {
  const userId = await requireUserId();
  return sqliteGet<Subscription>("subscriptions", { user_id: userId });
}
