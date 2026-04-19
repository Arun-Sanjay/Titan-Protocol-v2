# Titan Protocol — Android App

> Mobile-first gamified "personal OS" app. Expo SDK 55, RN 0.83, React 19, Hermes + New Architecture. Ship target: Google Play (freemium, solo dev).
>
> **Architecture: Local-only. Cloud is a manual opt-in backup, nothing more.**
> Every screen reads and writes SQLite. The UI never touches the network for normal operation. A "Backup to Cloud" / "Restore from Cloud" pair in the Profile tab lets the user snapshot to Supabase and pull back on another device.

---

## 1. Architecture — Local-only, manual cloud

SQLite is the only store the app reads and writes during normal use.
There is no background sync. There is no automatic push after a mutation.
There is no automatic pull on sign-in or app resume.

```
Component → useXxx() hook → xxxService.ts → SQLite  (the whole story)
```

Manual cloud operations:

```
Profile tab "Backup to Cloud"  → backupToCloud()  → Supabase (upsert all rows)
Profile tab "Restore from Cloud" → restoreFromCloud() → wipe local + pull all rows
```

**MMKV is for device-local preferences:**
- Sound/voice toggle
- Dev flags (dev_day_offset)
- Story flags (cinematic played state)
- UI mode (titan/focus)
- Theme preferences
- Last-backup timestamp (display only)

**SQLite is for user data** (42 tables — tasks, habits, completions, profile, everything).

**Supabase is for auth + the manual backup/restore target**. No calls from the critical path.

---

## 2. Tech Stack

| Area | Package | Version |
|---|---|---|
| Runtime | `expo` | `~55.0.12` |
| | `react-native` | `0.83.4` |
| | `react` | `19.2.0` |
| Routing | `expo-router` | `~55.0.11` |
| Language | `typescript` | `5.9` strict |
| Local DB | `expo-sqlite` | `~55.0.15` |
| Query cache | `@tanstack/react-query` | `^5.96.2` (in-memory de-dup only) |
| Cloud client | `@supabase/supabase-js` | `^2.101` (auth + manual backup only) |
| Local prefs | `react-native-mmkv` | `^4.3` |
| Session store | `@react-native-async-storage/async-storage` | `2.2` |
| Animation | `react-native-reanimated` | `4.2.1` |
| Gestures | `react-native-gesture-handler` | `~2.30` |
| Canvas | `@shopify/react-native-skia` | `2.4.18` |
| Lists | `@shopify/flash-list` | `2.0.2` |
| Validation | `zod` | `^4.3` |
| Tests | `jest` + `jest-expo`, `better-sqlite3` (in-memory SQLite for tests) |

No NativeWind, no styled-components, no Redux, no SWR, no query-client persister, no sync engine.

---

## 3. Data stores

**Local (SQLite) — `titan.db`, 42 tables, schema in `src/db/sqlite/migrations/001_initial.sql`.**
Every table carries `_deleted` (soft-delete tombstone) and `_dirty` (legacy column, ignored in local-only mode). Once the cloud sync tombstone model matures we can wire `_dirty` back in; until then writes just clear both to 0.

**Supabase — `rmvodrpgaffxeultskst` (region `ap-south-1`).**
Schema matches SQLite 1:1 minus the housekeeping columns. Only touched by:
- Auth (`supabase.auth.signIn*` / `signOut` / `getSession`)
- Manual backup (`src/sync/backup.ts`)
- Manual restore (`src/sync/restore.ts`)
- Account deletion (`src/services/account.ts`)

