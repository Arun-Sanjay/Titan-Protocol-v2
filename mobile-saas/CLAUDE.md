# Titan Protocol — Mobile SaaS (mobile-saas)

> Native Expo / React Native app for iOS + Android. Same Supabase backend as web + Tauri desktop. Hybrid architecture: writes go cloud-first, local SQLite as a read cache, Realtime keeps it fresh.
>
> **Status:** Being built per [P4 of the SaaS roadmap](../SAAS_ROADMAP.md). Detail plans live in [`../mobile-saas-docs/`](../mobile-saas-docs/). Current milestone: see status snapshot below.

---

## 0. Where to look first

If you're a fresh Claude session: read **[`../HANDOFF_MOBILE_SAAS.md`](../HANDOFF_MOBILE_SAAS.md)** at the parent directory before anything else. It's the mission brief.

The active plan navigator is [`../MOBILE_SAAS_ROADMAP.md`](../MOBILE_SAAS_ROADMAP.md). Six sub-phase detail docs live in [`../mobile-saas-docs/`](../mobile-saas-docs/) — read the one matching the milestone you're working on.

---

## 1. Architecture (locked)

**Hybrid cloud-first.** Same shape as web (`../web/`):

```
              ┌──────── write path ───────┐                ┌─── read path ───┐
              │                            │                │                  │
   Component  │   Hook → service.create()  │   Component   │   Hook → list…() │
       │      │             │              │      │        │      │           │
       ▼      │             ▼              │      ▼        │      ▼           │
   Mutation   │   cloudUpsert(t, row)      │   Query       │   sqliteList(t)  │
              │   ─ Supabase upsert        │                │   (~1ms local)   │
              │   ─ mirror to SQLite       │                │                  │
              │   ─ return canonical row   │                │                  │
              └─────────────────────────────                └──────────────────┘

                       (other device pushed a change)
                                 │
                                 ▼
              RealtimeProvider → Supabase channel
                                 │
                                 ▼
              postgres_changes  → write to SQLite + invalidateQueries()
```

**Supabase project:** `rmvodrpgaffxeultskst` (ap-south-1) — shared with web + Tauri desktop.

**SQLite driver:** `expo-sqlite ~55.0.15`. Same DB layout as Classic and web — 42 user tables + 3 housekeeping. Migration files in `src/db/sqlite/migrations/`.

**Allowed Supabase touchpoints in `src/`:**
- `lib/supabase.ts` — Supabase client + `requireUserId` (lifted from Classic, AsyncStorage-backed)
- `stores/useAuthStore.ts` — auth state, OAuth, SIGNED_OUT recovery
- `db/sqlite/service-helpers.ts` — `cloudUpsert` / `cloudUpsertMany` / `cloudDelete` — services call these
- `sync/realtime.ts` — `subscribeUserChanges(userId, queryClient)`
- `sync/first-run-pull.ts` — `pullIfEmpty` + `wipeAllSyncedTables`
- `sync/restore.ts` — atomic fetch-then-swap (used by first-run pull + dev tools)
- `services/account.ts` — server-side cascade delete via Supabase RPC

Anywhere else calling `supabase.from(...)` is a bug.

---

## 2. Tech stack (locked to match Classic)

| Area | Package | Version | Notes |
|---|---|---|---|
| Runtime | `expo` | `~55.0.12` | |
| | `react-native` | `0.83.4` | |
| | `react` | `19.2.0` | |
| Routing | `expo-router` | `~55.0.11` | File-based |
| Local DB | `expo-sqlite` | `~55.0.15` | |
| Cloud | `@supabase/supabase-js` | `^2.101.1` | Same as web |
| Query | `@tanstack/react-query` | `^5.96.2` | Same as web |
| Storage | `react-native-mmkv` | `^4.3.0` | Device prefs only |
| | `@react-native-async-storage/async-storage` | `2.2.0` | Supabase session |
| Animation | `react-native-reanimated` | `4.2.1` | |
| | `react-native-worklets` | `0.7.2` | |
| Lists | `@shopify/flash-list` | `2.0.2` | |
| Canvas | `@shopify/react-native-skia` | `2.4.18` | |
| Gestures | `react-native-gesture-handler` | `~2.30.0` | |
| Validation | `zod` | `^4.3.6` | |
| State | `zustand` | `^5.0.12` | Auth + UI state |
| Observability | `@sentry/react-native` | `~7.11.0` | Wired in M5 |
| | `posthog-react-native` | `^4.41.1` | Wired in M5 |
| Tests | `jest` + `jest-expo` + `better-sqlite3` | matched | |

Full list (with exact versions for every dep) is in [`../mobile-saas-docs/01-foundations.md`](../mobile-saas-docs/01-foundations.md).

---

## 3. Data layer pattern (every new feature follows this)

### Service (`src/services/xxx.ts`)

