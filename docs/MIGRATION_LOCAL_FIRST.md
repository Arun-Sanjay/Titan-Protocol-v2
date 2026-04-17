# Local-First Migration — Detailed Plan

> **Status:** DRAFT — awaiting approval before implementation begins.
> **Archive point:** git tag `archive/supabase-first-v1` (commit `e4c5b38`)
> also at `~/Documents/Projects/titan-android-archive-supabase-2026-04-18/`.
> **Target branch:** `local-first` (branched from `main`). `main` stays on
> Supabase-first until the migration is verified.

---

## 1. Goal

Invert the data-layer authority. SQLite becomes the single source of
truth for the UI; Supabase becomes an eventually-consistent backup +
cross-device sync channel. UI never awaits the network. Auth stays on
Supabase.

## 2. Why this solves the current bugs

The tap-lag, 5-tap-register, mid-interaction sign-out issues all trace
to the same mechanism: `supabase-js`'s `SupabaseClient._getAccessToken`
runs on every PostgREST request and internally calls `auth.getSession()`,
which refreshes the token when `expires_at − Date.now() < 90_000 ms`.
With any device clock skew (even a couple of minutes), every user
action fires a refresh; sequential actions produce a cascade that
eventually hits the 429 rate-limit on `/token`, at which point
`supabase-js` clears the session and emits `SIGNED_OUT`. Moving the
authority to SQLite removes auth + network from the per-tap path
entirely — the cascade can't start because no PostgREST requests fire
during normal interaction.

## 3. Architecture

```
 ┌────────────────────────────────────────────────────────────┐
 │                         UI LAYER                            │
 │  Screens, overlays, cinematics — React + Reanimated + Skia │
 └────────────────────────────────────────────────────────────┘
                           │          ▲
                           ▼          │ subscribe / invalidate
 ┌────────────────────────────────────────────────────────────┐
 │               REACT QUERY HOOKS (unchanged shape)           │
 │   useTasks, useHabits, useProfile … queryFn hits SQLite    │
 └────────────────────────────────────────────────────────────┘
                           │          ▲
                           ▼          │
 ┌────────────────────────────────────────────────────────────┐
 │                   SERVICE LAYER (inverted)                  │
 │  listX() → SQLite SELECT                                    │
 │  createX() / updateX() / deleteX() →                        │
 │      1. SQLite write (authoritative)                        │
 │      2. INSERT into pending_mutations (outbox)              │
 │      3. return — no await on network                        │
 └────────────────────────────────────────────────────────────┘
                           │                  ▲
                           │                  │ SQLite writes from pull
                           ▼                  │
 ┌────────────────────────────────────────────────────────────┐
 │                       SQLite (local)                        │
 │  27 tables, mirrors Supabase schema 1:1 + _dirty + _deleted │
 │  + pending_mutations (outbox) + sync_meta (cursors)         │
 └────────────────────────────────────────────────────────────┘
                           ▲                  │
                           │                  ▼
                  ┌──────────────────────────────────┐
                  │          SYNC ENGINE              │
                  │  push loop · pull loop · backoff  │
                  │  triggered: foreground, mutation, │
                  │  network-up, manual, 60s interval │
                  └──────────────────────────────────┘
                           ▲                  │
                           │                  ▼
 ┌────────────────────────────────────────────────────────────┐
 │                   Supabase (cloud mirror)                   │
 │   27 tables, RLS unchanged, source of cross-device truth    │
 └────────────────────────────────────────────────────────────┘
```

## 4. Technology choices

