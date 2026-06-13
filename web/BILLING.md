# Billing — Razorpay (P5)

Titan Protocol SaaS monetization: **1-day free trial → ₹300/month**, paid via
Razorpay. Same Razorpay account as the old landing page (`new titan landing copy`).

## The model

1. **New user** — on first entry the `AccessGate` modal invites a **1-day free
   trial** (full access, no card). Starting it sets `profiles.trial_started_at`.
2. **During the trial (24h)** — everything is unlocked; entitlement reads as Pro.
3. **Trial expired, not subscribed** — the app is still browsable, but the first
   *gated action* (completing a task — the checkmark) throws `PaywallError`,
   which opens the **₹300/month** subscribe modal. The task stays uncompleted
   until they subscribe.
4. **Subscribed** — checkout creates a **recurring** Razorpay subscription;
   `razorpay-verify` confirms the mandate (Pro, `will_renew=true`). Razorpay
   then auto-charges ₹300 monthly and `razorpay-webhook` keeps the row active
   (and flips it to grace/cancelled/expired on failed-payment/cancel/end).

Entitlement = active/trial/grace **subscription** (unexpired) **OR** an active
24h **trial**. Pure logic in `src/services/subscription.ts::deriveEntitlement`
(unit-tested). Gating is centralized: `useToggleCompletion` throws `PaywallError`
when `!isPro`; the global `MutationCache` routes it to `openPaywall()`.

## Pieces

| Piece | Where |
|---|---|
| Entitlement logic | `src/services/subscription.ts` (+ `hooks/queries/useSubscription.ts`) |
| Trial / paywall modal | `src/components/ui/AccessGate.tsx` (mounted in `OSLayout`) |
| Paywall bus + error | `src/lib/paywall.ts` |
| Checkout client | `src/lib/razorpay.ts` |
| Completion gate | `src/hooks/queries/useTasks.ts` (`useToggleCompletion`) |
| Plan surface | Settings → "Plan" |
| Subscription edge fn | Supabase `razorpay-create-subscription` (recurring ₹300/mo, plan `plan_T1E0b6Qdok29Nu`) |
| Verify edge function | Supabase `razorpay-verify` (HMAC check → writes `subscriptions` via service role; handles subscription + one-time) |
| Webhook edge fn | Supabase `razorpay-webhook` (`subscription.charged`/`cancelled`/`halted`/… → `subscriptions`; `verify_jwt=false`, signature-authed) |
| Order edge function | Supabase `razorpay-create-order` (legacy one-time ₹300 order; kept for fallback) |

Security: `subscriptions` has **no client INSERT/UPDATE RLS** — only the
service-role edge function (post-signature-verification) can grant Pro. Clients
can only SELECT their own row.

## ⚠️ Required user action — set the edge-function secrets

The edge functions are deployed but return **500** until these are set (there is
no MCP tool for secrets; run the CLI once):

```bash
supabase secrets set \
  RAZORPAY_KEY_ID=<RAZORPAY_KEY_ID> \
  RAZORPAY_KEY_SECRET=<RAZORPAY_KEY_SECRET> \
  --project-ref rmvodrpgaffxeultskst
```

> These are the **live** keys from `new titan landing copy/.env.local`. For
> testing without real charges, use a `rzp_test_*` key pair instead.

Once set, checkout works (`razorpay-create-subscription` returns a subscription
and the Razorpay modal opens).

### Webhook (required for recurring renewals)

1. Razorpay Dashboard → Settings → Webhooks → add:
   `https://rmvodrpgaffxeultskst.supabase.co/functions/v1/razorpay-webhook`
   with events `subscription.charged`, `subscription.activated`,
   `subscription.pending`, `subscription.halted`, `subscription.cancelled`,
   `subscription.completed`, and a webhook secret.
2. Set that secret on the function:

```bash
supabase secrets set RAZORPAY_WEBHOOK_SECRET=<dashboard-webhook-secret> \
  --project-ref rmvodrpgaffxeultskst
```

The ₹300/month plan already exists: `plan_T1E0b6Qdok29Nu` (override via the
`RAZORPAY_PLAN_ID` secret if you make a new one).

## Grandfathering (Classic customers)

Seed a row server-side: `status='active'`, `store='grandfathered'`, far-future
`expires_at`. No client change — they read as Pro.

## Follow-ups

- **Recurring auto-charge** — ✅ built (Razorpay Subscriptions + plan
  `plan_T1E0b6Qdok29Nu` + `razorpay-webhook`). Needs the webhook secret +
  dashboard config above to renew in production.
- **Cancel-from-app** — a "Cancel subscription" button calling a
  `razorpay-cancel-subscription` edge function (Razorpay
  `POST /subscriptions/:id/cancel`) would let users self-cancel; today the
  webhook handles cancellations initiated from Razorpay.
- **Mobile** — `mobile-saas` shares the schema + entitlement; checkout opens the
  subscription `short_url` in an in-app browser (no native SDK needed).