Schema changes: apply migration to Supabase via MCP, mirror the DDL in a new file under `src/db/sqlite/migrations/NNN_*.sql`, add it to `migrations/index.ts`. Don't edit an already-shipped migration.

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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function deleteXxx(id: string): Promise<void> {
  await sqliteDelete("xxx", { id });
}
```

### Partial update pattern
`sqliteUpsert` writes full rows. Partial updates read-merge-write:
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
- Writes are SQLite only. There is no enqueue, no push, no background side-effect. The function returns when SQLite has the row.
- Query keys are **tuple-typed** with `as const`.
- **Never** read or write MMKV for user data.
- New table? It must appear in `COLUMN_TYPES` (`src/db/sqlite/column-types.ts`) and `PRIMARY_KEYS` (`src/sync/tables.ts`). Backup/restore iterate those maps.

---

## 5. Golden Rules

1. **SQLite is authoritative.** The only places that may import `supabase.from(...)` are:
   `src/sync/backup.ts`, `src/sync/restore.ts`, `src/services/account.ts` (server cascade delete).
2. **Auth is the only other network activity.** `src/lib/supabase.ts`, `src/stores/useAuthStore.ts`, and login screens may call `supabase.auth.*`.
3. **Mutations are synchronous to the user.** `sqliteUpsert` completes at SQLite latency (~1ms). No side-effects after the return.
4. **`enabled: Boolean(userId)`** on every query hook.
5. **Every `withRepeat(-1)` has `cancelAnimation()` in cleanup.** Prevents Reanimated OOM on Android.
6. **Android shadows only via `theme/shadows.ts`.**
7. **No inline hex/rgba.** Use `colors.*` from `theme/colors.ts`.
8. **Dates via `lib/date.ts`.** Never `.toISOString().slice(0,10)` — not DST-safe.
9. **Batch inserts** via `sqliteUpsertMany` not N individual `sqliteUpsert` calls.
10. **Auth store is the single auth source.** Login screens update it directly via `useAuthStore.setState()`.

---

## 6. File Structure

```
titan-android/
├── app/                     Expo Router screens
│   ├── _layout.tsx          Root — fonts, DB migration, auth gate, overlays
│   ├── (auth)/              Login, signup, verify, email-login
│   ├── (tabs)/              HQ, engines, track, hub, profile
│   ├── (modals)/            add-task modal
│   ├── hub/                 Sub-trackers
│   ├── engine/[id].tsx      Per-engine mission detail
│   └── protocol.tsx         Morning/evening session
├── src/
│   ├── components/
│   │   ├── ui/              46 primitives
│   │   ├── v2/              Onboarding, story cinematics, celebrations
│   │   ├── CloudBackupSection.tsx   Backup/Restore buttons (Profile tab)
│   │   └── SyncingScreen.tsx        Modal overlay for backup/restore progress
│   ├── services/            SQLite-first service functions (25 files)
│   ├── hooks/queries/       React Query hooks (one per service)
│   ├── db/sqlite/           client.ts, migrator.ts, coerce.ts,
│   │                          service-helpers.ts, column-types.ts, migrations/
│   ├── sync/
│   │   ├── backup.ts        Manual upload to Supabase
│   │   ├── restore.ts       Manual pull + wipe-and-replace
│   │   └── tables.ts        SYNCED_TABLES + PRIMARY_KEYS
│   ├── lib/                 Pure business logic (scoring, ranks, dates, audio)
│   ├── db/                  gamification.ts, schema.ts, storage.ts (MMKV)
│   ├── data/                Static JSON
│   ├── theme/               colors, typography, spacing, shadows
│   ├── types/               supabase.ts
│   └── __tests__/           Jest tests (pure + service integration)
├── assets/audio/protocol/   138 voice-line MP3s
├── android/                 Native Android project
└── .claude/                 Claude Code config, skills
```

---

## 7. Commands

```bash
npm run start              # expo start
npm run android            # expo run:android
npm test                   # jest (service + coerce tests)
npx tsc --noEmit           # typecheck
```

**Supabase project ref:** `rmvodrpgaffxeultskst`
**Signing key:** `titan-release.jks` — do NOT regenerate.

**Archive of the pre-migration Supabase-first architecture:**
- Git tag `archive/supabase-first-v1` on GitHub
- Local directory `~/Documents/Projects/titan-android-archive-supabase-2026-04-18/`
