# Titan Protocol v1 — launch hand-off

This document is the user-side checklist for everything that needs to
happen *outside* the codebase to get v1 live on the Play Store internal
testing track. The codebase work (Phases 0-8) is done; what's below is
strictly things only you can do because they require accounts, secrets,
or external services.

---

## TL;DR — minimum viable launch

| # | Task | Required to ship? | Time |
|---|---|---|---|
| 1 | Populate `.env` with Supabase URL + anon key | **Yes** | 1 min |
| 2 | Enable Supabase Auth leaked-password protection | **Yes** | 30 sec |
| 3 | Create Sentry org + project, paste DSN into `.env` | **Yes** (Play Store wants crash visibility) | 10 min |
| 4 | Create PostHog account, paste key into `.env` | Recommended | 10 min |
| 5 | Privacy policy + Terms of service URLs | **Yes** (Play Store requirement) | varies |
| 6 | Play Console service account JSON | **Yes** (for `eas submit`) | 15 min |
| 7 | Run `eas build --profile production --platform android` | **Yes** | 15 min build time |
| 8 | Run `eas submit --profile production --platform android` | **Yes** | 5 min |
| 9 | Fill out Play Console store listing + content rating | **Yes** | 60-90 min |
| 10 | Google OAuth credentials (optional v1, see docs/google-oauth-setup.md) | Optional | 20 min |

Total user effort: **2-4 hours**, mostly in Play Console form-filling.

---

## 1. Populate `.env`

The repo's `.env` already contains the live Supabase URL and anon key
from the prior session. Verify it's still there:

```bash
cat .env
```

You should see:

```
EXPO_PUBLIC_SUPABASE_URL=https://rmvodrpgaffxeultskst.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_Vuwd5-jaCnOWpbY3FP0D7w_3ZoVMMNX
```

If not, copy `.env.example` to `.env` and the publishable values are
ready to use as-is.

---

## 2. Enable Supabase Auth leaked-password protection

The Supabase advisor flagged this as the only remaining security
warning. It's a one-click toggle:

1. Open <https://supabase.com/dashboard/project/rmvodrpgaffxeultskst>
2. Authentication → Providers → Email
3. Toggle **Leaked password protection** to ON
4. Save

This makes Supabase check new passwords against HaveIBeenPwned.org
before allowing them.

---

## 3. Sentry crash reporting

Code is wired in Phase 7.1. You need to:

1. Sign up at <https://sentry.io/signup/> (free tier is fine for v1)
2. Create a new project: type **React Native**, name **titan-protocol**
3. Copy the DSN from *Settings → Projects → titan-protocol → Client Keys (DSN)*
4. Add to `.env`:
   ```
   EXPO_PUBLIC_SENTRY_DSN=https://<your-key>@<region>.ingest.sentry.io/<project-id>
   ```
5. (Optional, for source maps): create an auth token at
   *Settings → Account → API → Auth Tokens* with `project:releases`
   and `org:read` scopes, then add to `.env`:
   ```
   SENTRY_AUTH_TOKEN=<token>
   SENTRY_ORG=<your-org-slug>
   SENTRY_PROJECT=titan-protocol
   ```

The next EAS build will automatically upload source maps via the
`@sentry/react-native` expo plugin (which is already in `app.json`).

**Verify it works**: after the first signed build, trigger a crash from
a `__DEV__`-only button or call `Sentry.nativeCrash()` somewhere
temporary. Within ~30 seconds it should appear in your Sentry dashboard.

---

## 4. PostHog analytics

Code is wired in Phase 7.2. You need to:

1. Sign up at <https://posthog.com/signup> (free tier is generous)
2. Create a new project named **titan-protocol-mobile**
3. Copy the project API key from *Project settings → Project API key*
4. Add to `.env`:
   ```
   EXPO_PUBLIC_POSTHOG_KEY=phc_<your-key>
   EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com
   ```
   (Use `https://eu.posthog.com` if you signed up on the EU region.)

The taxonomy is in `src/lib/analytics.ts` — ~30 events covering app
lifecycle, onboarding, protocol sessions, task/habit completion, level-
ups, achievements, titles, quests, bosses, skill nodes, and auth.

**Verify it works**: after the first signed build, open the app and
within ~10 seconds you should see `app_open` in PostHog Live Events.

---

## 5. Privacy policy + Terms of service

Play Store **requires** a privacy policy URL for any app that collects
user data. Titan Protocol collects:

- Email + password (Supabase Auth)
- All in-app data (tasks, habits, sessions, etc.) stored in Supabase
- Crash data via Sentry (if configured)
- Anonymous usage analytics via PostHog (if configured)

You need:

1. **Privacy policy URL** — public web page describing what you
   collect, where it goes (Supabase, Sentry, PostHog), how to delete
   it. Generators like <https://app.freeprivacypolicy.com> work for
   v1; you can replace with a hand-written one later.
2. **Terms of service URL** — what users agree to when they sign up.

Both URLs need to be live and accessible *before* you submit to Play
Store, because the data safety form references them.

Add the URL strings to your Play Console store listing (step 9 below).

---

## 6. Play Console service account

`eas submit` uses a Google Cloud service account to push builds to the
Play Store API. One-time setup:

1. Open <https://console.cloud.google.com/iam-admin/serviceaccounts>
2. Select your project (or create one specifically for Play submissions)
3. Click **Create service account**
   - Name: `eas-submit`
   - Role: **Service Account User**
4. After creation, click the account → **Keys** → **Add key** →
   **Create new key** → JSON. A `.json` file downloads.
5. Move it to `titan-protocol/google-service-account.json` (matches
   the path in `eas.json:submit.production.android.serviceAccountKeyPath`)
6. **Add `google-service-account.json` to `.gitignore`** (it should
   already be there but verify).
