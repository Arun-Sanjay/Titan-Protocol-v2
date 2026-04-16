# Titan Dev Skill

> Recipes, patterns, and references for building features in the Titan Protocol Android app.
> **Architecture: Supabase-first, single data layer.** No MMKV stores for user data.

---

## §1. Supabase MCP Workflow

Project ref: **`rmvodrpgaffxeultskst`** (region `ap-south-1`).

### Common MCP Calls

```
# List tables
mcp__claude_ai_Supabase__list_tables({ project_id: "rmvodrpgaffxeultskst", schemas: ["public"] })

# Run a migration (CREATE TABLE, ALTER, policies)
mcp__claude_ai_Supabase__apply_migration({ project_id: "rmvodrpgaffxeultskst", name: "snake_case_name", query: "SQL" })

# Read-only query (SELECT only — never DDL)
mcp__claude_ai_Supabase__execute_sql({ project_id: "rmvodrpgaffxeultskst", query: "SELECT ..." })

# Regenerate TypeScript types → overwrite src/types/supabase.ts entirely
mcp__claude_ai_Supabase__generate_typescript_types({ project_id: "rmvodrpgaffxeultskst" })

# Security audit
mcp__claude_ai_Supabase__get_advisors({ project_id: "rmvodrpgaffxeultskst", type: "security" })
```

### Every-Table Checklist

Every new table MUST have:
- [ ] `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- [ ] `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- [ ] `created_at timestamptz NOT NULL DEFAULT now()`
- [ ] `ENABLE ROW LEVEL SECURITY`
- [ ] 4 policies: SELECT / INSERT / UPDATE / DELETE — all `USING (auth.uid() = user_id)`
- [ ] Composite index on `(user_id, date_key)` if per-day data
- [ ] Run `get_advisors type=security` after — zero new findings

### Rules
- **Never** hand-edit `src/types/supabase.ts` — always regenerate
- **Never** run DDL via `execute_sql` — use `apply_migration` so it's in history
- **Never** write raw SQL in `.ts` files

---

## §2. Adding a New Feature (end-to-end)

1. **Schema** — `apply_migration` to create/alter the table
2. **Types** — `generate_typescript_types` → overwrite `src/types/supabase.ts`
3. **Service** — `src/services/<feature>.ts`: thin typed wrappers, `throw` on error, call `requireUserId()` before writes
4. **Hook** — `src/hooks/queries/use<Feature>.ts`: deterministic query keys, `enabled: Boolean(userId)`, optimistic mutations
5. **Wire UI** — import the hook, no direct Supabase calls from components
6. **Resume sync** — add invalidation to `useAppResumeSync` if shown on HQ/tabs
7. **Typecheck** — `npx tsc --noEmit`

---

## §3. Service Pattern

```typescript
// src/services/tasks.ts
import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert } from "../types/supabase";

export type Task = Tables<"tasks">;

// Reads — RLS handles user scoping
export async function listTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks").select("*").eq("is_active", true);
  if (error) throw error;
  return data ?? [];
}

// Writes — always call requireUserId()
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("tasks").insert({ user_id: userId, ...input }).select().single();
  if (error) throw error;
  return data;
}
```

---

## §4. Hook Pattern (with optimistic mutation)

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
    queryFn: listAllTasks,
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

---

## §5. Auth Pattern

```typescript
// src/stores/useAuthStore.ts — THE ONLY Zustand store
// Thin wrapper around supabase.auth
// - initialize() hydrates from AsyncStorage + subscribes to onAuthStateChange
// - SIGNED_OUT handler attempts recovery with saved refresh_token
// - AppState listener refreshes session on resume (throttled 30s)
// - Login screens call useAuthStore.setState() directly for instant redirect
```

**Login flow:**
1. `signInWithPassword()` / `signUp()` / `signInWithIdToken()`
2. On success: `useAuthStore.setState({ session, user })` — instant redirect
3. Keep loading state until redirect fires (don't reset `busy`)
4. `onAuthStateChange` fires later and updates store (idempotent)

---

## §6. Scoring & Ranks Reference

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

## §7. Dates

Always use `lib/date.ts`:
- `getTodayKey()` — YYYY-MM-DD in local timezone
- `toLocalDateKey(d)` — Date → YYYY-MM-DD local
- `addDays(dateKey, n)` — DST-safe day arithmetic
- `formatDateDisplay(dateKey)` — "April 15, 2026"

**Never** `.toISOString().slice(0,10)` — produces wrong dates east of UTC.

---

## §8. Animation Safety

**Every `withRepeat(-1)` must have `cancelAnimation()` in cleanup:**
```typescript
useEffect(() => {
  sv.value = withRepeat(withTiming(...), -1, false);
  return () => { cancelAnimation(sv); };
}, []);
```

**Android shadows only via `theme/shadows.ts`** — caps elevation at 2 for panels, 0 for rows. Never raw `elevation: N`.

---

## §9. Cinematic System

18 day cinematics: Days 2-14, 30, 45, 60, 90, 365.
Day 1 uses `FirstLaunchCinematic` (separate path).
All other days get `DailyBriefing` only.

Files: `src/components/v2/story/Day{N}Cinematic.tsx`
Props: `{ onComplete: () => void }`
Gating: `useStoryStore.getCinematicForDay(dayNum)` checks the `day{N}_played` flag.

---

## §10. Protocol Audio

```typescript
import { playVoiceLineAsync, playSequence, stopCurrentAudio } from "@/lib/protocol-audio";

// Always cleanup on unmount
useEffect(() => () => { stopCurrentAudio(); }, []);

// Helpers for common lookups
getDailyGreetingId(dayNumber)
getDayDoneVoiceId(titanScore)
getArchetypeVoiceId(archetype)
playRandomTaskAck()  // 2-second throttled
```

---

## §11. Existing Supabase Tables (27 total)

| Domain | Table(s) | Status |
|---|---|---|
| Auth / Profile | `profiles` | Schema ready |
| Tasks | `tasks`, `completions` | Schema ready |
| Habits | `habits`, `habit_logs` | Schema ready |
| Protocol | `protocol_sessions` | Schema ready |
| Rank-ups | `rank_up_events` | Schema ready |
| Budgets | `budgets` | Schema ready |
| Weight | `weight_logs` | Schema ready |
| Sleep | `sleep_logs` | Schema ready |
| Money | `money_transactions` | Schema ready |
| Journal | `journal_entries` | Schema ready |
| Achievements | `achievements` | Schema ready |
| Titan Mode | `titan_mode` | Schema ready |
| Progression | `progression` | Schema ready |
| Field Ops | `field_ops` | Schema ready |
| Skill Tree | `skill_progress` | Schema ready |
| Narrative | `narrative_logs` | Schema ready |

All have RLS, composite indexes, and proper FK constraints.

---

## Growth Rule

Add to this skill when you solve a non-trivial problem. Every entry earns its place by saving a future session a grep or a mistake.
