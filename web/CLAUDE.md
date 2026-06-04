# Titan Protocol — Web/Desktop App

> Gamified "personal OS" for web browsers and desktop (Mac/Windows via Tauri v2). **As of 2026-05-24, runs on a hybrid cloud-first architecture** — Supabase is the source of truth, local SQLite is a read cache, Realtime keeps it fresh.
>
> **Architecture: Hybrid. Supabase is the writer of record; SQLite is a fast local cache.**
> Every write hits Supabase first, then mirrors into SQLite, then returns. Reads stay on SQLite (~1 ms). A Realtime subscription pushes other devices' changes into this device's cache. No "Backup to Cloud" button anymore — sync is continuous.
>
> Historical: `../ROADMAP.md` (the local-first migration, completed 2026-04-22). Active plan: `../SAAS_ROADMAP.md` — P1 done; P0/P2/P3 code-side done with user-side actions outstanding; P5 (billing) + P6 (launch) not started.

---

## 0. Current SaaS-pivot state (2026-05-30)

- **P0 + P1 + P2 marketing layer landed.** App is at `/app/*`, marketing at `/`, `/pricing`, `/features`, `/changelog`, `/about`. Auth still at `/auth/login` and `/auth/callback`.
- **Auth live**: `src/lib/session.ts` initializes user id/email to `null`; `src/layouts/OSLayout.tsx` runs `useWebAuth` + `<Navigate to="/auth/login">`. Unauthenticated users hit the login screen.
- **Hybrid data layer live**: services use `cloudUpsert` / `cloudUpsertMany` / `cloudDelete` from `src/db/sqlite/service-helpers.ts` instead of the plain `sqlite*` variants. Writes go to Supabase first; the response is mirrored to SQLite.
- **Realtime live**: `WebAuthProvider` opens a `supabase.channel(\`user-\${id}-changes\`)` filtered to `user_id=eq.<id>` and subscribes to `postgres_changes` on every `SYNCED_TABLES` entry. INSERT/UPDATE writes to local SQLite via raw `run()`; DELETE hard-deletes by PK; both invalidate React Query.
- **First-run cloud pull**: `<FirstRunPullGate userId={user.id}>` wraps the OS shell. If the local SQLite is empty for this user, calls `restoreFromCloud()` before rendering — so a fresh device shows real data on first paint.
- **Wipe on sign-out**: `signOut()` calls `wipeAllSyncedTables()` before `supabase.auth.signOut()` so the next account on this device starts fresh.
- **Marketing layer**: `src/app/(marketing)/` holds `MarketingLayout`, `LandingPage`, `PricingPage`, `FeaturesPage`, `ChangelogPage`, `AboutPage`, `NotFoundPage`. Shared chrome (nav flips between "Sign in / Start free" and "Open the app →"). Premium HUD styling in `marketing.css`.
- **Back-compat**: pre-rename `/os/...` URLs redirect to `/app/...` via a `LegacyOsRedirect` component so old emails and Discord pins don't 404.
- **Observability scaffolded**: `src/lib/observability.ts` exports `initObservability` / `captureException` / `captureEvent` / `identifyUser` / `resetUser`. Sentry + PostHog providers lazy-import only when their env keys are set. No-op without keys; install `@sentry/react` and `posthog-js` when ready.
- **Supabase Realtime publication enabled**: migration `enable_realtime_publication` (applied 2026-05-24) added every synced table to `supabase_realtime` and set `REPLICA IDENTITY FULL` so DELETE events carry the full row.
- **P3 desktop plumbing landed**: Tauri auto-updater + release CI + signing runbook. See §11.
- **Offline dirty-row replay**: `sync/flush-dirty.ts` re-pushes any SQLite row left `_dirty=1` by a failed `cloudUpsert`. `lib/auth.tsx` fires it on sign-in, `window` `online`, and tab `visibilitychange`.
- **Migrator self-heal**: `db/sqlite/migrator.ts` swallows "duplicate column"/"already exists" via `isAlreadyAppliedError` so a half-applied migration on an existing OPFS doesn't brick boot with `STORAGE INIT FAILED`.
- **Scoring reactivity (2026-05-30)**: `lib/score-invalidation.ts` centralizes score-cache busting; `DailyPlanningProvider` is React-Query-backed (key `["dailyPlanning", todayKey]`); `useToggleCompletion`/`useCreateTask`/`useDeleteTask` + `sync/realtime.ts` all call `invalidateScoring(qc)` so the Dashboard Titan Score updates the instant a task is toggled. Consistency now anchors to each engine's first-task date and resets after 30 idle days (`lib/scoring.ts::computeMonthConsistency`, wired into Body/Mind/Money/General clients).
- **Account chip (UserMenu — newest, currently uncommitted)**: `src/app/(os)/components/UserMenu.tsx` is a Notion/Claude-style account menu mounted at the top of the desktop sidebar (`variant="sidebar"`, `OSShell.tsx`) **and** inside the mobile drawer (`variant="drawer"`, `MobileNav.tsx`). It reads the Realtime-synced profile (`useProfile()`) + auth email (`useCurrentUserEmail()`) and derives the avatar/rank color from `getRankForLevel()` — the **only** pure-logic helper web pulls from `@titan/shared` (`db/gamification.ts`). Dropdown shows rank + level + XP, a Settings link, and Sign out; updates live across devices via the synced profile. Sits on top of HEAD (`3aa7601`) with the profile-service/`useProfile` tweaks (`services/profile.ts`, `hooks/queries/useProfile.ts`).
- **Supabase project (`rmvodrpgaffxeultskst`)** is on the free tier (`ACTIVE_HEALTHY` when warm). Idle-pause kicks in after ~7 days of no traffic — `mcp__claude_ai_Supabase__restore_project` brings it back instantly.

