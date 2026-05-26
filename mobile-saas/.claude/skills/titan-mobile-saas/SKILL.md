---
name: titan-mobile-saas
description: Titan Protocol mobile SaaS — hybrid cloud-first Expo / React Native app sharing Supabase backend with web + Tauri desktop. Cross-device sync via Realtime. Not the Classic standalone APK; the new SaaS mobile.
---

# Titan Mobile SaaS Skill

> Patterns and references for building features in the Titan Protocol SaaS mobile app at `mobile-saas/`.
>
> **Architecture: Hybrid cloud-first.** Writes go to Supabase first via `cloudUpsert` helpers, mirror into expo-sqlite, Realtime channel pushes other devices' edits into the local cache. Reads stay local (~1ms).
>
> Read `HANDOFF_MOBILE_SAAS.md` at the repo parent first if you haven't.

---

## §1. Supabase MCP Workflow

Project ref: **`rmvodrpgaffxeultskst`** (region `ap-south-1`). Same project as web + Tauri desktop.

Schema changes touch **5 places**:

1. Supabase migration via `mcp__claude_ai_Supabase__apply_migration`
2. Regenerate types via `mcp__claude_ai_Supabase__generate_typescript_types` → overwrite `shared/types/supabase.ts`
3. Mirror to `mobile-saas/src/types/supabase.ts` (and `web/` if missing there, and Classic `mobile/src/types/supabase.ts` if you want Classic to inherit the column too — optional for Classic)
4. SQLite migration in `mobile-saas/src/db/sqlite/migrations/NNN_*.sql` AND `web/src/db/sqlite/migrations/NNN_*.sql` (and optionally `mobile/` if Classic needs it)
5. Add the table to the `supabase_realtime` publication + set `REPLICA IDENTITY FULL` (mirror the existing `enable_realtime_publication` migration pattern)

```
# Common MCP calls
mcp__claude_ai_Supabase__list_tables({ project_id: "rmvodrpgaffxeultskst", schemas: ["public"] })
mcp__claude_ai_Supabase__apply_migration({ project_id: "rmvodrpgaffxeultskst", name: "snake_case_name", query: "SQL" })
mcp__claude_ai_Supabase__execute_sql({ project_id: "rmvodrpgaffxeultskst", query: "SELECT ..." })
mcp__claude_ai_Supabase__generate_typescript_types({ project_id: "rmvodrpgaffxeultskst" })
mcp__claude_ai_Supabase__get_advisors({ project_id: "rmvodrpgaffxeultskst", type: "security" })
mcp__claude_ai_Supabase__restore_project({ project_id: "rmvodrpgaffxeultskst" })   # if auto-paused
```

### Every-table checklist

- `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` (or composite PK — list in `src/sync/tables.ts`)
- `created_at timestamptz NOT NULL DEFAULT now()`
- `ENABLE ROW LEVEL SECURITY` + 4 policies USING `auth.uid() = user_id`
- Run `get_advisors type=security` — zero new findings
- Add to `supabase_realtime` publication + `REPLICA IDENTITY FULL`

### Rules

- **Never** hand-edit `src/types/supabase.ts` — regenerate via MCP.
- **Never** run DDL via `execute_sql` — use `apply_migration` so it's in history.
- **Never** edit a shipped migration file. Add a new one.

---

## §2. Service pattern (cloud-first)

```typescript
// src/services/tasks.ts
import { requireUserId } from "../lib/supabase";
import {
  newId, sqliteList, sqliteGet, cloudUpsert, cloudDelete,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

export type Task = Tables<"tasks">;

export async function listTasks(): Promise<Task[]> {
  return sqliteList<Task>("tasks", { where: "is_active = 1", order: "created_at ASC" });
}

export async function createTask(input: { title: string; engine: string }): Promise<Task> {
  const userId = await requireUserId();
  return cloudUpsert("tasks", {
    id: newId(),
    user_id: userId,
    title: input.title,
    engine: input.engine,
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

// Partial update — read/merge/write
export async function renameTask(id: string, title: string): Promise<Task> {
  const existing = await sqliteGet<Task>("tasks", { id });
  if (!existing) throw new Error("Not found");
  return cloudUpsert("tasks", { ...existing, title, updated_at: new Date().toISOString() });
}

export async function deleteTask(id: string): Promise<void> {
  await cloudDelete("tasks", { id });
}
```

**Do not** call `supabase.from(...)` in service files. Allowed only in: `lib/supabase.ts`, `stores/useAuthStore.ts`, `sync/realtime.ts`, `sync/first-run-pull.ts`, `sync/restore.ts`, `sync/backup.ts`, `services/account.ts`.

---

## §3. Hook pattern (with optimistic mutation)

```typescript
// src/hooks/queries/useTasks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import { listTasks, toggleCompletion } from "../../services/tasks";

export const tasksKeys = {
  all: ["tasks"] as const,
  byEngine: (e: string) => ["tasks", e] as const,
};

export function useAllTasks() {
  const userId = useAuthStore((s) => s.user?.id);
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
    },
  });
}
```

Every `useQuery` **must** carry `enabled: Boolean(userId)`. Otherwise queries fire before auth lands and you'll see weird empty states + console noise.

---

## §4. Auth pattern (lift from Classic)

`useAuthStore` is the single source of session truth. Lift verbatim from `mobile/src/stores/useAuthStore.ts`.

Key behaviors:
- Hydrates session from AsyncStorage on boot via `useAuthStore.initialize()`
- Subscribes to `supabase.auth.onAuthStateChange`
- Recovers from spurious SIGNED_OUT (60s cooldown, retry `setSession()` once)

`requireUserId()` (in `lib/supabase.ts`) reads from the in-memory store, NOT from `supabase.auth.getSession()`. This is deliberate — avoids token-refresh cascades on tap-bursts.