```typescript
import { requireUserId } from "../lib/supabase";
import {
  newId, sqliteList, sqliteGet, cloudUpsert, cloudDelete,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

export type Xxx = Tables<"xxx">;

export async function listXxx(): Promise<Xxx[]> {
  // Reads stay local — fast.
  return sqliteList<Xxx>("xxx", { order: "created_at ASC" });
}

export async function createXxx(input: { title: string }): Promise<Xxx> {
  const userId = await requireUserId();
  // Writes go cloud-first; helper mirrors back into SQLite on success.
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
import { useAuthStore } from "../../stores/useAuthStore";
import { listXxx } from "../../services/xxx";

export const xxxKeys = { all: ["xxx"] as const };

export function useXxx() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: xxxKeys.all,
    queryFn: listXxx,
    enabled: Boolean(userId),
  });
}
```

### Rules

- Services **throw** on error.
- Writes go via `cloudUpsert` / `cloudUpsertMany` / `cloudDelete`. The plain `sqlite*` helpers are reserved for the Realtime subscriber and first-run pull.
- Query keys are **tuple-typed** with `as const`.
- `enabled: Boolean(userId)` on every `useQuery` hook.
- Never read or write MMKV for user data — device prefs only.
- New table? Touches **5 places**: (1) Supabase migration, (2) regenerate `shared/types/supabase.ts` and mirror to `src/types/supabase.ts` (+ `mobile/src/types/supabase.ts`), (3) SQLite migration in this app, (4) SQLite migration in web (and `mobile/` Classic only if it needs the column), (5) `COLUMN_TYPES`+`PRIMARY_KEYS` in each app + the Realtime publication on Supabase. See the root `CLAUDE.md` §"Schema changes" for the full workflow.

---

## 4. Golden rules

1. **SQLite cache, Supabase truth.** Cloud-first writes; Realtime keeps the cache fresh.
2. **Reads from hooks, never directly from Supabase or SQLite in components.**
3. **Mutations are user-fast.** `cloudUpsert` returns when Supabase confirms + SQLite mirror is done — usually <500ms on good network.
4. **`enabled: Boolean(userId)` on every query hook.**
5. **Every `withRepeat(-1)` paired with `cancelAnimation()` in cleanup.** Reanimated leak guard.
6. **Android shadows only via `theme/shadows.ts`.** No raw `elevation: N`.
7. **No inline hex/rgba in components.** Use `colors.*`.
8. **Dates via `lib/date.ts`.** Never `.toISOString().slice(0,10)`.
9. **Batch inserts** via `cloudUpsertMany` not N individual `cloudUpsert` calls.
10. **Auth store is the single source of session truth.** `useAuthStore.getState().user?.id` is the canonical user id read.
11. **No new dependencies without checking version compat with Expo SDK 55.** Use `npx expo install <pkg>` so Expo picks the right version.

---

## 5. File structure (target end-state)

```
mobile-saas/
├── app/                              Expo Router routes
│   ├── _layout.tsx                   Root — fonts, migrator, auth gate, providers
│   ├── (auth)/                       login, signup, verify, (callback)
│   ├── (tabs)/                       HQ, Engines, Track, Hub, Profile
│   ├── (onboarding)/                 3-step skippable wizard (M5)
│   ├── engine/[id].tsx               Per-engine detail
│   ├── focus.tsx, journal.tsx, goals.tsx, analytics.tsx, …
│   └── +not-found.tsx
├── src/
│   ├── components/                   UI primitives + RealtimeProvider + FirstRunPullGate + UpdateChecker (etc.)
│   ├── services/                     26 cloud-first service files
│   ├── hooks/queries/                25 React Query hooks
│   ├── stores/useAuthStore.ts        Single auth source
│   ├── db/sqlite/                    client, migrator, coerce, column-types, service-helpers, migrations/
│   ├── sync/                         realtime, first-run-pull, restore, backup, tables
│   ├── lib/                          supabase, date, error-log, observability, push-token, notifications, sound
│   ├── theme/                        colors, typography, spacing, shadows
│   ├── types/supabase.ts             Generated types mirror
│   └── __tests__/                    jest + better-sqlite3 in-memory
├── assets/                           App icons, splash
├── store-assets/                     Screenshots, marketing copy (M6)
├── android/                          Native Android project (after `expo prebuild`)
├── ios/                              Native iOS project (after `expo prebuild`)
├── app.json
├── babel.config.js, metro.config.js
├── tsconfig.json, jest.config.js
├── eas.json
└── package.json
```

Not all of this exists at any given milestone — see [`../mobile-saas-docs/`](../mobile-saas-docs/) for what each phase introduces.

---

## 6. Commands