| Decision | Choice | Rationale |
|---|---|---|
| Local DB engine | `expo-sqlite@~15` | Structured queries, indexes, transactions; scales to 100k+ rows; shipped by Expo (no native config). Alternative (JSON-in-MMKV) would force in-memory filtering for every query. |
| Device-local prefs | Keep MMKV | Already installed; right tool for key/value (sound toggle, dev_day_offset, first_launch_seen, ui_mode). Not worth porting. |
| ID generation | `expo-crypto.randomUUID()` | Supabase accepts client-provided UUIDs in upserts — no round-trip needed for PK. |
| Conflict resolution | Last-write-wins by `updated_at` | Single user across their own devices; concurrent conflicts ~zero. Spending complexity on CRDTs would be theatre. |
| Realtime updates | No WebSocket | Pull on foreground + after local mutation (debounced) is enough. Can add Supabase Realtime later for <3s cross-device convergence if it becomes a felt need. |
| Schema source-of-truth | Supabase migrations (via MCP) | One place to change the schema. SQLite migrations are generated from it. |

## 5. Schema changes

Two extra columns added to **every synced table**:
```sql
_dirty    INTEGER NOT NULL DEFAULT 0  -- 1 = local changes not yet pushed
_deleted  INTEGER NOT NULL DEFAULT 0  -- 1 = soft-deleted, push will DELETE from Supabase
```
These columns exist ONLY in SQLite, not in Supabase. They never leave
the device.

Two new SQLite-only tables:
```sql
CREATE TABLE pending_mutations (
  id           TEXT PRIMARY KEY,          -- uuid
  table_name   TEXT NOT NULL,
  row_id       TEXT NOT NULL,             -- the id of the row being mutated
  op           TEXT NOT NULL CHECK(op IN ('upsert','delete')),
  payload      TEXT NOT NULL,             -- JSON of the row (for upsert) or {id} for delete
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  next_attempt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sync_meta (
  table_name     TEXT PRIMARY KEY,
  last_pulled_at TEXT,                    -- ISO timestamp of most recent updated_at seen
  last_push_ok   TEXT,
  last_pull_ok   TEXT
);
```

Supabase schema stays exactly as-is. The existing `updated_at` column
(already on most tables via the `set_updated_at` trigger) drives pull
cursoring. Tables missing `updated_at` get it added in a single
Supabase migration (tables already have `created_at`).

## 6. Phase-by-phase plan

> **Branch:** create `local-first` off current `main`. All work below
> happens on that branch. `main` stays on Supabase-first until phase 6
> passes.

> **Commit discipline:** one commit per checked sub-step. Commit message
> format `migrate(phase-N): <what>`.

---

### Phase 0 — Foundation (≈ 4 hrs)

**Goal:** SQLite opens, migrations run, schema is in place. No app
behavior changes yet.

- [ ] **0.1** Branch: `git checkout -b local-first`.
- [ ] **0.2** Install: `npm i expo-sqlite@~15`. No native linking needed
  on Expo 55.
- [ ] **0.3** Create `src/db/sqlite/client.ts` — opens a single DB
  (`titan.db`), exposes `db`, `exec`, `all`, `get`, `run` helpers with
  prepared-statement support. Uses Expo's async API.
- [ ] **0.4** Create `src/db/sqlite/migrations/` directory. Each
  migration is numbered SQL + TS file. First migration: full DDL for
  all 27 tables, mirroring Supabase column types. Types listed below.
- [ ] **0.5** Create `src/db/sqlite/migrator.ts` — tracks
  `schema_migrations(id TEXT PK, applied_at TEXT)`, runs pending
  migrations in order inside a transaction, never re-applies.
- [ ] **0.6** Wire `runMigrations()` into app boot, BEFORE any hook
  fires a query. Add to `_layout.tsx` alongside font loading — render
  null until both fonts and DB are ready.
- [ ] **0.7** Add `src/db/sqlite/types.ts` — map the existing
  `types/supabase.ts` shapes to SQLite row shapes (same column names,
  TEXT for timestamps since SQLite has no native type).
- [ ] **0.8** Smoke test: boot app, `SELECT COUNT(*) FROM profiles` via
  a dev-only debug screen. Returns 0. Commit.

