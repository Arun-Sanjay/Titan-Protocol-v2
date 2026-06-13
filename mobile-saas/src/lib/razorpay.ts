/**
 * Razorpay checkout (mobile) — recurring subscription.
 *
 * Web opens the Razorpay JS modal inline; on native there is no such SDK,
 * so we use Razorpay's hosted checkout page instead:
 *
 *   1. `razorpay-create-subscription` (edge fn, secret server-side) mints a
 *      ₹300/month subscription and returns `{ subscriptionId, shortUrl, keyId }`.
 *   2. We open `shortUrl` in an in-app browser (`expo-web-browser`). The
 *      user authorises the card/UPI mandate on Razorpay's hosted page.
 *   3. When the browser closes, the mandate auth has already happened on
 *      Razorpay's side and `razorpay-webhook` grants Pro server-side (it is
 *      the source of truth for the subscription lifecycle — no client-side
 *      `razorpay-verify` round-trip is needed for the hosted flow).
 *   4. We force a catch-up resync (pull the new `subscriptions` row into
 *      SQLite) and invalidate the entitlement caches so the UI flips to Pro
 *      as soon as the webhook has landed. The row also reaches this device
 *      over Realtime.
 *
 * Mirrors web's `web/src/lib/razorpay.ts` intent; the checkout surface
 * differs (hosted page vs JS modal) per platform.
 */
import * as WebBrowser from "expo-web-browser";

import { supabase } from "./supabase";
import { queryClient } from "./query-client";
import { catchUpResync } from "../sync/resync";
import { subscriptionKeys } from "../hooks/queries/useSubscription";
import { profileQueryKey } from "../hooks/queries/useProfile";

type SubscriptionResponse = {
  subscriptionId: string;
  shortUrl: string;
  keyId: string;
};

/**
 * Run the full recurring checkout. Resolves once the hosted checkout page
 * has closed and the entitlement caches have been refreshed; rejects if the
 * subscription couldn't be created or the page couldn't be opened.
 *
 * Note: because the webhook is the source of truth and may land a beat
 * after the browser closes, the entitlement may not read Pro the instant
 * this resolves — the forced resync + invalidation + Realtime converge it.
 */
export async function startRazorpayCheckout(): Promise<void> {
  const { data, error } = await supabase.functions.invoke(
    "razorpay-create-subscription",
    { body: {} },
  );
  const sub = (data ?? null) as SubscriptionResponse | null;
  if (error || !sub?.shortUrl) {
    throw new Error(
      (error as { message?: string } | null)?.message ||
        "Couldn't start the subscription. Please try again.",
    );
  }

  // Open Razorpay's hosted checkout. `openBrowserAsync` resolves when the
  // in-app browser is dismissed (the user finished or backed out).
  await WebBrowser.openBrowserAsync(sub.shortUrl);

  // The mandate auth + Pro grant happened server-side (webhook). Pull the
  // new subscription row down and refresh the entitlement caches.
  await catchUpResync(queryClient, { force: true });
  await queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
  await queryClient.invalidateQueries({ queryKey: profileQueryKey });
}
