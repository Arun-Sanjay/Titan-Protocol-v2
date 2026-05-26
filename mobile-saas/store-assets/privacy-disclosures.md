# Privacy Disclosures — Mobile SaaS

> The honest answers to fill into Apple App Privacy + Google Data Safety. Drafted to match what the code actually collects at v1 launch (M5-complete). Re-audit if Stripe (P5) or any new SDK changes the data flow.

---

## What the app actually collects

Source of truth: the codebase.

| Data | Collected? | Where | Purpose |
|---|---|---|---|
| **Email** | Yes | `auth.users` (Supabase Auth) + `profiles.email` | Sign-in identity |
| **User content — tasks, habits, journal, goals, deep-work sessions, focus sessions, weight, sleep, nutrition logs, money txns, achievements, etc.** | Yes | Supabase `public.*` tables | The user's own gamified-OS data, RLS-scoped to their auth.uid() |
| **User ID** (Supabase auth.uid()) | Yes | Every user row | Per-user segregation |
| **Push notification token** (Expo) | Yes | `profiles.expo_push_token` | Server-side push (streak warnings) |
| **Crash diagnostics** | Conditional | Sentry (only when `SENTRY_DSN` env var is set) | Crash + error reports |
| **Product analytics** | Conditional | PostHog (only when `EXPO_PUBLIC_POSTHOG_KEY` is set) | Anonymised event taxonomy: `task_completed`, etc. |
| **Device prefs** (theme, sound, onboarding flags) | Local-only | MMKV on the device | Not synced anywhere |
| **HealthKit / Google Fit** | No | — | Body engine has workouts but we read user-typed values; no OS health integrations |
| **Location** | No | — | — |
| **Contacts** | No | — | — |
| **Camera / photos / mic** | No | — | — |
| **Purchases** | No (yet) | Stripe will collect this once P5 ships | — |
| **Advertising identifiers** | No | — | Zero IDFA / GAID usage |

**Third-party processors:** Supabase (database + auth + push relay), Expo Push (notification fanout), Sentry (crash — optional), PostHog (analytics — optional).

---

## Apple — Privacy Nutrition Labels

Path: **App Store Connect → My Apps → Titan Protocol → App Privacy**.

For each data type below, the label is `Yes (Collected) / Linked to Identity / Not Used for Tracking` unless noted.

### Contact Info

| Subtype | Collected? | Linked? | Tracking? | Reason |
|---|---|---|---|---|
| Email Address | Yes | Yes | No | Sign-in / sign-up |
| Name | Yes (optional — `profiles.display_name`) | Yes | No | Shown in the user's own profile |
| Phone Number | No | — | — | — |
| Physical Address | No | — | — | — |

### User Content

| Subtype | Collected? | Linked? | Tracking? | Reason |
|---|---|---|---|---|
| Other User Content | Yes | Yes | No | Tasks, habits, journal entries, goals, fitness/nutrition/money logs, achievements. The user's own data. |
| Photos or Videos | No | — | — | — |
| Audio Data | No | — | — | — |
| Customer Support | No | — | — | (M6 may add a support form; if it does, update this) |

### Identifiers

| Subtype | Collected? | Linked? | Tracking? | Reason |
|---|---|---|---|---|
| User ID | Yes | Yes | No | Supabase `auth.uid()` — segregates the user's rows |
| Device ID | No | — | — | We don't read IDFA/GAID |

### Diagnostics

| Subtype | Collected? | Linked? | Tracking? | Reason |
|---|---|---|---|---|
| Crash Data | If Sentry wired | Yes | No | Bug triage; off by default until DSN set |
| Performance Data | If Sentry wired | Yes | No | Same |
| Other Diagnostic Data | No | — | — | — |

### Usage Data

| Subtype | Collected? | Linked? | Tracking? | Reason |
|---|---|---|---|---|
| Product Interaction | If PostHog wired | Yes | No | Event taxonomy in `src/lib/analytics.ts` |
| Advertising Data | No | — | — | — |
| Other Usage Data | No | — | — | — |

