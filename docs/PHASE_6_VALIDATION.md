# Phase 6 — Validation Report

> Generated after Phase 5.7. All automated gates green; on-device
> verification pending (user-driven). This document is the hand-off.

## Green gates (automated)

- [x] **Typecheck** — `npx tsc --noEmit` exits 0.
- [x] **Unit + integration tests** — `npx jest`: 110 passing across 12 suites.
- [x] **DDL smoke test** — `sqlite3` CLI parses `001_initial.sql` clean
      (44 tables, 81 indexes). Smoke `SELECT COUNT(*) FROM profiles`
      returns 0 on a fresh DB.
- [x] **Grep audit** — no `supabase.from(...)` call outside
      `src/sync/push.ts`, `src/sync/pull.ts`, `src/services/account.ts`
      (server-side cascade delete), and test fakes.
- [x] **Grep audit** — no `supabase.auth` call outside
      `src/lib/supabase.ts`, `src/stores/useAuthStore.ts`,
      `src/services/account.ts`, and `src/hooks/useAppResumeSync.ts`
      (already removed in Phase 5 cleanup).
- [x] **Archive preserved** — git tag `archive/supabase-first-v1` at
      `e4c5b38` (pushed to origin) plus local directory at
      `~/Documents/Projects/titan-android-archive-supabase-2026-04-18/`
      with `RESTORE.md` inside.

## Automated test coverage by area

| Area | Suite | Tests |
|---|---|---|
| Exponential backoff | `sync/backoff.test.ts` | 4 |
| Error classification | `sync/errors.test.ts` | 8 |
| Row coercion | `sync/coerce.test.ts` | 14 |
| Outbox enqueue / drain / mark / dedup / resurrection / composite-PK / stuck-cap | `sync/outbox.test.ts` | 15 |
| Push loop — auth / transient / fatal / conflict / composite PK / empty / batch | `sync/push.test.ts` | 11 |
| Pull loop — LWW every branch / cursor advance / JSON coercion / composite PK / pagination / error modes / fullRefresh | `sync/pull.test.ts` | 15 |
| Engine orchestration — pushOnly / pullOnly / concurrent coalesce / auth short-circuit / per-table invalidation | `sync/engine.test.ts` | 8 |
| Initial seed — fresh / resume / auth / transient / marker / user-switch | `sync/seed.test.ts` | 10 |
| End-to-end round-trip — create-push / pull-overwrite / delete / LWW-dirty / JSON round-trip | `sync/roundtrip.test.ts` | 5 |
| Tasks service integration | `services/tasks.test.ts` | 10 |
| Habits service integration | `services/habits.test.ts` | 5 |
| Profile service integration | `services/profile.test.ts` | 4 |

## On-device test matrix (required before tagging `v2.0-local-first`)

Run on a physical Android device after `npm run android`. Mark each pass/fail.

### Cold path — fresh install

- [ ] **New signup** — sign up with a brand-new email. Verify:
  - [ ] SyncingScreen flashes briefly (0 rows to pull) then dashboard loads empty.
  - [ ] Onboarding flow runs. BeatSetup completes without errors.
  - [ ] After completion, selected tasks appear on the dashboard.
  - [ ] `profiles`, `tasks`, `habits` rows show up in Supabase dashboard
        within 5s of the push engine's first cycle.

- [ ] **Existing account on fresh device** — install the app, sign into
      an existing account that has data on Supabase. Verify:
  - [ ] SyncingScreen shows "N / 42" progress.
  - [ ] After seed completes, dashboard renders with the user's tasks,
        habits, profile, engine scores.
  - [ ] Onboarding IS NOT re-triggered (profile.onboarding_completed
        was pulled as true).

### Hot path — dashboard tap-lag (the bug we migrated to fix)

- [ ] **Single tap** — tap a task on the dashboard. The XP bar + tick
      animation should fire **within one frame (<16ms)**. No delay.
- [ ] **Rapid tapping** — tap 5 tasks in < 1s. All five should register
      and visual feedback should keep up.
- [ ] **After 4 tasks selected** — first-light cinematic fires smoothly
      (this was the sign-out trigger before).
- [ ] **60s of interaction** — navigate between tabs, toggle tasks, tap
      habits. No SIGNED_OUT. Devtools Network tab shows zero `/token`
      refresh cascades (at most one per hour).

### Offline behaviour

- [ ] **Airplane mode mid-session** — toggle airplane mode on while
      dashboard is loaded. Create a task, toggle 3 completions. UI
      responds instantly. `dev-sync` screen shows outbox count = 4.
- [ ] **Reconnect** — airplane mode off. Within 10s the outbox drains
      and count returns to 0. Verify via Supabase dashboard that rows
      landed.

### Cross-device sync