**Column-type mapping (for migration DDL):**
| Postgres | SQLite |
|---|---|
| `uuid` | `TEXT` (36-char uuid strings) |
| `text`, `varchar` | `TEXT` |
| `integer`, `bigint` | `INTEGER` |
| `real`, `double` | `REAL` |
| `boolean` | `INTEGER` (0/1) |
| `timestamptz` | `TEXT` (ISO 8601 UTC) |
| `jsonb`, `json` | `TEXT` (JSON string) |
| `array<T>` | `TEXT` (JSON string of array) |
| enums (`archetype`, `engine_key`, `app_mode`) | `TEXT` with `CHECK` constraint |

**Phase 0 success criteria:**
- App boots, DB file created at Expo filesystem path.
- `schema_migrations` has one row.
- Every table exists (verified via `sqlite_master`).
- No existing Supabase behavior is broken — hooks still read from
  Supabase because we haven't touched them yet.

**Phase 0 rollback:** `git checkout main`. No destructive changes.

---

### Phase 1 — Sync engine (≈ 6 hrs)

**Goal:** A working push/pull engine that can round-trip data between
SQLite and Supabase. Still no service-layer changes.

- [ ] **1.1** `src/sync/outbox.ts` — typed wrappers:
  - `enqueueUpsert(table, row)` — inserts into `pending_mutations`.
  - `enqueueDelete(table, rowId)` — marks row `_deleted=1`, enqueues a
    delete.
  - `markPushed(mutationId)` — removes from outbox, sets row `_dirty=0`.
  - `markFailed(mutationId, error)` — increments attempts, sets
    `next_attempt = now + exponential backoff`.
- [ ] **1.2** `src/sync/push.ts`:
  - Query: `SELECT * FROM pending_mutations WHERE next_attempt <= now() ORDER BY created_at LIMIT 20`.
  - For each: call Supabase (upsert or delete), under a `try/catch`.
  - On success: `markPushed`. On transient error (network, 5xx): `markFailed` with backoff. On auth error: bail out, let auth layer handle.
- [ ] **1.3** `src/sync/pull.ts`:
  - For each table: `SELECT * FROM <table> WHERE updated_at > <lastPulledAt> ORDER BY updated_at LIMIT 500`.
  - Apply rows into SQLite with `INSERT OR REPLACE`, preserving
    `_dirty` if local version is newer (compare `updated_at`).
  - Update `sync_meta.last_pulled_at` to the max `updated_at` seen.
- [ ] **1.4** `src/sync/engine.ts` — orchestrator:
  - `syncNow()` — one push round, one pull round, idempotent.
  - `startBackgroundSync()` — runs on:
    - App foreground (`AppState` → active).
    - Network reconnect (`NetInfo`).
    - Every 60 s while in foreground.
    - After every local mutation (debounced 500 ms).
  - Exposes `SyncStatus = 'idle' | 'syncing' | 'error'` via Zustand for
    UI (tiny indicator in status bar).
- [ ] **1.5** `src/sync/seed.ts` — full initial pull for first-time
  sign-in on a device: pulls every table in dependency order (profiles
  first, then everything else). Shows a "Syncing your protocol…" screen
  until complete.
- [ ] **1.6** Dev-only debug screen (`app/(dev)/sync.tsx`) showing
  outbox contents, sync status, per-table cursors, manual "push now" /
  "pull now" / "reset cursors" buttons.
- [ ] **1.7** Integration test (manual): insert 3 rows via SQL into
  SQLite, enqueue mutations, call `syncNow()`, verify they appear in
  Supabase. Delete one, call `syncNow()`, verify it's gone from
  Supabase.

**Phase 1 success criteria:**
- Round-trip works: SQLite → Supabase → SQLite.
- Offline: mutations queue, sync drains when network returns.
- Conflict case: remote row newer than local unmodified row → local
  updates. Local dirty row newer than remote → push wins.
- Backoff: offline for 1 min, 5 min, 1 hr — sync never retries in a
  tight loop.

**Phase 1 rollback:** delete `src/sync/`, no other code is importing it
yet.

---

### Phase 2 — Service layer inversion (≈ 1 day)

**Goal:** Every service function reads SQLite + enqueues to outbox.
This is where the app becomes local-first.

**Pattern for every service (example: `src/services/tasks.ts`):**