---

## 1. Tech Stack

| Area | Package | Version |
|---|---|---|
| Framework | `react` / `react-dom` | `^19.2.4` |
| Build | `vite` | `^8.0.1` |
| Routing | `react-router-dom` (HashRouter) | `^7.13.1` |
| Styling | `tailwindcss` + `@tailwindcss/postcss` (v4 plugin) | `^4.1.18` |
| Animation | `framer-motion` | `^12.34.3` |
| Audio | `howler` | `^2.2.4` |
| Command palette | `cmdk` | `^1.1.1` |
| Desktop | `@tauri-apps/api` + `@tauri-apps/plugin-sql` | `^2.0.0` / `^2.4.0` |
| Local DB (browser) | `@sqlite.org/sqlite-wasm` (OPFS-SAH-Pool VFS) | `^3.53.0-build1` |
| Local DB (desktop) | `@tauri-apps/plugin-sql` (sqlite feature) | `^2.4.0` |
| Cloud (auth + backup only) | `@supabase/supabase-js` | `^2.101.1` |
| Query cache | `@tanstack/react-query` (in-memory, no persister) | `^5.96.2` |
| Shared pure logic | `@titan/shared` | `file:../shared` |
| Validation | `zod` | `^4.3.6` |
| Types | `typescript` strict | `^5.9.3` |
| Tests | `vitest` + `better-sqlite3` (in-memory) | `^4.1.0` |

No Next.js, no Electron, no Dexie, no IndexedDB. Tauri is the only desktop framework.

---

## 2. Data Layer (hybrid)

Supabase is the source of truth. Local SQLite is a per-user read cache. Realtime subscriptions push cross-device changes into this device's cache.

```
              ┌──────── write path ───────┐                ┌─── read path ───┐
              │                            │                │                  │
   Component  │   Hook → service.create()  │   Component   │   Hook → list…() │
       │      │             │              │      │        │      │           │
       ▼      │             ▼              │      ▼        │      ▼           │
   Mutation   │   cloudUpsert(t, row)      │   Query       │   sqliteList(t)  │
              │   ─ Supabase upsert        │                │   (in-memory     │
              │   ─ mirror to SQLite       │                │    cache, ~1ms)  │
              │   ─ return row             │                │                  │
              └─────────────────────────────                └──────────────────┘

                       (other device pushed a change)
                                 │
                                 ▼
              WebAuthProvider → Realtime channel
                                 │
                                 ▼
              postgres_changes  → write to SQLite + invalidateQueries()
```

