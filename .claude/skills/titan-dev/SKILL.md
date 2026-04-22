---
name: titan-dev
description: Titan mobile dev skill — local-only SQLite, manual cloud backup, no @titan/shared
---

# Titan Dev Skill (Mobile)

> Recipes, patterns, and references for building features in the Titan Protocol Android app.
> **Architecture: Local-only SQLite. Supabase is auth + a manual backup target — nothing more.**
> Every new feature reads and writes SQLite. MMKV is for device preferences only. `@titan/shared` is **not** a dependency.

---

## §1. Supabase MCP Workflow

Project ref: **`rmvodrpgaffxeultskst`** (region `ap-south-1`).

Schema changes touch Supabase first (so web's `@titan/shared/types/supabase.ts` can regenerate), then mirror locally.

### Common MCP calls

```
# List tables (read Supabase schema)
mcp__claude_ai_Supabase__list_tables({ project_id: "rmvodrpgaffxeultskst", schemas: ["public"] })

# Apply a migration (CREATE TABLE, ALTER, policies)
mcp__claude_ai_Supabase__apply_migration({ project_id: "rmvodrpgaffxeultskst", name: "snake_case_name", query: "SQL" })

# Read-only query (SELECT only — never DDL)
mcp__claude_ai_Supabase__execute_sql({ project_id: "rmvodrpgaffxeultskst", query: "SELECT ..." })

# Regenerate TypeScript types → overwrite src/types/supabase.ts
mcp__claude_ai_Supabase__generate_typescript_types({ project_id: "rmvodrpgaffxeultskst" })

# Security audit
mcp__claude_ai_Supabase__get_advisors({ project_id: "rmvodrpgaffxeultskst", type: "security" })
```

### Every-table checklist (for backup/restore compatibility)
- [ ] `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- [ ] `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` (or composite PK — list in `src/sync/tables.ts`)
- [ ] `created_at timestamptz NOT NULL DEFAULT now()`
- [ ] `ENABLE ROW LEVEL SECURITY` + 4 policies USING `auth.uid() = user_id`
- [ ] Run `get_advisors type=security` — zero new findings
- [ ] Mirror the DDL in `src/db/sqlite/migrations/NNN_*.sql` and register in `migrations/index.ts`
- [ ] Add the table to `COLUMN_TYPES` (`src/db/sqlite/column-types.ts`)
- [ ] Add the table to `SYNCED_TABLES` + `PRIMARY_KEYS` in `src/sync/tables.ts` (backup/restore iterate these)

### Rules
- **Never** hand-edit `src/types/supabase.ts` — always regenerate via MCP.
- **Never** run DDL via `execute_sql` — use `apply_migration` so it's in history.
- **Never** edit a shipped migration file. Add a new one.

---

## §2. Adding a New Feature (end-to-end)

1. **Supabase schema** — `apply_migration` (so web's `@titan/shared` can use it too)
2. **Supabase types** — `generate_typescript_types` → overwrite `src/types/supabase.ts`
3. **SQLite migration** — new file `src/db/sqlite/migrations/NNN_*.sql` + register in `migrations/index.ts`
4. **Column types + sync registration** — add to `src/db/sqlite/column-types.ts` and `src/sync/tables.ts`
5. **Service** — `src/services/<feature>.ts`: uses `sqliteUpsert`/`sqliteList`/`sqliteGet`/`sqliteDelete`, calls `requireUserId()` before writes, throws on error
6. **Hook** — `src/hooks/queries/use<Feature>.ts`: tuple-typed query keys, `enabled: Boolean(userId)`, optimistic mutations
7. **Wire UI** — import the hook. No direct SQLite or Supabase calls from components.
8. **Typecheck** — `npm run typecheck`

---

## §3. Service Pattern (SQLite-first)

```typescript
// src/services/tasks.ts
import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteList,
  sqliteGet,
  sqliteUpsert,
  sqliteDelete,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

export type Task = Tables<"tasks">;

export async function listTasks(): Promise<Task[]> {
  return sqliteList<Task>("tasks", { where: { is_active: 1 }, order: "created_at ASC" });
}

export async function createTask(input: { title: string; engine: string }): Promise<Task> {
  const userId = await requireUserId();
  return sqliteUpsert("tasks", {
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
  return sqliteUpsert("tasks", { ...existing, title, updated_at: new Date().toISOString() });
}

export async function deleteTask(id: string): Promise<void> {
  await sqliteDelete("tasks", { id });  // soft delete (sets _deleted=1)
}
```

**Do not** call `supabase.from(...)` in service files. The only files that may are:
`src/sync/backup.ts`, `src/sync/restore.ts`, `src/services/account.ts` (server cascade delete).

---

## §4. Hook Pattern (optimistic mutation)

```typescript
// src/hooks/queries/useTasks.ts
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

Note: since writes go to SQLite synchronously, optimistic mutations are less critical than they were in the cloud-backed era — but the pattern is still used for consistency and for free refetch on settle.

---

## §5. Auth Pattern

```typescript
// src/stores/useAuthStore.ts — THE ONLY Zustand store for auth
// Thin wrapper around supabase.auth
// - initialize() hydrates from AsyncStorage + subscribes to onAuthStateChange
// - SIGNED_OUT handler attempts recovery with saved refresh_token
// - AppState listener refreshes session on resume (throttled 30s)
// - Login screens call useAuthStore.setState() directly for instant redirect
```

**Login flow:**
1. `supabase.auth.signInWithPassword()` / `signUp()` / `signInWithIdToken()`
2. On success: `useAuthStore.setState({ session, user })` — instant redirect
3. Keep loading state until redirect fires (don't reset `busy`)
4. `onAuthStateChange` fires later and updates store (idempotent)

**Profile row:** created/upserted via `profiles` SQLite row on first auth; backup syncs it to Supabase later.

---

## §6. Manual Cloud Backup / Restore

Entry points: `CloudBackupSection` (Profile tab) → `src/sync/backup.ts` / `src/sync/restore.ts`.

### backup.ts
- Iterate `SYNCED_TABLES` in order.
- For each table: `SELECT * WHERE _deleted = 0` from SQLite.
- Batch upsert to Supabase in chunks of 500 (`supabase.from(table).upsert(rows)`).
- Update `LAST_BACKUP_KEY` in MMKV on completion.

### restore.ts
- `PULL_ORDER` — `profiles` first (FK target), then the rest.
- Wipe all SQLite rows for each table.
- Paginate from Supabase (`from().select('*').range(offset, offset+limit-1)`) in chunks of 500.
- `sqliteUpsertMany` into SQLite.
- Never touches MMKV preferences.

Both show progress via `SyncingScreen` overlay.

---

## §7. Scoring & Ranks (local, pure logic)

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

## §9. Animation Safety

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

## §10. Cinematic System

18 day cinematics: Days 2-14, 30, 45, 60, 90, 365.
Day 1 uses `FirstLaunchCinematic` (separate path).
All other days get `DailyBriefing` only.

Files: `src/components/v2/story/Day{N}Cinematic.tsx`
Props: `{ onComplete: () => void }`
Gating: `useStoryStore.getCinematicForDay(dayNum)` checks the `day{N}_played` MMKV flag.

---

## §11. Protocol Audio

```typescript
import { playVoiceLineAsync, playSequence, stopCurrentAudio } from "@/lib/protocol-audio";

// Always cleanup on unmount
useEffect(() => () => { stopCurrentAudio(); }, []);

// Helpers for common lookups
getDailyGreetingId(dayNumber);
getDayDoneVoiceId(titanScore);
getArchetypeVoiceId(archetype);
playRandomTaskAck(); // 2-second throttled
```

138 voice-line MP3s at `assets/audio/protocol/`.

---

## §12. SQLite tables (42 user + 3 internal)

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

Internals (not user data): `schema_migrations` (migrator tracking). Legacy `pending_mutations` + `sync_meta` tables were dropped by migration 002.

Schema in `src/db/sqlite/migrations/001_initial.sql`. All user tables carry `_deleted` and `_dirty` housekeeping columns.

---

## §13. Known debt (grep-friendly list)

See `CLAUDE.md §10` for the authoritative list. Open items:

- **`backup.ts` filters `_deleted = 0`** — tombstones don't upload; deletions don't propagate across devices on restore. Fix before multi-device.
- **Streak MMKV shadow** — `app/_layout.tsx` reads `protocol_streak` from MMKV because it sits above `<QueryClientProvider>`. `profiles.streak_current` is the real store. They can drift.
- **Hook key convention** — mixed short-root vs. table-name-root keys across ~11 hooks. Non-functional, but a sweep would standardize.

Closed on 2026-04-23: date-key slice violations, raw elevation, `TABLE_QUERY_KEY_ROOTS` dead code, legacy sync tables, `useJournalEntries(days?)` dead param. Guard: `src/__tests__/lint/forbidden-patterns.test.ts` catches regressions of the first two.

---

## Growth rule

Add to this skill when you solve a non-trivial problem. Every entry earns its place by saving a future session a grep or a mistake.
