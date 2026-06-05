# Titan Protocol — Android App (Classic)

> Mobile-first gamified "personal OS" app. Expo SDK 55, RN 0.83, React 19, Hermes + New Architecture. Ship target: Google Play (freemium, solo dev). **This is the original standalone APK — renamed "Titan Protocol Classic" at SaaS launch (bundle id `com.titan.protocol` → `com.titan.protocol.classic`). It is NOT part of the SaaS sync ecosystem.**
>
> **Architecture: Local-only. Cloud is a manual opt-in backup, nothing more.**
> Every screen reads and writes SQLite. The UI never touches the network for normal operation. A "Backup to Cloud" / "Restore from Cloud" pair in the Profile tab lets the user snapshot to Supabase and pull back on another device.
>
> **Status:** Android is shipping and stable, and this codebase stays frozen on the local-first architecture. ⚠️ The SaaS frontends (`../web/` and `../mobile-saas/`) are now **hybrid cloud-first** — Supabase is their source of truth, SQLite a cache, Realtime keeps it fresh. Do NOT copy their `cloudUpsert`/Realtime patterns here. See `../CLAUDE.md` for the two-architecture split and `../ROADMAP.md` for the migration record.

---

## 1. Architecture — Local-only, manual cloud

SQLite is the only store the app reads and writes during normal use.
There is no background sync. There is no automatic push after a mutation.
There is no automatic pull on sign-in or app resume.

```
Component → useXxx() hook → xxxService.ts → SQLite  (the whole story)
```

Manual cloud operations (Profile tab):

```
"Backup to Cloud"    → backupToCloud()    → Supabase (upsert all rows in batches of 500)
"Restore from Cloud" → restoreFromCloud() → wipe local SQLite, pull all rows paginated
```

**MMKV is for device-local preferences only:**
- Sound/voice toggle
- Dev flags (`dev_day_offset`)
- Story/cinematic played flags
- UI mode (titan/focus)
- Theme preferences
- Last-backup timestamp (display only)

**SQLite is for user data** (42 tables — tasks, habits, completions, profile, gym, nutrition, money, etc.).

**Supabase is for auth + the manual backup/restore target.** No calls from the critical path.

**`@titan/shared` is NOT a dependency of this app.** Mobile used to consume it during the Supabase-first era; the local-first migration severed it entirely. Zero imports from `@titan/shared/*`.

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
| Cloud client | `@supabase/supabase-js` | `^2.101.1` (auth + manual backup only) |
| Local prefs | `react-native-mmkv` | `^4.3.0` |
| Session store | `@react-native-async-storage/async-storage` | `2.2.0` |
| Animation | `react-native-reanimated` | `4.2.1` |
| Worklets | `react-native-worklets` | `0.7.2` (auto-applied by babel-preset-expo) |
| Gestures | `react-native-gesture-handler` | `~2.30.0` |
| Canvas | `@shopify/react-native-skia` | `2.4.18` |
| Lists | `@shopify/flash-list` | `2.0.2` |
| Auth OAuth | `expo-auth-session` | `~55.0.13` |
| Validation | `zod` | `^4.3.6` |
| State | `zustand` | `^5.0.12` |
| Errors | `@sentry/react-native` | `~7.11.0` |
| Analytics | `posthog-react-native` | `^4.41.1` |
| Tests | `jest` + `jest-expo`, `better-sqlite3` (in-memory SQLite for tests) |

No NativeWind, no styled-components, no Redux, no SWR, no query-client persister, no sync engine, no `@titan/shared`.

---

## 3. Data stores

**Local (SQLite) — `titan.db`, 42 user-facing tables + 1 housekeeping (`schema_migrations`), schema in `src/db/sqlite/migrations/001_initial.sql`.**
Every user table carries `_deleted` (soft-delete tombstone) and `_dirty` (legacy column, ignored in local-only mode). Writes just clear both to 0.

The 42 user-facing tables:

```
achievements_unlocked, boss_challenges, budgets, completions,
deep_work_logs, deep_work_sessions, deep_work_tasks,
field_op_cooldown, field_ops, focus_sessions, focus_settings,
goals, gym_exercises, gym_personal_records, gym_sessions, gym_sets, gym_templates,
habit_logs, habits, journal_entries, meal_logs, mind_training_results,
money_loans, money_transactions, narrative_entries, narrative_log,
nutrition_profile, profiles, progression, protocol_sessions,
quests, quick_meals, rank_up_events, skill_tree_progress, sleep_logs,
srs_cards, subscriptions, tasks, titan_mode_state,
user_titles, water_logs, weight_logs
```