**`localStorage` is for device-local preferences only:**
- Theme toggle (`hud` / `cyberpunk`)
- Sound toggle
- Selected date in command center

**SQLite is the local cache** (42 user tables + 3 internal housekeeping). Authoritative storage is in Supabase; SQLite is wiped on sign-out.

**Supabase touchpoints in `web/src/`:**
- `lib/init.ts` — `initSupabase()` once at startup
- `lib/auth.tsx` — `supabase.auth.*` for sign-in/sign-up/sign-out/OAuth + opens the Realtime channel on user-id change
- `lib/session.ts` — re-exports `supabase`
- `db/sqlite/service-helpers.ts` — `cloudUpsert` / `cloudUpsertMany` / `cloudDelete` are the hybrid write helpers used by every service
- `sync/realtime.ts` — `subscribeUserChanges(userId, queryClient)` opens the channel
- `sync/first-run-pull.ts` — `pullIfEmpty(userId)` for the freshly-signed-in path; `wipeAllSyncedTables()` for sign-out
- `sync/restore.ts` — atomic fetch-then-swap. Used by first-run pull and the dev escape hatch (`/app/settings?dev=1`)
- `sync/flush-dirty.ts` — `flushDirtyRows()` replays rows a failed `cloudUpsert` left `_dirty=1`; invoked from `lib/auth.tsx` on sign-in / `online` / tab focus
- `sync/backup.ts` — no longer wired into UI but kept for future cold-restore tooling
- `services/account.ts` — server-side cascade delete

**`@titan/shared`** is consumed **live** via a symlink — not a published package. `package.json` declares `"@titan/shared": "file:../shared"`, so `node_modules/@titan/shared` is a symlink to `../../../shared`; `tsconfig.json` `paths` (`"@titan/shared/*": ["../shared/*"]`) and `vite.config.ts` (`alias` + `preserveSymlinks: false`) both resolve the same sibling dir. Editing `shared/` is immediately visible to web — no build/publish step.

Web imports a **narrow slice** — only four files out of all of `shared/`:
- `lib/supabase.ts` — `initSupabase` / `supabase`. The auth + cloud-write client; the spine of auth, every `cloudUpsert`, Realtime, and backup/restore. (`lib/init.ts`, `lib/auth.tsx`, `lib/session.ts`.)
- `types/supabase.ts` — `Database` / `Tables` / `Json` / `Enums`, the generated table types (~39 import sites across services + sync + hooks).
- `db/gamification.ts` — `getRankForLevel` (UserMenu only).
- `types/quest-ui.ts` — the `Quest` UI type (quests service only).

Web does **not** import shared's `scoring-v2`, `date`, `srs`, `xp-rewards`, `quotes`, `schemas`, or any `data/*` — it keeps its own `lib/date.ts`, `lib/scoring.ts`, etc. The shared barrel `index.ts` is unused (web imports by subpath). No services and no hooks come from shared.

**Supabase project:** `rmvodrpgaffxeultskst` (ap-south-1) — shared with Classic mobile/desktop.

---

## 3. Bootstrap Flow

`src/main.tsx` wires everything in this order:

1. `import "./lib/init"` — calls `initSupabase({ url, anonKey, detectSessionInUrl: true })` from shared
2. `<BootGate>` — runs SQLite migrations before rendering children; shows a splash during init, error screen on failure
3. `<QueryClientProvider>` — local `new QueryClient({...})` in `lib/query.ts` (5min staleTime, 24h gcTime)
4. `<WebAuthProvider>` — owns the auth context (user, loading, signIn/signUp/signInWithGoogle/signOut)
5. `<HashRouter>` — client-side routing (works under Tauri too)
6. `<App />` — route definitions

Global CSS imported in `main.tsx`: `globals.css`, `os.css`, `dashboard.css`, `premium-ui.css`.

---

