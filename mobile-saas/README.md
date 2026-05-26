# Titan Protocol — Mobile SaaS

Native iOS + Android app, built with Expo SDK 55 + React Native 0.83. Sister app to `web/` (Vite + Tauri) and `mobile/` (the standalone Classic edition). Shares one Supabase backend.

This README is the entry point for working in this package. The architecture spec is in [`CLAUDE.md`](./CLAUDE.md). The active roadmap is the parent repo's [`MOBILE_SAAS_ROADMAP.md`](../MOBILE_SAAS_ROADMAP.md), with detail docs in [`../mobile-saas-docs/`](../mobile-saas-docs/).

---

## Quick start

```bash
# Install deps
npm install --legacy-peer-deps

# Start the dev server
npm run start

# Build + run on a connected Android device or emulator
npm run android

# Build + run on a connected iOS device or simulator
npm run ios

# Typecheck + tests
npm run typecheck
npm test
```

`--legacy-peer-deps` is required because SDK 55's pinned `react-native-worklets@0.7.4` has a peer-dep conflict with `expo-modules-core@~55.0.25`. Same workaround as Classic.

---

## Architecture

Hybrid cloud-first:

- **Writes** go to Supabase first (`cloudUpsert` / `cloudUpsertMany` / `cloudDelete` in `src/db/sqlite/service-helpers.ts`), then mirror into the local SQLite cache.
- **Reads** stay local via `sqliteList` / `sqliteGet` / `sqliteCount` (~1ms latency).
- **Cross-device sync** via a Supabase Realtime subscription that fires `postgres_changes` events into local SQLite + invalidates the matching React Query keys.
- **First-run pull** on sign-in restores the cloud snapshot before any tab paints.
- **Sign-out** wipes all synced tables so the next user on this device starts clean.

See [`CLAUDE.md`](./CLAUDE.md) for the full spec.

---

## Status

| Milestone | Scope | Status |
|---|---|---|
| M1 | Expo bootstrap, design tokens, navigation, auth | ✅ done |
| M2 | Hybrid data layer — SQLite cache, cloud-first writes, Realtime, first-run pull | ✅ done |
| M3 | 26 services + 25 React Query hooks ported from Classic | ✅ done |
| M4 | Core screens — Dashboard, engines, Tasks, Habits | ✅ done |
| M5 | Secondary screens + push notifications | ✅ done |
| M6 | Ship to App Store + Play Store | 🟡 in progress (code-side prep done; account actions on user) |

---

## Project layout

```
mobile-saas/
├── app/                  Expo Router routes
│   ├── _layout.tsx       Root — fonts, auth, db migrations, Realtime, onboarding gate
│   ├── (auth)/           login picker + email-login + signup + verify
│   ├── (onboarding)/     3-step skippable wizard (gated on profiles.onboarding_completed)
│   ├── (tabs)/           HQ (Dashboard), Engines, Track (Tasks), Hub, Profile (Settings)
│   ├── engine/[id].tsx   Per-engine drill-down
│   ├── focus.tsx, journal.tsx, goals.tsx, analytics.tsx, habits.tsx
│   └── +not-found.tsx
├── src/
│   ├── components/ui/    Lifted from Classic + 3 new (WeekStrip, EngineFilterTabs, AddTaskSheet)
│   ├── components/       RealtimeProvider, FirstRunPullGate
│   ├── services/         26 cloud-first service files
│   ├── hooks/queries/    25 React Query hooks
│   ├── stores/           useAuthStore, useThemeStore, + 7 Classic stores
│   ├── db/sqlite/        client, migrator, coerce, column-types, service-helpers, migrations/
│   ├── sync/             realtime, first-run-pull, restore, backup, tables
│   ├── lib/              supabase, date, query-client, error-log, notifications, push-token, + Classic pure-logic
│   ├── theme/            colors, typography, spacing, shadows
│   ├── types/supabase.ts Generated Supabase types (regenerate on schema change)
│   └── __tests__/        jest + better-sqlite3 in-memory
├── supabase/functions/
│   └── send-push/        Edge Function source — deployed (verify_jwt: false)
├── store-assets/
│   ├── copy.md                       App Store + Play Store marketing copy
│   ├── privacy-disclosures.md        Apple Nutrition Labels + Google Data Safety
│   ├── screenshot-spec.md            8-shot capture plan
│   └── classic-customer-emails.md    T-2 weeks + T-0 outreach drafts
├── M6_SUBMISSION_CHECKLIST.md         Step-by-step launch checklist
├── eas.json                          EAS Build profiles
├── app.json                          Expo config (bundle id still placeholder pending Classic rename)
├── babel.config.js, metro.config.js
├── tsconfig.json, jest.config.js
└── package.json
```

