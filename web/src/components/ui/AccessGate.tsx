import * as React from "react";

import {
  subscribePaywall,
  isPaywallOpen,
  closePaywall,
} from "@/lib/paywall";
import { useEntitlement } from "@/hooks/queries/useSubscription";
import { useUpdateProfile } from "@/hooks/queries/useProfile";
import { startRazorpayCheckout } from "@/lib/razorpay";
import { toast } from "@/lib/toast";

/**
 * The trial / paywall modal. Mounted once in OSLayout.
 *
 * - Brand-new user (never started a trial, not subscribed): auto-invites
 *   the 1-day free trial on entry.
 * - Trial expired (no subscription): opened by the paywall bus when a gated
 *   action (completing a task) is attempted — ₹300/month subscribe prompt.
 * - Pro (trial active or subscribed): renders nothing.
 */
export function AccessGate() {
  const ent = useEntitlement();
  const updateProfile = useUpdateProfile();
  const [busOpen, setBusOpen] = React.useState(isPaywallOpen());
  const [dismissed, setDismissed] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "trial" | "pay">(null);

  React.useEffect(() => subscribePaywall(setBusOpen), []);

  const neverStartedTrial = ent.trialEndsAt === null;
  // Invite a brand-new user (no trial yet, not Pro) on entry, once.
  const inviteOnEntry = !ent.isPro && neverStartedTrial && !dismissed;
  const open = !ent.isPro && (busOpen || inviteOnEntry);

  if (!open) return null;

  async function handleStartTrial() {
    setBusy("trial");
    try {
      await updateProfile.mutateAsync({
        trial_started_at: new Date().toISOString(),
      });
      closePaywall();
      setDismissed(true);
      toast.success("Free trial started — everything's unlocked for 24 hours.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't start the trial — try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleSubscribe() {
    setBusy("pay");
    try {
      await startRazorpayCheckout();
      closePaywall();
      setDismissed(true);
      toast.success("You're Pro — thanks for subscribing!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Payment failed.";
      if (msg !== "Payment cancelled.") toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  function handleClose() {
    closePaywall();
    setDismissed(true);
  }

  const busyAny = busy !== null;

  return (
    <div role="dialog" aria-modal="true" style={OVERLAY}>
      <div style={CARD}>
        <button
          type="button"
          aria-label="Close"
          onClick={handleClose}
          disabled={busyAny}
          style={CLOSE_BTN}
        >
          ✕
        </button>

        <p className="tp-kicker" style={{ color: "#c9b99a" }}>
          {neverStartedTrial ? "Welcome to Titan Protocol" : "Trial ended"}
        </p>
        <h2 style={TITLE}>
          {neverStartedTrial
            ? "Start your free trial"
            : "Subscribe to keep going"}
        </h2>
        <p style={BODY}>
          {neverStartedTrial
            ? "Get the entire system — every engine, habit, journal and tracker — free for 24 hours. No card required."
            : "Your 1-day free trial has ended. Unlock everything again for ₹300/month."}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
          {neverStartedTrial && (
            <button
              type="button"
              className="tp-button"
              onClick={handleStartTrial}
              disabled={busyAny}
              style={{ width: "100%" }}
            >
              {busy === "trial" ? "Starting…" : "Start 1-day free trial"}
            </button>
          )}
          <button
            type="button"
            className={neverStartedTrial ? "tp-button tp-button-inline" : "tp-button"}
            onClick={handleSubscribe}
            disabled={busyAny}
            style={{ width: "100%" }}
          >
            {busy === "pay" ? "Opening checkout…" : "Subscribe · ₹300/month"}
          </button>
        </div>

        <p style={FINE_PRINT}>
          Secure payment by Razorpay · cancel anytime
        </p>
      </div>
    </div>
  );
}

const OVERLAY: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "rgba(0,0,0,0.78)",
  backdropFilter: "blur(8px)",
};

const CARD: React.CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 420,
  padding: 28,
  borderRadius: 16,
  border: "1px solid rgba(201,185,154,0.35)",
  background: "var(--panel, #0f0f0f)",
  boxShadow: "0 24px 60px -20px rgba(201,185,154,0.35)",
};

const CLOSE_BTN: React.CSSProperties = {
  position: "absolute",
  top: 14,
  right: 16,
  background: "transparent",
  border: "none",
  color: "var(--muted, #808080)",
  fontSize: 16,
  cursor: "pointer",
  lineHeight: 1,
};

const TITLE: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "var(--text, #f5f8ff)",
  margin: "6px 0 10px",
};

const BODY: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.55,
  color: "var(--muted, #aab)",
  margin: 0,
};

const FINE_PRINT: React.CSSProperties = {
  fontSize: 11,
  color: "var(--muted, #808080)",
  textAlign: "center",
  marginTop: 14,
};
