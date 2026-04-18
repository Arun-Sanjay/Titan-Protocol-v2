# Titan Protocol — Android App

> Mobile-first gamified "personal OS" app. Expo SDK 55, RN 0.83, React 19, Hermes + New Architecture. Ship target: Google Play (freemium, solo dev).
>
> **Architecture: Local-first.** Every screen reads from SQLite via typed service functions. Mutations write SQLite first and enqueue to an outbox; a background sync engine pushes to Supabase and pulls remote changes. The UI never awaits the network.

---

## 1. Architecture — Local-first

SQLite is the source of truth for the UI. Supabase is the eventually-consistent backup + cross-device sync channel. Auth still lives on Supabase.

```
Component → useXxx() hook → xxxService.ts → SQLite (authoritative)
                                              │
                                              ▼
                                      pending_mutations (outbox)
                                              │
                                              ▼
                                       Sync engine (push + pull)
                                              │
                                              ▼
                                         Supabase (cloud mirror)
```

- **Reads** come from SQLite via `sqliteList` / `sqliteGet`.
- **Writes** go through `sqliteUpsert` / `sqliteDelete` (service-helpers), which
  (1) write SQLite with `_dirty=1`, (2) INSERT a mutation row in `pending_mutations`,
  (3) schedule a debounced push. The call returns at SQLite latency (~1ms).
- **Sync engine** (`src/sync/engine.ts`) runs on AppState active, NetInfo
  reconnect, every 60s, and after each mutation (debounced 500ms). Push drains
  the outbox; pull fetches `updated_at > cursor` per table and merges with
  last-write-wins.
- **Initial seed** (`src/sync/seed.ts`) runs on first sign-in on a device. The
  `SeedGate` component blocks the dashboard until every table is populated.

**MMKV is ONLY for device-local preferences:**
- Sound/voice toggle
- Dev flags (dev_day_offset)
- Story flags (cinematic played state)
- UI mode (titan/focus)
- Theme preferences

**Synced user data → SQLite + outbox. Device-only preferences → MMKV.**

---

## 2. Tech Stack

| Area | Package | Version |
|---|---|---|
| Runtime | `expo` | `~55.0.12` |
| | `react-native` | `0.83.4` |
| | `react` | `19.2.0` |
| Routing | `expo-router` | `~55.0.11` |
| Language | `typescript` | `5.9` strict |
| Local DB | `expo-sqlite` | `~55.0.15` (primary data store) |
| Query cache | `@tanstack/react-query` | `^5.96.2` (in-memory de-dup only) |
| Cloud client | `@supabase/supabase-js` | `^2.101` (sync engine + auth) |
| Local prefs | `react-native-mmkv` | `^4.3` (device-local only) |
| Session store | `@react-native-async-storage/async-storage` | `2.2` |
| Animation | `react-native-reanimated` | `4.2.1` |
| Gestures | `react-native-gesture-handler` | `~2.30` |
| Canvas | `@shopify/react-native-skia` | `2.4.18` |
| 3D | `@react-three/fiber` `^9.5` + `three` `^0.183` |
| Lists | `@shopify/flash-list` | `2.0.2` |
| Validation | `zod` | `^4.3` |
| Audio | `expo-av` `^16.0.8` + `expo-speech` `~55` |
| Fonts | `@expo-google-fonts/jetbrains-mono` |
| Tests | `jest` + `jest-expo`, plus `better-sqlite3` in tests (in-memory SQLite shim) |

No NativeWind, no styled-components, no Redux, no SWR, no query-client persister.

---

## 3. Data stores

**Local (SQLite) — `titan.db`, 42 tables, schema in `src/db/sqlite/migrations/001_initial.sql`.**
Every synced user-data table has `_dirty` and `_deleted` housekeeping columns.
Two SQLite-only support tables: `pending_mutations` (outbox) and `sync_meta`
(per-table pull cursors).

**Supabase — `rmvodrpgaffxeultskst` (region `ap-south-1`).**
42 tables with RLS enabled. Schema matches SQLite 1:1 minus the `_dirty`/`_deleted`
columns. Auth still handled here (`onAuthStateChange`, token refresh).

Schema changes: apply migration to Supabase via MCP, then mirror the DDL in a
new file under `src/db/sqlite/migrations/NNN_*.sql` and add it to
`migrations/index.ts`. Don't edit an already-shipped migration.

---

## 4. Data Layer Pattern (for every new feature)

### Service (`src/services/xxx.ts`)
```typescript
import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteList,
  sqliteGet,
  sqliteUpsert,
  sqliteDelete,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

export type Xxx = Tables<"xxx">;

export async function listXxx(): Promise<Xxx[]> {
  return sqliteList<Xxx>("xxx", { order: "created_at ASC" });
}

export async function createXxx(input: { title: string }): Promise<Xxx> {
  const userId = await requireUserId();
  return sqliteUpsert("xxx", {
    id: newId(),
    user_id: userId,
    title: input.title,
    // ...every other Row field (nullable ones = null)
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function deleteXxx(id: string): Promise<void> {
  await sqliteDelete("xxx", { id });
}
```