### Sensitive Info — Health & Fitness, Location, Financial, Sensitive Personal Info

All **No**. We don't read HealthKit / Google Fit / location services / payment info (P5 will when Stripe ships).

### Do Not Track

**Not enabled.** The app does not use third-party advertising or tracking SDKs.

---

## Google — Data Safety

Path: **Play Console → Titan Protocol → Policy → App content → Data safety**.

### Data collection and security

- **Does your app collect or share any of the required user data types?** **Yes**.
- **Is all of the user data collected by your app encrypted in transit?** **Yes** (TLS via Supabase + Expo Push).
- **Do you provide a way for users to request that their data be deleted?** **Yes** (Settings → dev tools → cascade delete is in-product; account deletion via `services/account.ts` calls a Supabase RPC that cascades).

### Data types collected

For each row, the Play Console asks: *collected?*, *shared with third parties?*, *purpose*, *required or optional?*

| Data category | Type | Collected | Shared | Purposes | Required/Optional |
|---|---|---|---|---|---|
| **Personal info** | Email address | Yes | Yes (Supabase) | Account management | Required (sign-in) |
| Personal info | Name | Yes | Yes (Supabase) | App functionality | Optional |
| Personal info | User IDs | Yes | Yes (Supabase) | Account management | Required |
| **Health and fitness** | Health info | Yes | Yes (Supabase) | App functionality | Optional (only if user enters body data) |
| Health and fitness | Fitness info | Yes | Yes (Supabase) | App functionality | Optional |
| **App activity** | App interactions | If PostHog wired | Yes (PostHog) | Analytics | Optional |
| **App info & performance** | Crash logs | If Sentry wired | Yes (Sentry) | App functionality, Analytics | Optional |
| App info & performance | Diagnostics | If Sentry wired | Yes (Sentry) | App functionality | Optional |
| **Financial info** | Financial transactions | Yes (the user's own logged transactions — not payment processing) | Yes (Supabase) | App functionality | Optional |
| **Other** | Other user-generated content (journal, goals) | Yes | Yes (Supabase) | App functionality | Optional |

**Not collected:** Location, contacts, messages, photos/videos, audio, calendar, files & docs, sensitive personal info, advertising/marketing IDs.

### Data shared list (third parties)

For each data type marked "Shared":

- **Supabase** (https://supabase.com/legal/privacy) — Database, authentication, push relay. Hosted in `ap-south-1`.
- **Expo Push** (https://expo.dev/privacy) — Push notification fanout. Receives Expo push token + notification payload; doesn't persist user data.
- **Sentry** (only if wired; https://sentry.io/privacy/) — Crash and error reports. Stores stack traces + device metadata, scoped per-user when the user is identified.
- **PostHog** (only if wired; https://posthog.com/privacy) — Product analytics events.

### Encryption claims

- **In transit:** TLS 1.2+ via HTTPS / WSS to all third parties listed.
- **At rest:** Supabase encrypts at rest by default (provider-managed).

### Data deletion

User-initiated deletion path:
1. In-app: Settings → (5-tap on version row to reveal dev tools) → Account deletion lands as P5 polish; for v1, users email `titanprotocol.os@gmail.com` and we cascade-delete via `services/account.ts`'s server RPC.
2. Out-of-app: GDPR-style requests via email; we cascade via service-role.

> **TODO (user):** Once the marketing site is live, add a public-facing "Delete my account" form / button or a clear email-based path to the privacy policy.

---

## Content rating

- **Apple:** Age rating questionnaire → all "No" → **4+**.
- **Google:** IARC questionnaire → all "No" → **Everyone**.

---

## Periodic re-audit triggers

Update this file whenever:
- A new third-party SDK is added (e.g., Stripe in P5)
- A new column collects new user data (e.g., HealthKit integration)
- The policy language changes (per Apple / Google linter)
- An advisor warning surfaces a new data collection path