Before (Supabase-first):
```ts
export async function listTasks(): Promise<Task[]> {
  const { data, error } = await supabase.from('tasks').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function createTask(input: CreateTaskInput) {
  const { error } = await supabase.from('tasks').insert(input);
  if (error) throw error;
}
```

After (local-first):
```ts
import { db } from '@/db/sqlite/client';
import { enqueueUpsert, enqueueDelete } from '@/sync/outbox';
import { randomUUID } from 'expo-crypto';

export async function listTasks(): Promise<Task[]> {
  return db.all<Task>(
    `SELECT * FROM tasks WHERE _deleted = 0 AND user_id = ? ORDER BY created_at DESC`,
    [requireUserId()],
  );
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const row: Task = {
    id: randomUUID(),
    user_id: requireUserId(),
    ...input,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await db.run(
    `INSERT INTO tasks (id, user_id, title, engine, kind, is_active, created_at, updated_at, _dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [row.id, row.user_id, row.title, row.engine, row.kind, 1, row.created_at, row.updated_at],
  );
  await enqueueUpsert('tasks', row);
  return row;
}
```

**Order (fixes the highest-pain paths first):**

- [ ] **2.1** `tasks` + `completions` — the dashboard tap-lag path.
  This alone restores the "instant" feel.
- [ ] **2.2** `habits` + `habit_logs` — habit check-in is the next
  hottest path.
- [ ] **2.3** `profile` (XP, streaks, onboarding_completed, archetype)
  + `rank_up_events` + `progression`.
- [ ] **2.4** `protocol_sessions` — morning/evening protocol writes.
- [ ] **2.5** `budgets` + `money_transactions` + `loans`.
- [ ] **2.6** `journal_entries`.
- [ ] **2.7** `achievements` + `skill_progress`.
- [ ] **2.8** `titan_mode` + `titles` + `field_ops`.
- [ ] **2.9** Gym (`gym_sessions` + `gym_sets` + `gym_exercises` +
  `gym_templates` + `personal_records`), nutrition, sleep, weight.
- [ ] **2.10** `deep_work_tasks` + `deep_work_logs`, `focus_settings`,
  `mind_training_results`, `quests`, `boss_challenges`, `narrative_logs`.

**Per-domain checklist (apply for each 2.x):**
1. Rewrite `src/services/<domain>.ts` functions to SQLite + outbox.
2. Leave the React Query hooks (`src/hooks/queries/use<Domain>.ts`)
   untouched except for:
   - Remove `enabled: Boolean(userId)` guards where the service already
     handles the no-user case (optional cleanup).
   - Replace `.maybeSingle()` / PGRST116 error handling with SQLite
     semantics (the service already returns `null` if no row).
3. Delete dead code — optimistic rollback in mutations is no longer
   needed because SQLite writes are synchronous and the UI sees them
   immediately; the `onMutate / onError rollback` pattern can be
   simplified.
4. Smoke test the screens that use this domain.
5. Commit.

**Phase 2 success criteria:**
- Every dashboard tap is instant (SQLite write < 1 ms vs Supabase round
  trip 200–500 ms).
- App remains usable with Airplane Mode on.
- Outbox drains when network returns.

**Phase 2 rollback:** per-domain granularity. Each 2.x step is a
standalone commit; revert that commit to restore Supabase-first for
that domain while keeping local-first for the rest.

---

### Phase 3 — Initial seed & fresh-install flow (≈ 3 hrs)

**Goal:** First sign-in on a new device pulls all existing cloud data
into SQLite before showing the app.

- [ ] **3.1** On successful sign-in (from `useAuthStore` after
  `SIGNED_IN`), check `sync_meta` — if no row exists for any table, we
  haven't seeded yet.
- [ ] **3.2** Show `SyncingScreen` (new component in `src/components/`)
  — full-screen blocker with a progress indicator and "Syncing your
  protocol…" copy. Matches existing cinematic aesthetic.
- [ ] **3.3** `src/sync/seed.ts` `initialSeed(userId)`:
  - For each table, `pullAll(table)` (no cursor filter, all rows).
  - Write to SQLite with `_dirty=0`.
  - Update `sync_meta.last_pulled_at` to `now()`.
  - Ordered so FK-dependent tables come after parents (`profiles` → everything else; gym_sessions → gym_sets).
- [ ] **3.4** Only dismiss the SyncingScreen once seed completes.
- [ ] **3.5** Error path: if seed fails, show retry button; don't let
  user into dashboard with empty SQLite (they'd think their data was
  lost).

**Phase 3 success criteria:**
- Install on a 2nd device → sign in → all data appears after seed.
- Interrupting the seed (kill app mid-way) → next launch resumes from
  where it left off (or re-seeds — either is OK, seed is idempotent).

---

### Phase 4 — Auth simplification (≈ 2 hrs)

**Goal:** Remove defensive code that exists only because of the
pre-migration bugs.

- [ ] **4.1** `src/stores/useAuthStore.ts`:
  - Delete the `handleSignedOut` recovery path (added in e4c5b38). It
    was compensating for refresh cascades that can't happen once
    PostgREST isn't on the per-tap path.
  - Keep the `explicitSignOut` flag and the deferred `ensureProfileRow`.
  - Restore a simple `SIGNED_OUT` → clear state.
- [ ] **4.2** `src/lib/supabase.ts`:
  - Set `autoRefreshToken: true` but tune: `supabase-js` will only fire
    its 30 s ticker now, no per-request refreshes, so this is fine.
  - Consider disabling auto-refresh entirely and calling
    `refreshSession()` manually in the sync engine. Defer this
    decision; revisit if we still see spurious refresh activity.
- [ ] **4.3** `ensureProfileRow` — write via service layer (SQLite +
  outbox), not directly via `supabase.from('profiles').upsert(...)`.

**Phase 4 success criteria:**
- Sign in + complete onboarding + select all tasks + tap through
  dashboard for 60 s → no `SIGNED_OUT` events. Network tab shows no
  cascading `/token` calls.

---

### Phase 5 — Cleanup (≈ 2 hrs)

- [ ] **5.1** Remove `@tanstack/query-async-storage-persister` and
  `@tanstack/react-query-persist-client` — SQLite is the persistence
  layer now; React Query cache lives in memory only.
- [ ] **5.2** `src/lib/query-client.ts` — drop the persister, reduce
  `staleTime` to 0 (SQLite is already the cache; React Query just
  dedupes in-flight reads).
- [ ] **5.3** Delete `src/lib/cached-cloud.ts` — it was a workaround
  for the query persister layer.
- [ ] **5.4** Delete unused Supabase service imports across the code
  base (grep for `supabase.from` outside `src/sync/` and
  `src/services/` — should be zero).
- [ ] **5.5** Rewrite `CLAUDE.md` section 4 ("Data Layer Pattern") to
  reflect local-first. Update section 5 golden rules.
- [ ] **5.6** Remove `.env.example` lines that are no longer meaningful.

---

### Phase 6 — Validation (≈ 4 hrs)

- [ ] **6.1** Manual test matrix:

| Scenario | Expected |
|---|---|
| Fresh install, new signup | Normal onboarding, tasks insert instantly |
| Fresh install, sign in to existing account | Seed screen → dashboard shows all data |
| Offline for 10 min, make 20 changes | All changes visible immediately; sync drains on reconnect |
| Device A edits task, Device B edits same task | LWW: later `updated_at` wins |
| Tap task 50 times rapidly | 50 toggles registered; one tap == one XP |
| Kill app mid-protocol | Reopen → protocol state preserved, sync continues |
| Signed out remotely (token revoked on server) | Next sync surfaces a 401; user sent to login |
| Rotate auth token during background sync | Push resumes; no user-visible effect |

- [ ] **6.2** Performance: tap → visual feedback < 16 ms (single frame).
  Use React DevTools Profiler on dashboard.
- [ ] **6.3** Data integrity: for each domain, do a round-trip
  (create → sync → read via Supabase dashboard → modify in Supabase →
  pull → verify local state).
- [ ] **6.4** Beta build (`eas build --profile preview`) + install on
  physical device + dogfood for 24 hrs.
- [ ] **6.5** Merge `local-first` → `main`. Tag `v2.0-local-first`.
  Push.

---

## 7. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SQLite migration fails on upgrade, user can't open app | Low | High | Each migration wrapped in a transaction; on failure, fall back to re-seed (we have cloud backup). Ship a "reset local DB" dev tool. |
| Outbox grows unbounded (user offline for weeks) | Low | Medium | Dedupe consecutive upserts to same row before sending. Cap attempts at 20 — above that, surface in UI as "needs manual retry". |
| Conflict between devices loses data | Medium | Medium | LWW is fine for 99% of cases. For critical tables (protocol_sessions, journal_entries), treat each entry as append-only (INSERT, never UPDATE) — no conflict possible. |
| Supabase schema changes break SQLite schema | Medium | High | Require every Supabase migration to include a matching SQLite migration file in the same PR. Add a CI check later. |
| Soft-delete + re-sync creates ghost rows | Low | Low | Pull filters `WHERE _deleted = 0`. After remote delete confirms, hard-delete locally. |
| First-time seed times out for existing user with months of data | Low | Medium | Paginate pulls (500 rows per request). Show progress. Allow resume. |
| React Query persister removal breaks offline-read behavior | Low | Low | SQLite serves reads — queries work offline trivially. |

## 8. What we DON'T change

- Supabase schema (column names, types, RLS policies) — unchanged.
- Auth provider (Supabase) — unchanged.
- UI components, cinematics, theme, audio, game logic — all unchanged.
- React Query hooks' public API — shape unchanged, only `queryFn` body
  flips from Supabase to SQLite.
- MMKV usage for device-local preferences — unchanged.
- Sentry / PostHog analytics — unchanged.

## 9. Open questions for your approval

1. **Branch name:** `local-first` OK, or prefer something else?
2. **Timing:** all in one push, or ship per-phase to the beta build so
   you can test incrementally? I'd recommend incrementally — start
   dogfooding Phase 2.1 (tasks/completions) as soon as it's done to
   catch design issues early.
3. **Domain order:** the Phase 2 order above prioritises tap-lag fixes
   (tasks → habits → profile). Any domain you'd reorder based on how
   often you hit it?
4. **CRDT hedge:** plain LWW is what I'm proposing. If you foresee
   heavy concurrent editing of the same data on multiple devices, we
   could use CRDTs instead (~5× the complexity). My recommendation:
   LWW, revisit only if we see conflicts in practice.
5. **Realtime:** no WebSocket sync in this plan. Updates propagate on
   app foreground + every 60 s. If you want sub-3-second cross-device
   updates, we add Supabase Realtime subscriptions in a later phase
   (~4 hrs extra). Preference?
6. **SyncStatus UI:** I'm assuming a small status indicator in the
   top-right (matches the Notion "Synced • 2 s ago" affordance). Or
   keep it invisible unless there's an error?

## 10. Estimated total

| Phase | Hours |
|---|---|
| 0. Foundation | 4 |
| 1. Sync engine | 6 |
| 2. Service layer (10 sub-domains) | 8 |
| 3. Initial seed | 3 |
| 4. Auth cleanup | 2 |
| 5. Cleanup | 2 |
| 6. Validation | 4 |
| **Total focused work** | **≈ 29 hrs ≈ 3 working days** |

Spread over calendar time with testing between phases: 5–7 days.

## 11. Rollback at any point

- Any time before Phase 6 merge: `git checkout main`. No production
  code has changed.
- After merge: the archive at
  `~/Documents/Projects/titan-android-archive-supabase-2026-04-18/` and
  git tag `archive/supabase-first-v1` restore a known-good Supabase
  version. See `RESTORE.md` in the archive.

---

**Waiting for your approval on §9 before starting Phase 0.**