### Partial update pattern
`sqliteUpsert` writes full rows (to keep row state internally consistent).
Partial updates read-merge-write:
```typescript
const existing = await sqliteGet<Xxx>("xxx", { id });
if (!existing) throw new Error("Not found");
return sqliteUpsert("xxx", { ...existing, title: "new title" });
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
- Services **throw** on error (SQLite errors propagate cleanly).
- Mutations can still be optimistic for zero-perceived-lag, but the underlying
  write is already ~1ms — optimistic is a nicety, not a requirement.
- Query keys are **tuple-typed** with `as const`, starting with the table name
  so the sync engine's pull-invalidate matches them.
- **Never** read from or write to MMKV for user data.
- Adding a new table? It **must** appear in both `COLUMN_TYPES`
  (`src/db/sqlite/column-types.ts`) and `PRIMARY_KEYS` / `TABLE_QUERY_KEY_ROOTS`
  (`src/sync/tables.ts`). Otherwise the sync engine will skip it.

---

## 5. Golden Rules

1. **SQLite is authoritative.** Never call `supabase.from(...)` outside of the
   sync engine (`src/sync/push.ts`, `src/sync/pull.ts`), account deletion
   (`src/services/account.ts`), or the auth store's own flow.
2. **Services throw, hooks catch.** Service functions throw; hooks handle via
   mutation callbacks.
3. **Every mutation writes SQLite + enqueues the outbox.** Use `sqliteUpsert` /
   `sqliteDelete` — they enforce this.
4. **`enabled: Boolean(userId)`** on every query. Prevents queries firing before
   the auth store hydrates.
5. **Every `withRepeat(-1)` has `cancelAnimation()` in cleanup.** Prevents
   Reanimated OOM on Android.
6. **Android shadows only via `theme/shadows.ts`.** Caps elevation to prevent
   GPU compositor OOM.
7. **No inline hex/rgba.** Use `colors.*` from `theme/colors.ts`.
8. **Dates via `lib/date.ts`.** Never `.toISOString().slice(0,10)` — not DST-safe.
9. **Batch inserts for onboarding.** Use `sqliteUpsertMany("x", rows)`, not N
   individual `sqliteUpsert` calls.
10. **Auth store is the single auth source.** Login screens update it directly
    via `useAuthStore.setState()` for instant redirect.

---

## 6. File Structure

```
titan-android/
├── app/                     Expo Router screens
│   ├── _layout.tsx          Root layout — fonts, DB migration, auth gate,
│   │                          SeedGate, SyncEngineMount, overlay orchestration
│   ├── (auth)/              Login, signup, verify, email-login
│   ├── (tabs)/              HQ, engines, track, hub, profile
│   ├── (modals)/            add-task modal
│   ├── hub/                 Sub-trackers (workout, sleep, budget, etc.)
│   ├── engine/[id].tsx      Per-engine mission detail
│   ├── protocol.tsx         Morning/evening session
│   └── dev-sync.tsx         Dev-only sync debugger
├── src/
│   ├── components/
│   │   ├── ui/              46 primitives (Panel, MissionRow, XPBar, etc.)
│   │   ├── v2/              Onboarding, story cinematics, celebrations
│   │   ├── SeedGate.tsx     Blocks UI until first-install seed completes
│   │   ├── SyncingScreen.tsx  Seed progress UI
│   │   └── SyncEngineMount.tsx  Starts/stops sync on auth change
│   ├── services/            Typed SQLite-first service functions (25 files)
│   ├── hooks/queries/       React Query hooks (one per service)
│   ├── db/sqlite/           client.ts, migrator.ts, coerce.ts,
│   │                          service-helpers.ts, column-types.ts,
│   │                          migrations/
│   ├── sync/                outbox, push, pull, engine, seed, tables,
│   │                          backoff, errors, store
│   ├── lib/                 Pure business logic (scoring, ranks, dates, audio)
│   ├── db/                  gamification.ts, schema.ts, storage.ts (MMKV)
│   ├── data/                Static JSON (achievements, bosses, quests, titles)
│   ├── theme/               colors, typography, spacing, shadows
│   ├── types/               supabase.ts (auto-generated)
│   └── __tests__/           Jest tests (sync layer + services)
├── assets/audio/protocol/   138 voice-line MP3s
├── android/                 Native Android project (tracked)
├── docs/MIGRATION_LOCAL_FIRST.md   Migration plan (phase-by-phase)
└── .claude/                 Claude Code config, skills
```

---

## 7. Commands

```bash
npm run start              # expo start
npm run android            # expo run:android
npm test                   # jest (sync engine + service tests)
npx tsc --noEmit           # typecheck
```

**Supabase project ref:** `rmvodrpgaffxeultskst`
**Signing key:** `titan-release.jks` — do NOT regenerate.

**Dev sync debugger:** push `/dev-sync` to inspect the outbox, cursors,
and trigger manual push/pull/full-refresh.

**Archive of the pre-migration Supabase-first architecture:**
- Git tag `archive/supabase-first-v1` on GitHub
- Local directory `~/Documents/Projects/titan-android-archive-supabase-2026-04-18/`
- RESTORE.md inside that directory explains how to roll back if needed.