### Sign-out wipes local SQLite

```typescript
// inside useAuthStore.ts
import { wipeAllSyncedTables } from "../sync/first-run-pull";

signOut: async () => {
  await wipeAllSyncedTables();  // local cache first
  const { error } = await supabase.auth.signOut();
  set({ session: null, user: null });
  return { error };
}
```

The wipe-first ordering matters — if the cloud sign-out fails, we still don't want the next user to see the previous user's cached rows.

---

## §5. Realtime channel pattern

`subscribeUserChanges(userId, queryClient)` in `src/sync/realtime.ts` (port from `web/src/sync/realtime.ts`):

```typescript
const channel = supabase.channel(`user-${userId}-changes`);
for (const table of SYNCED_TABLES) {
  channel.on(
    "postgres_changes",
    { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
    (payload) => handleChange(payload, queryClient),
  );
}
channel.subscribe();
```

On INSERT/UPDATE: write the new row to SQLite via raw `run()` (bypass `cloudUpsert` — we're already receiving from cloud). On DELETE: hard-delete by PK. Then invalidate React Query.

Mount via a `<RealtimeProvider>` inside the authenticated tree (so it can `useQueryClient()`).

---

## §6. First-run cloud pull

`pullIfEmpty(userId, onProgress?)` in `src/sync/first-run-pull.ts`:

- Checks `sqliteCount("tasks") + sqliteCount("habits") + sqliteCount("profiles")` scoped to this user
- If zero, calls `restoreFromCloud()` (atomic fetch-then-swap)
- Returns `{ pulled: true | false }`

`<FirstRunPullGate userId={user.id}>` wraps the OS shell (mirror `web/src/components/FirstRunPullGate.tsx` re-skinned to RN primitives). Shows a "SYNCING YOUR DATA" splash with progress bar while the pull runs.

---

## §7. Scoring & ranks (pure logic)

Three distinct rank concepts — don't unify them.

### Daily Titan Score (0-100)
```typescript
import { calculateWeightedTitanScore } from "@/lib/scoring-v2";
// Archetype-weighted average of 4 engine scores
```

### Daily Letter Grade (D/C/B/A/S/SS)
```typescript
import { getDailyRank } from "@/db/gamification";
// SS≥95, S≥85, A≥70, B≥50, C≥30, D≥0
```

### XP-Level Tier (Initiate → Titan)
```typescript
import { getRankForLevel, RANKS } from "@/db/gamification";
// 6 tiers: Initiate(1) / Operator(2) / Specialist(4) / Vanguard(8) / Sentinel(15) / Titan(31)
// XP_PER_LEVEL = 500
```

### Engine Score
```typescript
// main task = 2pt, secondary = 1pt, score = earned/total × 100
import { computeEngineScore } from "@/services/tasks";
```

---

## §8. Dates

Always use `src/lib/date.ts`:
- `getTodayKey()` — YYYY-MM-DD in local timezone
- `toLocalDateKey(d)` — Date → YYYY-MM-DD local
- `addDays(dateKey, n)` — DST-safe day arithmetic
- `formatDateDisplay(dateKey)` — "April 15, 2026"

**Never** `.toISOString().slice(0,10)` — produces wrong dates east of UTC near midnight.

---

## §9. Animation safety

Every `withRepeat(-1)` must have `cancelAnimation()` in cleanup:

```typescript
useEffect(() => {
  sv.value = withRepeat(withTiming(...), -1, false);
  return () => { cancelAnimation(sv); };
}, []);
```

Without this, Reanimated leaks on Android and eventually OOMs on re-entering a screen.

**Android shadows only via `theme/shadows.ts`** — caps elevation at 2 for panels, 0 for rows. Never raw `elevation: N`.

---

## §10. Adding a new feature end-to-end

1. **Schema** (if needed): `apply_migration` via Supabase MCP. Mirror SQLite migration in web + mobile-saas. Add to `SYNCED_TABLES` + `PRIMARY_KEYS` + Realtime publication.
2. **Types**: regenerate via MCP → overwrite `shared/types/supabase.ts` and mirror to `mobile-saas/src/types/supabase.ts`.
3. **Service** (`src/services/<feature>.ts`): use `cloudUpsert`/`sqliteList`/etc., call `requireUserId()` before writes, throw on error.
4. **Hook** (`src/hooks/queries/use<Feature>.ts`): tuple-typed keys, `enabled: Boolean(userId)`, optimistic mutations if mutation matters.
5. **Wire UI**: import the hook in a screen. No direct SQLite or Supabase calls from components.
6. **Typecheck + test**: `npx tsc --noEmit && npm test`.

---

## §11. SQLite tables (42 user + 3 internal)

Source of truth: `src/db/sqlite/migrations/001_initial.sql` (copied verbatim from `mobile/`).

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

All user tables carry `_deleted` and `_dirty` housekeeping columns.

Composite-PK tables: `srs_cards`, `user_titles`, `field_op_cooldown`, `focus_settings`, `nutrition_profile`, `progression`, `subscriptions`, `titan_mode_state`.

---

## §12. Known landmines

- **Spurious SIGNED_OUT** under tap-bursts. Recovery is in `useAuthStore`; don't remove it.
- **Android shadow OOM**: never raw `elevation:` outside `theme/shadows.ts`.
- **`.toISOString().slice(0,10)` is wrong** east of UTC.
- **`withRepeat(-1)` leaks** without `cancelAnimation()` in cleanup.
- **Realtime drops on iOS background**. Acceptable; reconnects on resume.

---

## §13. Growth rule

Add to this skill when you solve a non-trivial problem. Every entry earns its place by saving a future session a grep or a mistake.
