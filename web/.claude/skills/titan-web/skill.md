---
name: titan-web
description: Titan web/desktop dev skill — hybrid cloud-first (Supabase source of truth, sqlite-wasm/tauri-plugin-sql local cache, Realtime sync). Consumes @titan/shared. Tauri v2 desktop with auto-updater.
---

# Titan Web Skill

> Patterns and references for building features in the Titan web/desktop app.
>
> **Architecture: Hybrid cloud-first.** Supabase is the source of truth; local SQLite is a per-user read cache; a Realtime subscription pushes other devices' changes into this device's cache. Writes go cloud-first via `cloudUpsert`/`cloudUpsertMany`/`cloudDelete`, then mirror into SQLite, then return. Reads stay on SQLite (~1ms). `localStorage` is for device preferences only. `@titan/shared` holds pure logic + types + the Supabase client factory.
>
> See `web/CLAUDE.md` for the full spec and `../CLAUDE.md` (repo root) for the two-architecture split (this app + `mobile-saas/` are cloud-first; `mobile/` Classic is local-first).

---

## S1. Architecture

```
   write path                                     read path
   ─────────                                       ────────
   Screen → hook mutation → service.create()       Screen → hook → service.list()
                              │                                    │
                              ▼                                    ▼
                       cloudUpsert(t, row)                  sqliteList(t)  (~1ms)
                       ─ Supabase upsert
                       ─ mirror to SQLite
                       ─ return canonical row

   another device pushed a change
        │
        ▼
   WebAuthProvider → Realtime channel → postgres_changes → write SQLite + invalidateQueries()
```

- Writes go cloud-first through `src/db/sqlite/service-helpers.ts` (`cloudUpsert`/`cloudUpsertMany`/`cloudDelete`). On a failed cloud write the row is mirrored locally with `_dirty=1` and replayed later by `sync/flush-dirty.ts`.
- Reads stay on local SQLite via `sqliteList`/`sqliteGet` — never hit the network.
- `localStorage` for device preferences only (theme, sound, selected date).
- No IndexedDB, no Dexie.
- **Supabase is reached only by:** `lib/init.ts`, `lib/auth.tsx`, `lib/session.ts`, `db/sqlite/service-helpers.ts`, `sync/realtime.ts`, `sync/first-run-pull.ts`, `sync/flush-dirty.ts`, `sync/restore.ts`, `sync/backup.ts`, `services/account.ts`. A `forbidden-patterns` test guards this.

The SQLite client is platform-branching (`src/db/sqlite/client.ts`):
- **Browser** — `@sqlite.org/sqlite-wasm` with the `opfs-sahpool` VFS (persists across reloads, no COOP/COEP headers required)
- **Tauri desktop** — `@tauri-apps/plugin-sql` (native SQLite via sqlx)
- **Vitest** — `better-sqlite3` in-memory (used by `__tests__/sqlite-smoke.test.ts` + `hybrid-sync.test.ts`)

All three impls expose the same `all / get / run / exec / transaction` surface.

---

## S2. Supabase MCP workflow

Project ref: **`rmvodrpgaffxeultskst`** (region `ap-south-1`) — shared with `mobile-saas/` and Classic `mobile/`.

Schema changes touch Supabase first (so all frontends regenerate types from one source), then get mirrored into each app's local SQLite schema + the Realtime publication.

### Common MCP calls

```
# Apply a migration (CREATE TABLE, ALTER, policies)
mcp__claude_ai_Supabase__apply_migration({ project_id: "rmvodrpgaffxeultskst", name: "snake_case_name", query: "SQL" })

# Read-only query (SELECT only — never DDL)
mcp__claude_ai_Supabase__execute_sql({ project_id: "rmvodrpgaffxeultskst", query: "SELECT ..." })

# Regenerate TypeScript types → overwrite shared/types/supabase.ts + mirror to BOTH mobile apps
mcp__claude_ai_Supabase__generate_typescript_types({ project_id: "rmvodrpgaffxeultskst" })

# Security audit
mcp__claude_ai_Supabase__get_advisors({ project_id: "rmvodrpgaffxeultskst", type: "security" })
```