7. Open Play Console: <https://play.google.com/console>
8. **Setup → API access → Link Cloud project** → select the project
   from step 1
9. Grant the service account access:
   - Click the service account
   - Permissions: **App permissions** → **Add app** → titan-protocol
   - Account permissions: **Release manager**

---

## 7. Build the production AAB

```bash
cd titan-protocol
eas build --profile production --platform android
```

This kicks off a remote EAS build. It takes ~15-30 minutes the first
time (subsequent builds are faster because they use the EAS cache).

When it finishes you'll get a download URL for the `.aab` (Android
App Bundle) file. The `production` profile is configured to build a
bundle (not an APK) because Play Store requires AAB for new apps.

**Verify locally first** (optional but recommended):
```bash
eas build --profile preview --platform android
```
This builds an APK you can install on a real Android device for
final QA before submission.

---

## 8. Submit to internal testing

Once the production build finishes:

```bash
eas submit --profile production --platform android
```

The submit profile is already configured to push to the
`internal` track. After submission:

1. Open Play Console → titan-protocol → **Testing → Internal testing**
2. Create a new release (or pick the build that just landed)
3. Add yourself as a tester (Email lists or Google Groups)
4. Click **Review release** → **Start rollout to internal testing**

You'll get a Play Store link to install the build on any device
signed in with a tester account.

---

## 9. Play Console store listing

Required before any track promotes beyond internal testing:

1. **App details**:
   - Short description (≤80 chars)
   - Full description (≤4000 chars)
   - Default language: English
2. **Graphics**:
   - App icon (512×512 PNG, already in `assets/icon.png`)
   - Feature graphic (1024×500 PNG)
   - 2-8 phone screenshots (320-3840 px wide)
3. **Categorization**:
   - Application type: App
   - Category: Health & Fitness (or Lifestyle)
   - Tags: gamification, productivity, habit tracker
4. **Contact details**:
   - Email
   - Privacy policy URL (from step 5)
5. **Content rating**:
   - Fill out the questionnaire (~5 min)
   - Result: should be Everyone or Teen
6. **Target audience**:
   - Age groups: 18+
   - Appeals to children: No
7. **Data safety**:
   - You collect: Personal info (email, name), App activity (in-app
     actions), App info (crash logs), Device IDs (analytics)
   - Shared with: Sentry, PostHog (third parties)
   - Encrypted in transit: Yes
   - User can request deletion: Yes (Supabase deletes on user request)

---

## 10. (Optional) Google OAuth

See `docs/google-oauth-setup.md` for the full walkthrough. ~20 minutes
of work, completely optional for v1 (email + magic link already work
end-to-end).

---

## Verification checklist before promoting beyond internal testing

After installing the internal-testing build on a real device, verify:

- [ ] Sign up with email + password works
- [ ] Email verification flow lands the user back in the app
- [ ] Magic-link sign-in works (request from email-login screen)
- [ ] CinematicOnboarding plays on a fresh user, all 12 beats progress
- [ ] After onboarding, profile.onboarding_completed = true in Supabase
- [ ] Force-close + relaunch — onboarding does NOT re-trigger
- [ ] Add a task in HQ, complete it, see XP awarded
- [ ] Add a habit in Track, log it, see streak chain
- [ ] Open every hub screen (workouts, sleep, cashflow, etc.) — they
      load without crashing
- [ ] Force airplane mode → make a change → reconnect → verify the
      change synced via React Query offline queue
- [ ] Trigger an error (e.g. cause a crash on purpose in __DEV__) and
      verify it appears in Sentry within 30s
- [ ] Open PostHog Live Events, see app_open + protocol_morning_started
      events flowing
- [ ] Tab bar reads correctly with TalkBack (Android screen reader)
- [ ] Sign out → sign back in → all data still there

---

## Known v1.1 deferred work

Documented in the engineering report and the v1 launch plan:

- **Hub screen full refactor**: workouts.tsx (2,448 LOC), sleep.tsx
  (1,681 LOC), cashflow.tsx (1,539 LOC), nutrition.tsx (1,315 LOC).
  Phase 6 took the cloud-sync-engine path instead — these screens
  read from MMKV via the legacy stores, the sync engine mirrors
  writes to cloud, and a v1.1 cleanup will rewrite them to use the
  React Query hooks directly.
- **K registry adoption sweep**: 27 stores still use module-level
  string constants for MMKV keys instead of `K.*`. Mechanical change,
  defer to v1.1.
- **Gym 5-table refactor**: the gym store has 5 entities with
  cross-table id relationships that don't fit cleanly into the sync
  engine. Migration script (Phase 5) preserves existing data; live
  changes only sync after the v1.1 refactor.
- **Mind training + nutrition meals + deep work + skill tree + focus
  sessions**: same — cloud sync deferred to v1.1.
- **RevenueCat + paywall**: deferred to v1.1 per scope decision.
  Subscriptions table is fully provisioned in Supabase, ready for
  v1.1 wiring.
- **iOS App Store**: not in v1 scope (Android-only).
- **Maestro / Detox e2e tests**: deferred to v1.1.
- **Full WCAG AA accessibility audit**: minimum pass landed in
  Phase 8.4 (tab bar). Full audit is v1.1 work.
- **FCM push notifications**: local notifications work via
  expo-notifications; FCM (server-pushed) is v1.1.

---

## Open questions

These are decisions you should make before wide release:

1. **Pricing strategy** for v1.1 paywall — what's behind it?
2. **Onboarding video** for the store listing — recorded by you or
   captured from the app?
3. **Beta tester pool** — friends? subreddit? closed list?
4. **Store keywords** — what should people search for to find this?
5. **Update cadence** — weekly? monthly? as-needed?

These don't block launch, but they should be answered before
promoting from internal to closed/open testing.