That's 42 user-facing tables. One additional housekeeping table lives on disk:
- `schema_migrations` — created by `migrator.ts` on first boot, tracks applied migration IDs.

Legacy tables (`pending_mutations`, `sync_meta`) were dropped by migration `002_drop_legacy_sync_tables` (2026-04-23). Migration `003_add_expo_push_token` (2026-05-26) added `profiles.expo_push_token` to keep this app's schema readable when restoring a cloud backup written by the SaaS apps.

**3 migrations total**, registered in `src/db/sqlite/migrations/index.ts`: `001_initial`, `002_drop_legacy_sync_tables`, `003_add_expo_push_token`.

Composite-PK tables (multi-column PRIMARY KEY) are only **two**: `srs_cards` (`user_id, exercise_id`) and `user_titles` (`user_id, title_id`). The other per-user singletons — `field_op_cooldown`, `focus_settings`, `nutrition_profile`, `progression`, `subscriptions`, `titan_mode_state` — use a **single-column `user_id` PRIMARY KEY**, not a composite. (`PRIMARY_KEYS` in `src/sync/tables.ts` is the source of truth.)

**Supabase — `rmvodrpgaffxeultskst` (region `ap-south-1`).**
Schema matches SQLite 1:1 minus the housekeeping columns. Touched by:
- Auth (`supabase.auth.signIn*` / `signOut` / `getSession`)
- Manual backup (`src/sync/backup.ts`)
- Manual restore (`src/sync/restore.ts`)
- Account deletion (`src/services/account.ts` — server cascade delete)

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
6. **Android shadows only via `theme/shadows.ts`.** Caps elevation at 2 for panels, 0 for rows. Never raw `elevation: N`.
7. **No inline hex/rgba.** Use `colors.*` from `theme/colors.ts`.
8. **Dates via `lib/date.ts`.** Never `.toISOString().slice(0,10)` — not DST-safe.
9. **Batch inserts** via `sqliteUpsertMany` not N individual `sqliteUpsert` calls.
10. **Auth store is the single auth source.** Login screens update it directly via `useAuthStore.setState()`.
11. **No `@titan/shared` imports.** The mobile app is deliberately self-contained — don't re-introduce the dependency.

---

## 6. File Structure

```
mobile/
├── app/                     Expo Router screens (~41 route screens, excl. layouts)
│   ├── _layout.tsx          Root — fonts, DB migration, auth gate, overlays
│   ├── (auth)/              login, email-login, signup, verify (+ layout)
│   ├── (tabs)/              HQ (index), engines, track, hub, profile (+ layout)
│   ├── (modals)/            add-task, achievement-popup, boss-challenge,
│   │                        perfect-day, phase-transition, titan-unlock
│   ├── hub/                 analytics, budgets, cashflow, command, deep-work,
│   │                        focus, nutrition, settings, sleep, weight, workouts
│   ├── engine/[id].tsx      Per-engine mission detail
│   ├── field-op/[id].tsx    Per-field-op detail
│   ├── skill-tree/          index + [engine]
│   ├── protocol.tsx         Morning/evening session
│   ├── field-ops.tsx, achievements.tsx, mind-training.tsx, narrative.tsx,
│   ├── quests.tsx, status.tsx, titles.tsx, tutorial.tsx, walkthrough.tsx,
│   ├── war-room.tsx
│   └── +not-found.tsx
├── src/
│   ├── components/
│   │   ├── ui/              48 primitives (Panel, Card, Gauges, Charts, etc.)
│   │   ├── v2/              ~92 files — onboarding beats, 18 day cinematics,
│   │   │                    celebrations, walkthrough, skill tree,
│   │   │                    progression, quests, mind-training, narrative,
│   │   │                    identity, habits, achievements
│   │   ├── AppResumeSyncMount.tsx    Invalidates queries on app resume
│   │   ├── CloudBackupSection.tsx    Backup/Restore buttons (Profile tab)
│   │   ├── OnboardingGate.tsx        Gates app until onboarding complete
│   │   ├── ProfileHydrator.tsx       Hydrates auth store on boot
│   │   ├── RankUpOverlayMount.tsx    Rank-up celebration overlay
│   │   └── SyncingScreen.tsx         Full-screen backup/restore progress modal
│   ├── services/            26 SQLite-first service files
│   ├── hooks/queries/       25 React Query hooks (account has no hook)
│   ├── stores/              9 Zustand stores (auth + UI state only)
│   ├── db/sqlite/           client.ts, migrator.ts, coerce.ts,
│   │                        service-helpers.ts, column-types.ts, migrations/
│   ├── sync/
│   │   ├── backup.ts        Manual upload to Supabase
│   │   ├── restore.ts       Manual wipe-and-pull from Supabase
│   │   └── tables.ts        PULL_ORDER, PRIMARY_KEYS, TABLE_QUERY_KEY_ROOTS
│   ├── lib/                 Pure business logic (scoring, ranks, dates, audio)
│   ├── db/                  gamification.ts (RANKS/DAILY_RANKS), schema.ts,
│   │                        storage.ts (MMKV wrapper)
│   ├── data/                Static JSON + local-only data (chapters,
│   │                        protocol-messages, achievements, bosses, etc.)
│   ├── theme/               colors, typography, spacing, shadows
│   ├── types/               supabase.ts (generated types)
│   └── __tests__/           Jest tests — services/habits, services/profile,
│                            services/tasks, sync/coerce + in-memory SQLite fake
├── assets/audio/protocol/   138 voice-line MP3s
├── android/                 Native Android project (signing: titan-release.jks)
├── docs/                    google-oauth-setup, MIGRATION_LOCAL_FIRST,
│                            PHASE_6_VALIDATION, play-store-listing,
│                            privacy-policy.html, v1-launch-handoff
└── .claude/                 Claude Code config (settings, hooks, titan-dev skill)
```