## 4. Auth

- `src/lib/auth.tsx` — `WebAuthProvider` exposes `{ user, loading, signIn, signUp, signInWithGoogle, signOut }` via `useWebAuth()`
- Listens to `supabase.auth.onAuthStateChange` and pushes user into the service-layer session cache (`lib/session.ts::setCurrentUser`)
- Login UI lives at `/auth/login` — tabbed email/password + Google OAuth button
- OAuth redirects land on `/auth/callback`, which waits for `detectSessionInUrl` to complete then routes to `/os`
- Auth gate lives in `OSLayout` — unauthenticated users are redirected to `/auth/login` (reactivated 2026-05-24).
- `OSLayout` defines an `AuthSplash` ("CHECKING SESSION…") for the initial resolving state.

---

## 5. Data Layer Pattern (for every new feature)

### Service (`src/services/xxx.ts`)
```typescript
import { requireUserId } from "../lib/session";
import {
  newId, sqliteList, sqliteGet, cloudUpsert, cloudDelete,
} from "../db/sqlite/service-helpers";
import type { Tables } from "@titan/shared/types/supabase";

export type Xxx = Tables<"xxx">;

export async function listXxx(): Promise<Xxx[]> {
  // Reads stay local — fast.
  return sqliteList<Xxx>("xxx", { order: "created_at ASC" });
}

export async function createXxx(input: { title: string }): Promise<Xxx> {
  const userId = await requireUserId();
  // Writes go cloud-first; the helper mirrors back into SQLite on success.
  return cloudUpsert("xxx", {
    id: newId(),
    user_id: userId,
    title: input.title,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function deleteXxx(id: string): Promise<void> {
  await cloudDelete("xxx", { id });
}
```

### Hook (`src/hooks/queries/useXxx.ts`)
```typescript
import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/session";
import { listXxx } from "../../services/xxx";

export const xxxKeys = { all: ["xxx"] as const };

export function useXxx() {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: xxxKeys.all,
    queryFn: listXxx,
    enabled: Boolean(userId),
  });
}
```

### Rules
- Services **throw** on error.
- Writes go cloud-first via `cloudUpsert` / `cloudUpsertMany` / `cloudDelete`. The plain `sqlite*` helpers are reserved for the Realtime subscriber and first-run pull, which already receive data from cloud.
- Query keys are **tuple-typed** with `as const`.
- `enabled: Boolean(userId)` on every `useQuery` hook.
- **Never** read or write `localStorage` for user data.
- New table? Add it to (a) the SQL migration (`src/db/sqlite/migrations/NNN_*.sql`), (b) `COLUMN_TYPES` (`src/db/sqlite/column-types.ts`), (c) `PRIMARY_KEYS` (`src/sync/tables.ts`), AND (d) the Supabase `supabase_realtime` publication + `REPLICA IDENTITY FULL` (mirror the migration `enable_realtime_publication`). Realtime subscriptions iterate `SYNCED_TABLES` automatically once the publication has the table.

---

## 6. Routes (App.tsx)

```
/                           → LandingPage          (marketing — public)
/pricing                    → PricingPage          (marketing — public)
/features                   → FeaturesPage         (marketing — public)
/changelog                  → ChangelogPage        (marketing — public)
/about                      → AboutPage            (marketing — public)
/auth/login                 → LoginPage            (unprotected; ?mode=signup tab)
/auth/callback              → CallbackPage         (unprotected — OAuth return)
/app                        → Dashboard            (gated)
/app/body                   → BodyClient
  /app/body/nutrition       → NutritionPage
  /app/body/sleep           → SleepPage
  /app/body/weight          → WeightPage
  /app/body/workouts        → WorkoutsPage
/app/mind                   → MindClient
/app/money                  → MoneyClient
  /app/money/cashflow       → MoneyExpenseClient
  /app/money/deep-work      → DeepWorkPage
  /app/money/budgets        → BudgetsPage
/app/general                → GeneralClient        (maps to engine "charisma")
/app/command                → CommandCenterClient
/app/analytics              → AnalyticsClient
/app/habits                 → HabitsPage
/app/journal                → JournalPage
/app/goals                  → GoalsPage
/app/focus                  → FocusPage
/app/settings               → SettingsPage         (Theme + Account + Onboarding reset + dev re-pull)
/os, /os/*                  → 301-style redirect to /app/* (back-compat)
*                           → NotFoundPage (404, wrapped in MarketingLayout)
```

