# M6 Submission Checklist — Mobile SaaS

> The work-in-progress launch checklist. Code-side prep (eas.json, copy, privacy disclosures, customer emails, screenshots spec, README) is ✅. Everything below is **on you** — Apple/Google account work, builds, store submissions, customer outreach.
>
> Work top-to-bottom; some steps gate others.

---

## 0. Prerequisites (one-time setup, account-level)

- [ ] **Apple Developer Program** enrollment ($99/yr) — https://developer.apple.com/programs/enroll/
  - Required for: App Store submission, Sign in with Apple (post-launch), push certificate
  - Lead time: same day to enroll; verification can take 1-3 days for new accounts
- [ ] **Google Play Developer** account ($25 one-time) — https://play.google.com/console/signup
  - Required for: Play Store submission, internal testing
  - Lead time: same day; identity verification may take 24-48h
- [ ] **EAS account** — `npx eas login` (free; uses your Expo account)
- [ ] **`titanprotocol.com` domain** (or whatever you choose) — registered + DNS pointed at Vercel (P0 deliverable)
- [ ] **Privacy policy** accessible at `https://titanprotocol.com/privacy` — content already exists in `web/` marketing; needs Vercel deploy
- [ ] **Support page** accessible at `https://titanprotocol.com/support` — even a placeholder is fine

---

## 1. Bundle ID migration (coordinated with Classic)

The new SaaS app needs `com.titan.protocol`, which Classic currently holds. The swap:

- [ ] Classic (`mobile/`): edit `app.json` → `ios.bundleIdentifier` + `android.package` to `com.titan.protocol.classic`
- [ ] Classic: `cd mobile && eas build --platform all --profile production && eas submit --platform all`
- [ ] Wait for Classic's rename to ride through both stores (Apple 1-2 days; Google ~hours for internal track)
- [ ] mobile-saas: edit `app.json` → `ios.bundleIdentifier` + `android.package` to `com.titan.protocol`
- [ ] mobile-saas: `app.json` `extra.eas.projectId` filled by `eas init`
- [ ] mobile-saas: `app.json` `owner` set to your EAS account/org slug

**The Classic rename is irreversible.** Don't ship it until you're committed to the SaaS launch.

---

## 2. EAS setup

- [ ] `cd mobile-saas && eas init` (creates an EAS project + writes projectId into app.json)
- [ ] Update `app.json` `extra.eas.projectId` and `owner` if `eas init` doesn't write them
- [ ] `eas credentials` — let EAS generate iOS provisioning + Android keystore
- [ ] **Back up the Android keystore IMMEDIATELY.** `eas credentials` → manage Android → download → encrypt → store in 2 separate locations. Losing this means no future updates.
- [ ] Update `eas.json` `submit.production.ios` block with your real Apple ID, ASC App ID (after creating the App Store Connect listing), and Apple Team ID
- [ ] Update `eas.json` `submit.production.android` `serviceAccountKeyPath` after generating a Google service account key (Play Console → Setup → API access)

---

## 3. App Store Connect (Apple)

- [ ] Create new app: **My Apps → + → New App**
  - Platform: iOS
  - Name: `Titan Protocol`
  - Primary language: English (U.S.)
  - Bundle ID: `com.titan.protocol`
  - SKU: `titan-protocol-saas-2026`
  - User access: Full access
- [ ] Fill **App Information**:
  - Category: Productivity (primary), Lifestyle (secondary)
  - Content rights: own all content
- [ ] Fill **Pricing and Availability**: Free, all territories
- [ ] Create a **review-only account** with seed data:
  - Email: `apple-review+titan@<your-domain>` (or similar)
  - Pre-populated with realistic tasks, habits, a few journal entries
  - Document the credentials in App Store Connect → App Review Information
- [ ] Fill **Privacy Nutrition Labels** (use `store-assets/privacy-disclosures.md`)
- [ ] Fill **Version Information** for v0.1.0:
  - What's New (first release: leave blank or copy from copy.md)
  - Description, keywords, support URL, marketing URL, privacy policy URL (from copy.md)
  - Screenshots (8 from `store-assets/screenshots/ios/`)
- [ ] **Sign in with Apple decision:**
  - Current code: Google button is suppressed on iOS via `Platform.OS !== "ios"` guard so review can't reject for "Google without Apple"
  - If you eventually want Google on iOS, also add Sign in with Apple via `expo-apple-authentication`
- [ ] Submit for review

---

## 4. Play Console (Google)

- [ ] Create new app: **All apps → Create app**
  - Name: `Titan Protocol`
  - Default language: English (United States)
  - App or game: App
  - Free or paid: Free
  - Agreements: confirm
- [ ] Fill **Store listing** (use `store-assets/copy.md` Play Store section)
- [ ] Upload feature graphic (1024×500) — see `store-assets/screenshot-spec.md`
- [ ] Upload 8 screenshots
- [ ] Fill **Data Safety** (use `store-assets/privacy-disclosures.md` Google section)
- [ ] Complete **Content rating** questionnaire (all "No" → Everyone)
- [ ] Set **Target audience and content**: 13+
- [ ] Add **App access** instructions if testers need a demo account
- [ ] Add the privacy policy URL
- [ ] Add the support email (`titanprotocol.os@gmail.com`)
- [ ] **Internal testing** track:
  - Create release → upload `.aab` (from `eas build --platform android --profile production`)
  - Add testers by email
  - Promote to **Production** after smoke test

---

## 5. Production builds

