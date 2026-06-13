/**
 * Razorpay checkout (web) — recurring subscription.
 *
 * Loads the Razorpay script, creates a ₹300/month subscription via the
 * `razorpay-create-subscription` edge function (secret server-side), opens
 * the Razorpay modal with the subscription_id (card/UPI mandate), and on
 * success verifies the signature via `razorpay-verify`. From then on
 * Razorpay auto-charges monthly and `razorpay-webhook` keeps the
 * subscriptions row fresh. The new row also reaches this device over
 * Realtime; we invalidate the entitlement caches so the UI flips to Pro
 * immediately.
 */
import { supabase } from "./session";
import { queryClient } from "./query";
import { subscriptionKeys } from "../hooks/queries/useSubscription";
import { profileKeys } from "../hooks/queries/useProfile";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type SubscriptionResponse = {
  subscriptionId: string;
  shortUrl: string;
  keyId: string;
};

let scriptPromise: Promise<boolean> | null = null;

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Run the full recurring checkout. Resolves once the mandate is verified and
 * the entitlement caches are invalidated; rejects on failure or if the user
 * dismisses the modal (message "Payment cancelled.").
 */
export async function startRazorpayCheckout(): Promise<void> {
  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    throw new Error("Couldn't load Razorpay checkout — check your connection.");
  }

  const { data, error } = await supabase.functions.invoke(
    "razorpay-create-subscription",
    { body: {} },
  );
  const sub = (data ?? null) as SubscriptionResponse | null;
  if (error || !sub?.subscriptionId) {
    throw new Error(
      (error as { message?: string } | null)?.message ||
        "Couldn't start the subscription. Please try again.",
    );
  }

  await new Promise<void>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: sub.keyId,
      subscription_id: sub.subscriptionId,
      name: "Titan Protocol",
      description: "Pro membership — ₹300 / month",
      theme: { color: "#c9b99a" },
      handler: async (resp: {
        razorpay_payment_id: string;
        razorpay_subscription_id: string;
        razorpay_signature: string;
      }) => {
        try {
          const { error: vErr } = await supabase.functions.invoke(
            "razorpay-verify",
            {
              body: {
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_subscription_id: resp.razorpay_subscription_id,
                razorpay_signature: resp.razorpay_signature,
              },
            },
          );
          if (vErr) {
            throw new Error(
              (vErr as { message?: string }).message ||
                "Payment verification failed.",
            );
          }
          await queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
          await queryClient.invalidateQueries({ queryKey: profileKeys.all });
          resolve();
        } catch (e) {
          reject(
            e instanceof Error ? e : new Error("Payment verification failed."),
          );
        }
      },
      modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
    });
    rzp.open();
  });
}