`MarketingLayout` wraps the public routes with sticky nav + footer. `OSLayout` gates the `/app/*` subtree on auth and runs `<FirstRunPullGate>` before rendering children. Auth routes are top-level and unprotected.

`/app/general` is the URL; it renders the "charisma" engine (URL kept for backwards compatibility from the pre-SaaS shape).

---

## 7. File Structure

```
web/
├── src/
│   ├── main.tsx                Entry — init, BootGate, providers, HashRouter
│   ├── App.tsx                 Route table (2 auth routes + 18 OS routes + catch-all)
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx          Tabbed sign-in / sign-up + Google OAuth
│   │   │   └── callback/page.tsx       OAuth return → routes to /os
│   │   ├── (os)/
│   │   │   ├── Dashboard.tsx           HQ — engine cards, Titan score, week sparklines
│   │   │   ├── components/
│   │   │   │   ├── DailyPlanningProvider.tsx  React-Query-backed today's-plan context
│   │   │   │   ├── OSShell.tsx          Desktop sidebar + nav groups + UserMenu(sidebar)
│   │   │   │   ├── MobileNav.tsx        Hamburger drawer + UserMenu(drawer)
│   │   │   │   └── UserMenu.tsx         Notion-style account chip (profile + rank + sign-out)
│   │   │   └── os/
│   │   │       ├── body/, mind/, money/, general/, command/, analytics/,
│   │   │       ├── habits/, journal/, goals/, focus/, settings/
│   │   │       └── (per-engine calendars + trackers)
│   │   ├── globals.css         Global resets + @import styles/marketing.css
│   │   └── styles/             theme-tokens.css, hud-effects.css, etc.
│   ├── components/
│   │   ├── BootGate.tsx        Runs migrator before first render
│   │   ├── FirstRunPullGate.tsx Pulls cloud data into empty SQLite before rendering the app
│   │   ├── UpdateChecker.tsx    Tauri-only auto-update banner (no-op in browser)
│   │   └── ui/                 titan-primitives + BottomSheet + MiniCharts + etc.
│   ├── db/sqlite/
│   │   ├── client.ts           Platform-branching public API
│   │   ├── client-browser.ts   Dispatches to sqlite-worker.ts (OPFS-SAH-Pool lives in a Worker)
│   │   ├── client-tauri.ts     @tauri-apps/plugin-sql wrapper + statement-splitter for exec()
│   │   ├── client-types.ts     Shared ClientImpl / RunResult types
│   │   ├── sqlite-worker.ts    Dedicated Worker — installs SAH Pool VFS on /titan.db
│   │   ├── migrator.ts         schema_migrations bookkeeping + isAlreadyAppliedError self-heal
│   │   ├── migrations/          001_initial.sql, 002_add_expo_push_token.sql + index.ts
│   │   ├── column-types.ts     Column → ColumnKind map for coerce
│   │   ├── coerce.ts           JS ↔ SQLite type coercion + stripSyncColumns
│   │   └── service-helpers.ts  sqliteList/Get/Count/Upsert/UpsertMany/Delete/newId
│   ├── hooks/
│   │   ├── queries/            25 React Query hooks mirrored from mobile
│   │   ├── useScoreMap.ts      Dashboard/analytics/calendar aggregations (factory keys + enabled)
│   │   └── useIsMobile.ts
│   ├── services/               26 SQLite-first service files mirrored from mobile
│   ├── sync/
│   │   ├── realtime.ts         subscribeUserChanges() — postgres_changes → SQLite + invalidate
│   │   ├── first-run-pull.ts   pullIfEmpty() / wipeAllSyncedTables()
│   │   ├── flush-dirty.ts      flushDirtyRows() — replay failed cloud writes
│   │   ├── backup.ts           Manual upload to Supabase (upserts live rows + DELETEs tombstones)
│   │   ├── restore.ts          Atomic fetch-then-swap from Supabase (transaction commit)
│   │   └── tables.ts           SYNCED_TABLES, PULL_ORDER, PRIMARY_KEYS
│   ├── lib/
│   │   ├── init.ts             initSupabase() once
│   │   ├── auth.tsx            WebAuthProvider + useWebAuth + Realtime channel + flush-dirty triggers
│   │   ├── session.ts          User cache + requireUserId + useCurrentUserId
│   │   ├── query.ts            QueryClient factory
│   │   ├── scoring.ts          Engine score + consistency aggregations (SQLite-backed; 30-day reset)
│   │   ├── score-invalidation.ts  invalidateScoring(qc) + tableAffectsScoring(table)
│   │   ├── dashboard-stats.ts  Week / planning aggregations
│   │   ├── observability.ts    Optional Sentry + PostHog (no-op without env keys)
│   │   ├── desktop-updater.ts  checkForUpdate() — Tauri-only, no-op in browser
│   │   ├── achievement-integration.ts  No-op stub (mobile checker not yet ported)
│   │   ├── error-log.ts
│   │   ├── date.ts, sound.ts, theme.ts, money_format.ts
│   ├── layouts/
│   │   └── OSLayout.tsx        Auth gate + ThemeProvider + DailyPlanningProvider
│   └── __tests__/              vitest — date, scoring, sqlite-smoke, hybrid-sync (52 tests)
├── src-tauri/                  Tauri v2 desktop project (Rust) + tauri-plugin-sql
├── out/                        Vite build output (frontendDist for Tauri)
├── public/                     PWA assets (boot.mp4, manifest, icons)
├── .env                        VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── vite.config.ts              Vite + @titan/shared alias + optimizeDeps.exclude
├── vitest.config.ts
├── tsconfig.json, tailwind.config.ts, postcss.config.mjs, eslint.config.mjs
└── package.json
```