---

## 7. Zustand Stores

The ONE auth store plus eight UI-only stores. None hold user data.

| Store | Role | Persistence |
|---|---|---|
| `useAuthStore` | Session, user, onAuthStateChange, AppState resume refresh | AsyncStorage |
| `useAchievementStore` | Popup queue | memory |
| `useEngineStore` | Current-engine selection | memory |
| `useIdentityStore` | Archetype selection | memory |
| `useModeStore` | Titan/Focus mode toggle | MMKV |
| `useOnboardingStore` | Onboarding flow state | MMKV |
| `useStoryStore` | Cinematic played flags (day1_played, day2_played, …) | MMKV |
| `useSurpriseStore` | Surprise system state | memory |
| `useWalkthroughStore` | Walkthrough progress | MMKV |

---

## 8. Commands

```bash
npm run start              # expo start
npm run android            # expo run:android
npm run ios                # expo run:ios
npm run typecheck          # tsc --noEmit
npm test                   # jest (service + coerce tests)
npm run test:watch         # jest --watch
npm run prebuild           # tsc --noEmit && jest — gate before EAS build
```

**Supabase project ref:** `rmvodrpgaffxeultskst`
**Signing key:** `titan-release.jks` — do NOT regenerate.
**Version:** 1.0.0 (package.json); versionCode/versionName bumped via CI `-PTITAN_VERSION_CODE=N -PTITAN_VERSION_NAME=x.y.z`.

---

## 9. Archive

Pre-migration Supabase-first architecture:
- Git tag `archive/supabase-first-v1` on GitHub
- Local directory `~/Documents/Projects/titan-android-archive-supabase-2026-04-18/`

See `docs/MIGRATION_LOCAL_FIRST.md` for the migration record.

---

## 10. Known Debt (open)

Kept here so future sessions don't re-discover these. Closed items live in git history.

- **Tombstones don't upload on backup.** `src/sync/backup.ts:75` filters `WHERE _deleted = 0`, so a deletion on Device A never propagates to Device B on restore. Fine for a single-device user; fix before multi-device ships. Recommended: after the upserts, issue `.delete().in('id', deadIds)` per table and then hard-purge locally (web's `sync/backup.ts` already does this — port back).
- **Streak MMKV/SQLite duality.** `app/_layout.tsx:349` reads streak from MMKV (`protocol_streak`) because the layout sits above `<QueryClientProvider>`. `profiles.streak_current` is the authoritative store. They can drift. Fix when touching streak math.
- **Hook key convention inconsistency.** ~11 hooks use table-name keys (`["achievements_unlocked"]`, `["rank_ups","pending"]`) while others use short roots (`["habits"]`, `["tasks"]`). Non-functional, but a sweep would standardize.
- **Stale doc comment in `src/db/storage.ts:14`** — pre-migration text claiming user data belongs in Supabase. Reword next time you're in that file.

Lint guards in `src/__tests__/lint/forbidden-patterns.test.ts` enforce: no `.toISOString().slice(0,10)` (use `lib/date.ts`) and no raw `elevation:` outside `theme/shadows.ts`. Both gate `npm run prebuild`.