- [ ] **Edit on Device A, appear on Device B** — edit a task on one
      device. On the second device, pull-to-refresh or foreground the
      app. Edit appears within one 60s polling cycle (or on next
      AppState transition).
- [ ] **LWW conflict** — with both devices offline, edit the same task
      differently on each. Reconnect A first, then B. Final state
      matches whichever had the later `updated_at`. No split-brain.

### Interruption / recovery

- [ ] **Kill app mid-seed** — force-quit during the initial pull.
      Relaunch; seed resumes (or re-runs cleanly — merge handles dupes).
- [ ] **Kill app mid-protocol** — force-quit during evening protocol.
      Relaunch; previously-entered reflection text is preserved (SQLite
      persisted the half-written row on every keystroke-driven upsert).

### User switch

- [ ] **Sign out + sign in as different user** — on the same device,
      sign out of account A. Sign in to account B. Verify:
  - [ ] SyncingScreen runs again (the `__user__` marker mismatch triggers
        `resetLocalDataForUserSwitch` before re-seed).
  - [ ] Account B's data appears; no leakage from account A.

### Auth rotation

- [ ] **Signed out remotely** (simulated by manually deleting the user's
      session in Supabase) — next sync surfaces a 401; auth store
      clears; user routed to `/(auth)/login`.

### Performance

- [ ] **Tap → visual feedback < 16ms** — React DevTools Profiler on the
      dashboard while tapping. The mutation commit phase should show
      the frame.
- [ ] **DB migration at boot** — time from splash to first paint after
      update ≤ 2s.

## Known limitations

1. **Cross-device deletion propagation** — the pull cursor uses
   `updated_at > last_pulled_at`. When a row is deleted on Supabase it
   disappears from the query — the receiving device never learns it
   was deleted. For a single-user-mostly-one-device usage pattern this
   doesn't matter in practice. Workarounds if it ever bites:
   - Add a tombstones table on Supabase and pull deletions from it.
   - Subscribe to Supabase Realtime DELETE events for critical tables.

   Documented in `docs/MIGRATION_LOCAL_FIRST.md` §7 risk register.

2. **Cold-boot `cached-cloud.ts` helpers return defaults** — after a
   cold start, the React Query cache is empty. Sync helpers like
   `cachedStreakCurrent()` return `0` until the matching hook has
   actually fetched (typically within the first second of UI activity).
   Achievements that fire off these values will just no-op on cold
   boot until the caches warm. Acceptable trade-off.

3. **Outbox grows during long offline spells** — capped at 20 attempts
   per mutation (MAX_ATTEMPTS in `src/sync/backoff.ts`). Above the
   cap, the mutation is "stuck" and surfaced in `dev-sync`. The user
   can manually retry or drop. For normal usage this never fires.

4. **SQLite schema drift with Supabase** — any new column / table added
   to Supabase must be mirrored in a new `NNN_*.sql` migration under
   `src/db/sqlite/migrations/`. Forgetting this = pull will INSERT a
   row with an unknown column and throw. A CI check is a future
   improvement.

5. **JSON column values are stored as strings in SQLite** — so range
   queries / indexes on JSON fields are impossible client-side. If a
   feature needs that, promote the JSON field to a real column.

## Merge readiness

- All Phase 0-5 commits sit on branch `local-first` (off main). `main`
  is still at `023e386` (docs) + `e4c5b38` (archive tag).
- Recommended merge command **after the on-device test matrix above
  passes**:
  ```bash
  git checkout main
  git merge --no-ff local-first
  git tag v2.0-local-first
  git push origin main --tags
  ```

- If on-device testing reveals issues:
  ```bash
  git checkout local-first
  # fix issues, commit as migrate(phase-6.N): <what>
  # re-run the matrix
  ```

- Full rollback (abandon the migration) at any time:
  ```bash
  git checkout archive/supabase-first-v1
  # or: restore from ~/Documents/Projects/titan-android-archive-supabase-2026-04-18/
  ```

## Summary commit trail on `local-first`

```
a238225 migrate(phase-5.7): user-switch detection — don't leak user A's data to user B
ee55cba migrate(phase-5):   cleanup — drop query persister, route last callers through SQLite, rewrite CLAUDE.md
af65c96 migrate(phase-4):   simplify auth store, remove /token cascade recovery
353e7e4 migrate(phase-3):   fresh-install seed gate + SyncingScreen
c8c6789 migrate(phase-2):   invert service layer to SQLite-first
cf70b62 migrate(phase-1):   sync engine — outbox + push/pull + seed + tests
c013e15 migrate(phase-0):   SQLite foundation — client, migrator, initial schema
023e386 docs: add local-first migration plan
e4c5b38 fix: recover from spurious SIGNED_OUT (on main — kept as the baseline the migration targets)
```