---

## 8. Components (`src/components/ui/`)

| File | Role |
|---|---|
| `titan-primitives.tsx` | `TitanButton`, `TitanPanel`, `TitanPageHeader`, `TitanPanelHeader`, `TitanProgress`, `TitanActionLink`, `TitanMetric`, `TitanEmptyState`, `TitanSkeleton` |
| `BottomSheet.tsx` | Slide-up modal (mobile web) |
| `MobileModal.tsx` | Simple modal wrapper |
| `CommandPalette.tsx` | cmdk-based command palette |
| `MiniCharts.tsx` | Sparkline, bar, radar charts |
| `ScoreGauge.tsx` | Radial progress gauge |
| `PageTransition.tsx` | Framer Motion page fade |
| `PageSkeleton.tsx` | Loading skeleton |
| `ThemeProvider.tsx` | Theme context (hud / cyberpunk) |
| `NavIcon.tsx` | Icon with conditional styling |
| `Celebration.tsx` | Confetti / celebration animation |

---

## 9. Hooks & Aggregation Helpers

### `src/hooks/queries/`
25 thin React Query hooks wrapping `src/services/*`:
`useAchievements`, `useBossChallenges`, `useBudgets`, `useDeepWork`, `useFieldOps`, `useFocus`, `useGoals`, `useGym`, `useHabits`, `useJournal`, `useMindTraining`, `useMoney`, `useNarrative`, `useNutrition`, `useProfile`, `useProgression`, `useProtocol`, `useQuests`, `useRankUps`, `useSkillTree`, `useSleep`, `useTasks`, `useTitanMode`, `useTitles`, `useWeight`.

### `src/hooks/`
- `useScoreMap.ts` — Dashboard + calendar + analytics aggregations (React-Query-cached, 30s staleTime): `useMonthScoreMap`, `useMonthTitanScoreMap`, `useDashboardWeek`, `useAnalyticsSnapshot`. Called by Dashboard + every per-engine client + Command Center + Analytics. Tuple-typed key factories (`scoreMapKeys`, `dashboardKeys`, `analyticsKeys`) and `enabled: Boolean(userId)` on every query.
- `useIsMobile.ts` — in use by the OS shell, mobile nav, PageTransition, MobileModal.