---

## Supabase project

`rmvodrpgaffxeultskst` (region `ap-south-1`). Shared with `web/` and `mobile/` (Classic).

Environment variables (in `.env`, gitignored):

```
EXPO_PUBLIC_SUPABASE_URL=https://rmvodrpgaffxeultskst.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key — same as web + Classic>

# Optional — auto-hides Google sign-in button when missing
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=

# Optional — observability is no-op until set
EXPO_PUBLIC_POSTHOG_KEY=
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

See `.env.example`.

---

## Schema change workflow

Adding or altering a Supabase column is a **5-place change**, in this order:

1. Apply the DDL: `mcp__claude_ai_Supabase__apply_migration { name, query }`
2. Regenerate types: `mcp__claude_ai_Supabase__generate_typescript_types` → overwrite `shared/types/supabase.ts`
3. Mirror types into `mobile-saas/src/types/supabase.ts`, `mobile/src/types/supabase.ts`, `web/src/types/supabase.ts`
4. Add a new SQLite migration in `mobile-saas/src/db/sqlite/migrations/NNN_*.sql` + `.ts` + register in `migrations/index.ts`. Mirror in `web/src/db/sqlite/migrations/`.
5. Update `COLUMN_TYPES` in `mobile-saas/src/db/sqlite/column-types.ts` (and web's) for the new column.

Then:

- `npx tsc --noEmit` in mobile-saas + web
- `mcp__claude_ai_Supabase__get_advisors type=security` — zero new findings

---

## Tests

```bash
npm test
```

11 jest suites covering: SQLite coerce round-trips, hybrid sync invariants, 8 service files (boss-challenges, field-ops, habits, profile, protocol, sleep, tasks, weight), and a forbidden-patterns lint (no `.toISOString().slice(0,10)`, no raw `elevation:` outside `theme/shadows.ts`).

All ~70 tests must pass before commit. The `.claude/hooks/typecheck-on-commit.sh` blocks `git commit` if `tsc --noEmit` errors.

---

## Common pitfalls

- **Don't import from `supabase.from(...)` outside the allowed touchpoints** (`lib/supabase.ts`, `stores/useAuthStore.ts`, `db/sqlite/service-helpers.ts`, `sync/realtime.ts`, `sync/first-run-pull.ts`, `sync/restore.ts`, `sync/backup.ts`, `services/account.ts`). Services use `cloudUpsert`; that's the only sanctioned write helper.
- **`enabled: Boolean(userId)`** on every `useQuery`. Otherwise queries fire before auth lands and you'll see weird empty states + console noise.
- **No raw `elevation: N`** outside `theme/shadows.ts`. Android shadow OOM rule. The forbidden-patterns lint catches this.
- **`getTodayKey()` from `lib/date.ts`**, never `.toISOString().slice(0, 10)`. Same lint.
- **Every `withRepeat(-1)` needs `cancelAnimation()` in cleanup.** Otherwise Reanimated leaks on Android.

---

## Useful links

- [`CLAUDE.md`](./CLAUDE.md) — per-project architecture spec for Claude sessions
- [`M6_SUBMISSION_CHECKLIST.md`](./M6_SUBMISSION_CHECKLIST.md) — what's left to launch
- [`../MOBILE_SAAS_ROADMAP.md`](../MOBILE_SAAS_ROADMAP.md) — milestone tracker
- [`../mobile-saas-docs/`](../mobile-saas-docs/) — phase detail docs (M1 through M6)
- [`../SAAS_ROADMAP.md`](../SAAS_ROADMAP.md) — parent roadmap (P0 through P6)