### Every-table checklist
- [ ] `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- [ ] `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` (or composite PK — list in `src/sync/tables.ts`)
- [ ] `created_at timestamptz NOT NULL DEFAULT now()`
- [ ] `ENABLE ROW LEVEL SECURITY` + 4 policies USING `auth.uid() = user_id`
- [ ] Run `get_advisors type=security` — zero new findings
- [ ] Mirror DDL in `src/db/sqlite/migrations/NNN_*.sql` + register in `migrations/index.ts`
- [ ] Add table to `COLUMN_TYPES` (`src/db/sqlite/column-types.ts`) and `PRIMARY_KEYS` (`src/sync/tables.ts`)
- [ ] Add the table to the `supabase_realtime` publication + set `REPLICA IDENTITY FULL` (mirror the `enable_realtime_publication` migration) — required for cross-device sync
- [ ] Repeat the SQLite migration + column-types + tables changes in `mobile-saas/src/db/sqlite/*` (and Classic `mobile/` only if it needs the column)

### Rules
- **Never** hand-edit `types/supabase.ts` — always regenerate via MCP, then mirror to `mobile/src/types/supabase.ts` + `mobile-saas/src/types/supabase.ts`.
- **Never** run DDL via `execute_sql` — use `apply_migration` so it's in history.
- **Never** edit a shipped migration file. Add a new one. (The migrator self-heals "duplicate column"/"already exists" via `isAlreadyAppliedError`, but that's a safety net, not a license to rewrite history.)

---

## S3. Adding a New Feature (end-to-end)

1. **Supabase schema** — `apply_migration` via Supabase MCP
2. **Supabase types** — `generate_typescript_types` → overwrite `shared/types/supabase.ts`, mirror to `mobile/src/types/supabase.ts` + `mobile-saas/src/types/supabase.ts`
3. **SQLite migrations** — new file in `web/src/db/sqlite/migrations/NNN_*.sql` AND `mobile-saas/src/db/sqlite/migrations/NNN_*.sql` (+ Classic if needed); register in each `migrations/index.ts`
4. **Column types + sync registration** — update `column-types.ts` and `sync/tables.ts` in each app you migrated
5. **Realtime publication** — add the table to `supabase_realtime` + `REPLICA IDENTITY FULL`
6. **Service** — `web/src/services/<feature>.ts`: reads via `sqliteList`/`sqliteGet`; **writes via `cloudUpsert`/`cloudUpsertMany`/`cloudDelete`**; calls `requireUserId()` before writes; throws on error
7. **Hook** — `web/src/hooks/queries/use<Feature>.ts`: tuple-typed keys, `enabled: Boolean(userId)` (via `useCurrentUserId`), optimistic mutations; if the mutation changes a score, call `invalidateScoring(qc)` in `onSettled` (see S8)
8. **Wire UI** — import the hook. No direct SQLite or Supabase calls from components.
9. **Typecheck** — `npx tsc --noEmit` in web (and any other app you touched)

---

## S4. Service Pattern (hybrid cloud-first)

```typescript
// web/src/services/tasks.ts
import { requireUserId } from "../lib/session";
import {
  newId, sqliteList, sqliteGet, cloudUpsert, cloudDelete,
} from "../db/sqlite/service-helpers";
import type { Tables, Enums } from "@titan/shared/types/supabase";

export type Task = Tables<"tasks">;
export type EngineKey = Enums<"engine_key">;

// Reads stay local — fast.
export async function listTasks(): Promise<Task[]> {
  return sqliteList<Task>("tasks", { order: "created_at ASC" });
}

// Writes go cloud-first; the helper upserts to Supabase, mirrors to SQLite, returns the row.
export async function createTask(input: {
  title: string;
  engine: EngineKey;
}): Promise<Task> {
  const userId = await requireUserId();
  return cloudUpsert("tasks", {
    id: newId(),
    user_id: userId,
    title: input.title,
    engine: input.engine,
    kind: "main",
    days_per_week: 7,
    is_active: true,
    legacy_local_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

// Partial update — read / merge / write (still cloud-first).
export async function renameTask(id: string, title: string): Promise<Task> {
  const existing = await sqliteGet<Task>("tasks", { id });
  if (!existing) throw new Error("Not found");
  return cloudUpsert("tasks", { ...existing, title, updated_at: new Date().toISOString() });
}

export async function deleteTask(id: string): Promise<void> {
  await cloudDelete("tasks", { id });
}
```

The plain `sqliteUpsert`/`sqliteDelete` helpers still exist but are **reserved for the Realtime subscriber and first-run pull** (which already receive data FROM cloud). Feature services use the `cloud*` variants.

**Do not** call `supabase.from(...)` in service files. Allowed Supabase files: see S1.

---

## S5. Hook Pattern (optimistic mutation)

```typescript
// web/src/hooks/queries/useTasks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/session";
import { invalidateScoring } from "../../lib/score-invalidation";
import { listTasks, toggleCompletion, type Task } from "../../services/tasks";

export const tasksKeys = {
  all: ["tasks"] as const,
  engine: (e: string) => ["tasks", "engine", e] as const,
};

export function useAllTasks() {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: tasksKeys.all,
    queryFn: listTasks,
    enabled: Boolean(userId),
  });
}

export function useToggleCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: toggleCompletion,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: tasksKeys.all });
      const prev = qc.getQueryData(tasksKeys.all);
      qc.setQueryData(tasksKeys.all, applyOptimistic(prev, vars));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(tasksKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: tasksKeys.all });
      invalidateScoring(qc); // completion shifts every derived score — see S8
    },
  });
}
```

Every `useQuery` **must** carry `enabled: Boolean(userId)` — auth is live, so queries that fire before the session lands will error without it.

---

## S6. Auth Pattern (live)

- `lib/auth.tsx` — `WebAuthProvider` is the single source of truth. Exposes `{ user, loading, signIn, signUp, signInWithGoogle, signOut }` via `useWebAuth()`. On user-id change it opens the Realtime channel and triggers `flushDirtyRows()`.
- `lib/session.ts` — module-level cache (`currentUserId`, `currentUserEmail`), seeded `null`. `WebAuthProvider` calls `setCurrentUser()` on every auth state change. Services read via `requireUserId()` (throws if null).
- `OSLayout` reads `useWebAuth()` and **redirects unauthenticated users to `/auth/login`** (the gate is active — no DEV_USER_ID bypass anymore). It wraps the app in `<FirstRunPullGate>` so a fresh device pulls cloud data into empty SQLite before first paint.
- `signOut()` calls `wipeAllSyncedTables()` before `supabase.auth.signOut()` so the next account on this device starts clean.
- Login page at `/auth/login` (tabbed email/password + Google OAuth). OAuth callback at `/auth/callback` → waits for `detectSessionInUrl`, routes to `/app`.

---

## S7. Sync (Realtime + first-run pull + dirty replay)

No "Backup to Cloud" button anymore — sync is continuous. The pieces:

- **`sync/realtime.ts`** — `subscribeUserChanges(userId, qc)` opens one channel filtered to the user (`user_id=eq.<id>`, or `id=eq.<id>` for `profiles` via `REALTIME_KEY_COLUMN`). `postgres_changes` INSERT/UPDATE write to SQLite via raw `run()`; DELETE hard-deletes by PK; both invalidate React Query. If the table affects scoring (`tableAffectsScoring`), it also calls `invalidateScoring(qc)`.
- **`sync/first-run-pull.ts`** — `pullIfEmpty(userId)` runs inside `<FirstRunPullGate>`; if local SQLite is empty for this user, it calls `restoreFromCloud()` before rendering. `wipeAllSyncedTables()` is the sign-out wipe.
- **`sync/flush-dirty.ts`** — `flushDirtyRows()` replays any row a failed `cloudUpsert` left `_dirty=1`. Fired from `lib/auth.tsx` on sign-in, `window` `online`, and tab `visibilitychange`.
- **`sync/restore.ts`** — atomic fetch-then-swap (stage all cloud rows in memory, then `DELETE`+`INSERT OR REPLACE` inside one `transaction()`). Used by first-run pull and the dev escape hatch at `/app/settings?dev=1`.
- **`sync/backup.ts`** — no longer wired to UI; kept for future cold-restore tooling.

---

## S8. Scoring & Ranks

Three distinct rank concepts — don't unify them.

### Daily Titan Score (0-100) — `@titan/shared/lib/scoring-v2`
`calculateWeightedTitanScore(perEngine, archetype)` — archetype-weighted average of 4 engine scores.

### Daily Letter Grade (D/C/B/A/S/SS) — `@titan/shared/db/gamification`
`getDailyRank(percent)` — SS≥95, S≥85, A≥70, B≥50, C≥30, D≥0.

### XP-Level Tier — `@titan/shared/db/gamification`
`getRankForLevel(level)`, `RANKS` — 6 tiers: Initiate(1) / Operator(2) / Specialist(4) / Vanguard(8) / Sentinel(15) / Titan(31).

### Engine Score + Aggregations — `src/lib/scoring.ts` + `src/hooks/useScoreMap.ts`
Local SQLite-backed range queries powering Dashboard week data, calendar heatmaps, analytics trends, and the daily-planning provider. `useScoreMap.ts` wraps them in React Query (`scoreMapKeys`/`dashboardKeys`/`analyticsKeys`, 30s staleTime).

- `computeMonthConsistency` **anchors to each engine's first-task date** and **resets after 30 idle days** — pass the engine's earliest `created_at` as `dataStartKey`.
- **`src/lib/score-invalidation.ts`** — `invalidateScoring(qc)` busts the `scoreMap`/`dashboard`/`analytics`/`dailyPlanning` query roots in one call; `tableAffectsScoring(table)` gates the Realtime path. **Any mutation that changes a day's score (task toggle/create/delete, etc.) must call `invalidateScoring(qc)` in `onSettled`** — otherwise the Dashboard Titan Score goes stale (it reads from the React-Query-backed `DailyPlanningProvider`, key `["dailyPlanning", todayKey]`).

---

## S9. Dates

Always use `src/lib/date.ts` (or `@titan/shared/lib/date`):
- `todayISO()` / `getTodayKey()` — YYYY-MM-DD in local timezone
- `addDays`, `addDaysISO` — DST-safe arithmetic
- `listDateRangeISO`, `monthBounds`, `weekStartISO`, `assertDateISO`

**Never** `.toISOString().slice(0,10)` — produces wrong dates east of UTC near midnight.

---

## S10. Styling

- Tailwind CSS v4 with `@tailwindcss/postcss` (not legacy JIT).
- CSS custom properties in `src/app/styles/theme-tokens.css`.
- Dark theme default: `data-theme="hud"`. Alt theme: `cyberpunk`.
- Component CSS in `src/app/styles/` (`hud-effects.css`, `hud-utilities.css`, `chrome-components.css`).
- Compose UIs from `titan-primitives.tsx` (`TitanPanel`, `TitanButton`, `TitanPageHeader`, etc.).

---

## S11. Desktop (Tauri v2)

```bash
npm run tauri:dev    # Desktop dev with hot reload
npm run tauri:build  # Production installers (.dmg/.msi/.exe/.AppImage/.deb)
```

Plugins registered in `src-tauri/src/lib.rs`: `tauri-plugin-sql`, `tauri-plugin-process`, and (desktop-only) `tauri-plugin-updater`. Capabilities in `src-tauri/capabilities/default.json`: `core:window:*` + `sql:*` + `updater:*` + `process:allow-restart`.

**Auto-update**: `src/lib/desktop-updater.ts::checkForUpdate()` is a no-op in browser; in Tauri it dynamic-imports the updater + process plugins. `<UpdateChecker />` (mounted in `OSLayout`) shows a banner and installs+relaunches on confirm. Release CI is `.github/workflows/tauri-release.yml` (tag `v*.*.*`). Full runbook: `web/DESKTOP_RELEASE.md`. Updater pubkey + signing certs are user-side placeholders — see `../RELEASE_READINESS.md`.

CSP in `tauri.conf.json` (`app.security.csp`) covers self + wasm + Supabase HTTPS/WSS + GitHub (updater) + Google Fonts + `blob:` workers. Vite dev bypasses CSP — only `tauri build` enforces it, so production-test sign-in / OAuth / sync in a packaged build before shipping.

There's also a Tauri Android toolchain (`tauri:android:*`) but the Android apps are the Expo projects in `../mobile` (Classic) + `../mobile-saas` (SaaS), not this. Don't build web for Android without an explicit reason.

---

## S12. Commands

```bash
npm run dev          # Vite dev server (port 3000, strictPort)
npm run build        # Static build → out/
npm run tauri:dev    # Desktop dev
npm run tauri:build  # Desktop installers
npx tsc --noEmit     # Typecheck
npm test             # Vitest (4 files — date, scoring, sqlite-smoke, hybrid-sync; 52 tests)
```

---

## S13. SQLite tables (42 user + housekeeping)

Same schema as the other apps. Source of truth: `src/db/sqlite/migrations/001_initial.sql`. Migrations: `001_initial.sql`, `002_add_expo_push_token.sql` (registered in `migrations/index.ts`).

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

Internals: `schema_migrations`. (`pending_mutations` + `sync_meta` are created by `001_initial.sql` but never read/written on web — a future migration can drop them; see `CLAUDE.md` §14.)

All user tables carry `_deleted` (soft-delete tombstone) and `_dirty` (set to 1 by a failed cloud write, cleared on successful mirror/replay). Readers filter `_deleted = 0`.

---

## S14. Growth rule

Add to this skill when you solve a non-trivial problem. Every entry earns its place by saving a future session a grep or a mistake.