```bash
npm run start            # expo start
npm run android          # expo run:android
npm run ios              # expo run:ios
npm run typecheck        # tsc --noEmit
npm test                 # jest
npm run test:watch       # jest --watch
npm run prebuild         # tsc --noEmit && jest (gate before EAS build)

# EAS (after M6 sets it up)
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

---

## 7. Status snapshot (update as milestones land)

| Milestone | Scope | Status | Notes |
|---|---|---|---|
| **M1** | Foundations — Expo + design + nav + auth | ✅ done (2026-05-25) | tsc + Metro boot verified; emulator cold-start pending a device |
| **M2** | Hybrid data layer + Realtime + first-run pull | ✅ done (2026-05-26) | 18 jest tests pass; tsc clean; cross-device manual test pending an emulator + web run |
| **M3** | 26 services + 25 hooks | ✅ done (2026-05-26) | 83 cloud-write sites, 0 sqlite-write sites in services; 68 jest tests pass; cross-device CRUD smoke pending |
| **M4** | Core screens — Dashboard, engines, tasks, habits | ✅ done (2026-05-26) | tsc clean; 11 jest suites / 70 tests including forbidden-patterns lint; emulator visual review + perf trace pending |
| **M5** | Secondary screens + push notifications | ✅ done (2026-05-26) | 6 screens + onboarding wizard live; send-push Edge Function deployed; pg_cron daily streak warning scheduled at 14:30 UTC; permission prompt timed post-first-task |
| **M6** | Ship — bundle migration, store assets, submission | 🟡 code-complete (2026-05-26); user actions only | eas.json + app.json polish + iOS Google guard ✅; store copy + privacy disclosures + screenshot spec + customer emails ✅; README + M6_SUBMISSION_CHECKLIST.md ✅; outstanding = Apple Dev / Google Play / EAS init / Classic bundle rename / build + submit (see `../RELEASE_READINESS.md`) |

> **Post-M6 (2026-05-30):** scoring-invalidation tightening in `src/hooks/queries/useTasks.ts` — `useToggleCompletion`/`useToggleCompletionWithReward` also invalidate the per-engine task list; `useCreateTask`/`useDeleteTask` invalidate `recentCompletions` (analytics reliability denominator). Mirrors a web fix; mobile-saas was never vulnerable to the web Context-staleness bug because HQ derives scores live (see §9).

When a milestone lands:
1. Update this table's status column to ✅.
2. Update `../MOBILE_SAAS_ROADMAP.md`'s status table too.
3. Save a memory entry at `/Users/arunsanjay/.claude/projects/.../memory/p4_mN_done.md`.

---

## 8. References

- [`../HANDOFF_MOBILE_SAAS.md`](../HANDOFF_MOBILE_SAAS.md) — read first
- [`../MOBILE_SAAS_ROADMAP.md`](../MOBILE_SAAS_ROADMAP.md) — phase navigator
- [`../mobile-saas-docs/`](../mobile-saas-docs/) — phase detail docs (01 through 06)
- [`../SAAS_ROADMAP.md`](../SAAS_ROADMAP.md) — parent plan
- [`../mobile/CLAUDE.md`](../mobile/CLAUDE.md) — Classic's architecture notes (lots of useful gotchas you inherit)
- [`../web/CLAUDE.md`](../web/CLAUDE.md) — SaaS architecture spec to mirror

---

## 9. Known landmines (carry from Classic + web)

These are documented in detail in the lift-source CLAUDE.md files; pasted here for fast reference:

- **Spurious SIGNED_OUT recovery**: under tap-bursts, supabase-js can emit a false SIGNED_OUT. `useAuthStore` has retry logic with a 60s cooldown; don't remove it.
- **Android shadow OOM**: never raw `elevation: N` outside `theme/shadows.ts`. Cap at 2 for panels, 0 for rows.
- **`withRepeat(-1)` leak**: pair with `cancelAnimation(sv)` in useEffect cleanup.
- **`.toISOString().slice(0,10)` is wrong** east of UTC near midnight. Use `getTodayKey()` / `toLocalDateKey()`.
- **Cinematics + ceremonies**: Classic has ~92 v2 components for narrative beats. mobile-saas deliberately defers these — light onboarding only in M5.
- **The Realtime channel can disconnect on iOS backgrounding**. Acceptable for v1; reconnects on resume.
- **Scores derive live, not from a cache/Context.** HQ (`app/(tabs)/index.tsx`) computes engine + Titan scores via `useMemo` over `useAllTasks` + `useAllCompletionsForDate` (`lib/scoring.ts` — the canonical display-score model). This is *why* a stale-Context bug (which the web Dashboard once had) can't happen here — keep score reads derived from live query data, never stored in a provider.
- **Migrator self-heal**: `src/db/sqlite/migrator.ts` treats "duplicate column"/"already exists" as already-applied (`isAlreadyAppliedError`) so a half-applied migration on a device doesn't brick boot. Don't remove it; expo-sqlite devices hit this.