- [ ] `cd mobile-saas && eas build --platform ios --profile production`
- [ ] `eas build --platform android --profile production`
- [ ] Builds finish in ~15-20min each. Download links land in EAS dashboard.

---

## 6. Beta sanity smoke

Before promoting to public production, install on at least 1 real device per platform and verify:

- [ ] **TestFlight (iOS):** install via TestFlight app → sign in → first-run pull restores cloud data → cold start <1s
- [ ] **Play Internal Testing (Android):** install via Play link → same flow as iOS
- [ ] **Daily loop:** create a task → complete it → see the score update → open web on a separate device → confirm the change appears within ~2s
- [ ] **Onboarding:** sign up a fresh account → skip-all onboarding → land on Dashboard
- [ ] **Onboarding:** sign up a fresh account → pick an archetype → land on Dashboard with archetype set
- [ ] **Push:** Settings → enable push → invoke `https://rmvodrpgaffxeultskst.supabase.co/functions/v1/send-push` with your user_id → confirm push lands ≤5s
- [ ] **Sign out → sign in different account:** confirm SQLite wipe happened (Dashboard shows the new account's data, not the old account's)
- [ ] **Long task list:** create 50+ tasks → scroll on Track tab → no dropped frames
- [ ] **Airplane mode:** turn on, reopen app → reads work (cache fallback)
- [ ] **Daily streak warning cron:** at 14:30 UTC (8pm IST) — wait until next 8pm IST or manually invoke `SELECT public.streak_warning_push();` via MCP → confirm push lands on a device with non-zero streak + protocol not done today

If any of these fail, **don't** promote to production. Fix first, build again, re-test.

---

## 7. Submit for public review

- [ ] Apple: tap **Submit for Review** in App Store Connect → expect 1-3 days
- [ ] Google: in Play Console, **Production** → promote your internal testing release → expect ~hours to ~3 days
- [ ] Watch for rejection emails; the most common reasons are documented in `mobile-saas-docs/06-ship.md` § Common rejection reasons

---

## 8. Day-of-launch

- [ ] Both store URLs returning the public listing
- [ ] Send launch email (`store-assets/classic-customer-emails.md` Email 2) with the actual store URLs swapped in
- [ ] Monitor Sentry (if wired) for the first 24h of installs
- [ ] Monitor support email
- [ ] Monitor advisor / Supabase metrics for unusual load

---

## 9. After approval

- [ ] Add the App Store + Play Store URLs to web's marketing site (`web/src/app/(marketing)/LandingPage.tsx` → "Download" CTAs)
- [ ] Tweet / Product Hunt / HN posts (P6 launch — separate phase)
- [ ] Tag the mobile-saas repo: `git tag v0.1.0` and push

---

## Status of in-repo prep (already done)

| Artifact | Path | Status |
|---|---|---|
| EAS build profiles | `eas.json` | ✅ written |
| App config | `app.json` | ✅ runtimeVersion + ITSAppUsesNonExemptEncryption + buildNumber/versionCode set; bundle ID still `com.titan.protocol.saas` placeholder pending Classic rename |
| Marketing copy | `store-assets/copy.md` | ✅ App Store + Play Store full set |
| Privacy disclosures | `store-assets/privacy-disclosures.md` | ✅ Apple Nutrition Labels + Google Data Safety filled per actual data flow |
| Screenshot spec | `store-assets/screenshot-spec.md` | ✅ 8-shot story sequence + state requirements |
| Customer emails | `store-assets/classic-customer-emails.md` | ✅ T-2 weeks + T-0 drafts |
| iOS Google guard | `app/(auth)/login.tsx` | ✅ `Platform.OS !== "ios"` prevents Apple review rejection |
| Send-push Edge Function | `supabase/functions/send-push/` | ✅ deployed (M5) |
| Streak cron | (Supabase) | ✅ `daily-streak-warning` at 14:30 UTC, active |
| Tests | jest | ✅ 11 suites / 70 tests pass |
| tsc | `npx tsc --noEmit` | ✅ clean |

---

## Status of user-action items (still on you)

| Item | Owner | Required for |
|---|---|---|
| Apple Developer Program enrollment | You | App Store submission |
| Google Play Developer account | You | Play Store submission |
| Domain registration (`titanprotocol.com` or chosen) | You | Privacy policy URL, support URL |
| Vercel deploy of `web/` marketing site | You | Privacy policy URL resolves |
| `eas init` + `eas credentials` | You | Build + submit |
| Bundle ID rename of Classic (`mobile/app.json` + new build + submit) | You | Frees `com.titan.protocol` for SaaS |
| Bundle ID swap for mobile-saas (`app.json`) | You | After Classic rename approved |
| Demo account creation for Apple review | You | Apple review |
| 8 screenshots × 2 platforms | You | Both store listings |
| Feature graphic for Play Store | You | Play submission |
| Send T-2 weeks email | You | Customer warm-up |
| Run beta smoke tests | You | Quality gate |
| Send T-0 email | You | Launch coverage |

---

## Reference: useful one-liners

```bash
# Login to EAS
eas login

# One-time: init project + generate credentials
eas init
eas credentials

# Production builds
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit
eas submit --platform ios --profile production
eas submit --platform android --profile production

# Local dev build on Android device (for screenshots + smoke)
npx expo run:android --device

# Type + test gate
npx tsc --noEmit && npm test

# Verify daily streak cron fired
mcp__claude_ai_Supabase__execute_sql --query \
  "SELECT runid, status, return_message, start_time
   FROM cron.job_run_details
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname='daily-streak-warning')
   ORDER BY start_time DESC LIMIT 5;"
```