> Note: `src/hooks/queries/useTasks.ts` exports a hook called `useEngineTasks(engine)` which IS used by every engine client. The standalone `src/hooks/useEngineTasks.ts` (with `useBodyTasks` / `useMindTasks` / etc. aliases) was deleted as dead code in 2026-05-07 — same name, only the queries version survives.

### `src/lib/`
| File | Status |
|---|---|
| `init.ts` | Calls `initSupabase()` once |
| `auth.tsx` | `WebAuthProvider` + `useWebAuth` (user, signIn, signUp, signInWithGoogle, signOut) |
| `session.ts` | User cache, `requireUserId`, reactive `useCurrentUserId`/`useCurrentUserEmail` |
| `query.ts` | Local `QueryClient` factory |
| `scoring.ts` | Engine score + consistency aggregation — reads from SQLite. `computeMonthConsistency` anchors to first-task date + resets after 30 idle days |
| `score-invalidation.ts` | `invalidateScoring(qc)` busts `scoreMap`/`dashboard`/`analytics`/`dailyPlanning` query roots; `tableAffectsScoring(table)` gates Realtime |
| `dashboard-stats.ts` | Daily planning + week stats — reads from SQLite |
| `achievement-integration.ts` | Stub — mobile's checker not yet ported |
| `error-log.ts` | Minimal console logger |
| `date.ts`, `sound.ts`, `theme.ts`, `money_format.ts` | Pure helpers |

---

## 10. Styling

- Tailwind CSS v4 (PostCSS plugin) — config at `tailwind.config.ts` is minimal (theme lives in CSS).
- CSS custom properties in `src/app/styles/theme-tokens.css` (`--bg0`, `--panel`, `--text`, `--muted`, `--chrome1/2`, `--stroke`, `--hud-glow`, `--accent`, `--status-*`).
- Dark theme default: `data-theme="hud"` on the html element. Alt theme: `cyberpunk`.
- Prefer CSS variables or Tailwind classes. Inline hex is tolerated in a few celebration/confetti spots but avoided in data components.

---

## 11. Desktop (Tauri v2)

Config: `src-tauri/tauri.conf.json`
- Product: `Titan Protocol`, id `com.titan.protocol`, version source-of-truth here (bump on each release; the tag must match)
- Window: 1440×900, resizable, centered
- Dev URL: `http://localhost:3000` (strictPort)
- `frontendDist`: `../out` (Vite build output)
- `beforeDevCommand`: `npm run dev`; `beforeBuildCommand`: `npm run build:tauri`
- Bundle targets: `all` (DMG, EXE, MSI, AppImage, DEB)
- `bundle.createUpdaterArtifacts: true` — produces `.sig` files + `latest.json` for the updater
- Bundle metadata: publisher, copyright, category, shortDescription, longDescription all set
- Tray icon: Focus Timer (opens `index.html#/app/focus` popup) + Quit

Rust side (`src-tauri/src/lib.rs`) registers `tauri-plugin-sql`, `tauri-plugin-process`, and (desktop-only) `tauri-plugin-updater`. Capabilities in `src-tauri/capabilities/default.json` are `core:window:*` + `sql:*` + `updater:*` + `process:allow-restart`.

CSP set in `app.security.csp` allows `'self' + 'wasm-unsafe-eval'` for sqlite-wasm, `https://*.supabase.co` (HTTPS + WSS) for cloud sync, `https://github.com + https://*.githubusercontent.com` for the updater endpoint, Google Fonts, and `blob:` workers. Vite dev bypasses CSP — only `tauri build` enforces it.

### Auto-update

`web/src/lib/desktop-updater.ts` exposes `checkForUpdate()` — a no-op in the browser build; in Tauri it dynamic-imports `@tauri-apps/plugin-updater` + `@tauri-apps/plugin-process`. The `<UpdateChecker />` component (mounted inside `OSLayout`) calls it on mount, shows a bottom-right banner when an update is available, and (on confirm) downloads + installs + relaunches.

Updater config in `tauri.conf.json` under `plugins.updater`: pubkey embedded at build time; endpoint pointed at GitHub Releases. See `web/DESKTOP_RELEASE.md` for the full setup runbook (signing key generation, Apple Developer + Windows certs, GitHub secrets, the tag-and-push release flow).

### Release workflow

`web/.github/workflows/tauri-release.yml` triggers on `v*.*.*` tag push. Builds for macOS (universal), Ubuntu 22.04, Windows. Uses `tauri-apps/tauri-action`. Uploads signed installers + `latest.json` to a GitHub Release. See `DESKTOP_RELEASE.md` for the secrets the workflow expects.

**Android via Tauri** — `tauri:android:*` scripts exist but aren't exercised. The Android app is the Expo project in `../mobile` (Classic) plus the future P4 SaaS mobile project; don't build web for Android without an explicit reason.

---

## 12. Commands

```bash
npm run dev            # Vite dev server (port 3000, strictPort)
npm run build          # Static build → out/
npm run build:tauri    # Same as build — Tauri hook uses this
npm run preview        # Preview out/ locally
npm run tauri:dev      # Desktop dev with hot reload
npm run tauri:build    # Production installers (.dmg/.msi/.exe/.AppImage/.deb)
npm run test           # Vitest (4 files — date, scoring, sqlite-smoke, hybrid-sync; 52 tests)
npx tsc --noEmit       # Typecheck (must be zero errors)
```

---

## 13. Env Vars

```
VITE_SUPABASE_URL=https://rmvodrpgaffxeultskst.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

---

## 14. Known issues & intentional simplifications

Closed items live in git history; the list below is what's still actionable or deliberately deferred.

- **Uncommitted working tree** — the SaaS-pivot + this session's scoring work + the new `UserMenu` account chip sit on top of HEAD (`3aa7601`); ~28 files modified/added at last check (incl. the untracked `UserMenu.tsx`). The current code is the canonical state; commit when convenient. (Auth bypass is *resolved* — `OSLayout` gates `/app/*` on a real session and redirects to `/auth/login`; not a known issue anymore.)
- **General (charisma) calendar/heatbars** — *resolved 2026-06-03*. `GeneralClient.tsx` previously hardcoded `const monthScoreMap = {}`, so the General page's calendar coloring, monthly heat bars, and consistency metric rendered empty even when charisma tasks were completed. Now calls `useMonthScoreMap("charisma", monthStartKey, monthEndKey)` like `BodyClient`/`MindClient`/`MoneyClient`. (`lib/scoring.ts` + `useScoreMap.ts` already fully supported `charisma`.)
- **Achievement integration** — `lib/achievement-integration.ts` is a no-op stub. Mobile has a working checker (`achievement-checker.ts` + `achievement-integration.ts`) that fires after every task/habit/protocol mutation. Port when achievement unlock animations need to fire on web.
- **React Query persister** — the cache is purely in-memory. Cold starts re-fetch from SQLite (~1ms). Add `@tanstack/query-persist-client-core` only if measurable.
- **Analytics `taskReliability`** — a rough approximation (`completed-days ÷ eligible-days` with a `daysPerWeek` adjustment). Rebuild with the exact `lib/scoring.ts` logic if the numbers matter.
- **`pending_mutations` + `sync_meta` tables** — created by `001_initial.sql` but never read/written. Housekeeping from the planned background-sync architecture (replaced with manual backup). Drop in a future migration on both apps.
- **Restore memory cost** — atomic restore stages every cloud row in memory before the swap. Fine for typical single-user data (low-thousands of rows). For hundreds-of-thousands, switch to a sibling-SQLite-file staging strategy.
- **CSP smoke test** — only `tauri build` enforces the CSP in §11. Test sign-in, OAuth, backup, restore, and any external-resource feature in a packaged build before shipping.
