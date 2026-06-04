# @titan/shared — CLAUDE.md

> Pure-logic, types, static game data, and the Supabase client factory.
>
> **Consumers:**
> - **Web** — the *only* package that imports this one (`"@titan/shared": "file:../shared"`, symlinked). In practice it imports a **narrow slice**: the Supabase client factory `lib/supabase.ts` (auth + cloud-write target), the generated `types/supabase.ts` (`Database`/`Tables`/`Json`/`Enums`, ~39 sites), `getRankForLevel` from `db/gamification.ts` (UserMenu only), and the `Quest` type from `types/quest-ui.ts` (quests service only). It does **not** import `scoring-v2`, `date`, `srs`, `xp-rewards`, `quotes`, `schemas`, or `data/*` — web keeps its own copies of those. The barrel `index.ts` has no consumer (web imports by subpath).
> - **`mobile/` (Classic) and `mobile-saas/`** — import nothing from here. Both were decoupled (Classic during the local-first migration; mobile-saas deliberately, to match Classic). They **mirror** the generated types into their own `src/types/supabase.ts` and keep local copies of the pure-logic files. Don't reintroduce the dependency in either.
>
> **Not in this package** (deleted during the web local-first migration):
> - `services/` — both apps now have their own SQLite-backed service layer
> - `hooks/queries/` — both apps have their own React Query hooks
> - `lib/auth-context.tsx` — each app owns its auth state directly
> - `lib/query-client.ts` — each app builds its own `QueryClient`
> - `lib/mutation-hooks.ts` — the cross-cutting hook registry was never wired up
>
> This package contains zero UI components. Data, logic, and types only.
>
> **Working-tree note:** The Phase-6 trim is **committed** (last commit `132e90d` "Add CI workflow"). The working tree currently has only `types/supabase.ts` modified — the `expo_push_token` regen from the mobile-saas M5 push work, pending commit.

---

## 1. Package structure

```
shared/
  index.ts              Barrel — re-exports Supabase init, types, pure logic, gamification
  lib/
    supabase.ts         Platform-agnostic client factory (initSupabase, requireUserId, ensureProfileRow)
    date.ts             Date helpers — always use these, never .toISOString().slice(0,10)
    scoring-v2.ts       calculateWeightedTitanScore — identity-weighted engine scoring
    xp-rewards.ts       XP constants + reward logic
    quotes.ts           36 motivational quotes, rotated by day of year
    srs.ts              SM-2 spaced repetition scheduling
    schemas.ts          Zod validation schemas + setErrorLogger hook
  db/
    gamification.ts     RANKS (6 tiers), DAILY_RANKS (D→SS), getDailyRank, getRankForLevel
  data/                 Static game definitions (platform-neutral)
    achievements.json, boss-challenges.json, field-ops.json, mission-templates.json,
    quest-templates.json, skill-trees.json, titles.json,
    archetype-stories.ts, identity-quiz.ts, skill-tree-defs.ts, starter-missions.ts,
    exercises/{bias-checks,decision-drills,knowledge-drops}.json
  types/
    supabase.ts         Auto-generated Supabase types — NEVER hand-edit
    game.ts             Archetype, EngineKey, TaskKind, AppMode, DailyGrade
    boss-ui.ts          Boss types (references data/boss-challenges.json)
    skill-tree-ui.ts    Skill tree types (references data/skill-trees.json)
    mind-training-ui.ts Mind training types
    progression-ui.ts   Progression types
    quest-ui.ts         Quest types
  tsconfig.json
  package.json          name: @titan/shared, private: true
```

---

## 2. What remains + why

### Supabase client (`lib/supabase.ts`)
Both apps hit Supabase — mobile for auth + manual backup, web for auth + manual backup. A single client factory avoids divergent config. Exports:
- `initSupabase(options)` — platforms call once at startup with their own storage adapter
- `supabase` — the initialized client (throws if used before init)
- `requireUserId()` — reads the session, throws if unsigned
- `ensureProfileRow()` — idempotent profiles-row upsert, belt-and-suspenders for the server-side `handle_new_user` trigger

### Types (`types/`)
`types/supabase.ts` is the source of truth for the table schema. Web imports it via `@titan/shared/types/supabase`; **both** mobile apps keep a mirror copy (`mobile/src/types/supabase.ts` **and** `mobile-saas/src/types/supabase.ts`). Regenerate via Supabase MCP; never hand-edit; copy to both mirrors after every regen.

### Pure logic (`lib/*`, `db/gamification.ts`)
These files are small, have no side effects, and are logic that must stay consistent across all frontends. **Live import surface today is tiny:** only `db/gamification.ts` (`getRankForLevel`) has a real importer (web's UserMenu). `lib/scoring-v2.ts`, `lib/date.ts`, `lib/srs.ts`, `lib/xp-rewards.ts`, `lib/quotes.ts`, and `lib/schemas.ts` have **no build-time consumer** — web keeps its own `lib/scoring.ts`/`lib/date.ts`, and both mobile apps severed the import and keep their own copies. So those files function as the canonical *reference* that each app's hand-maintained copy is kept in sync against, not as a runtime dependency. Keep them consistent, but know nothing imports them.

---

## 3. Supabase MCP workflow

Project ref: **`rmvodrpgaffxeultskst`** (region `ap-south-1`). 42 user tables + 3 housekeeping, all RLS-enabled.

```
# List tables
mcp__claude_ai_Supabase__list_tables({ project_id: "rmvodrpgaffxeultskst", schemas: ["public"] })

# Apply a migration (CREATE, ALTER, policies)
mcp__claude_ai_Supabase__apply_migration({ project_id: "...", name: "snake_case_name", query: "SQL" })

# Regenerate types — overwrite types/supabase.ts
mcp__claude_ai_Supabase__generate_typescript_types({ project_id: "..." })

# Security audit (run after every new table or policy change)
mcp__claude_ai_Supabase__get_advisors({ project_id: "...", type: "security" })
```

### Every-table checklist
- `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` (or composite PK, documented in `mobile/src/sync/tables.ts` + `web/src/sync/tables.ts`)
- `created_at timestamptz NOT NULL DEFAULT now()`
- `ENABLE ROW LEVEL SECURITY` + 4 policies USING `auth.uid() = user_id`
- Composite index on `(user_id, date_key)` for per-day data

### Schema change checklist (four packages, three SQLite apps)
1. Apply migration via MCP (`apply_migration`)
2. Regenerate types via MCP (`generate_typescript_types`) → overwrite `shared/types/supabase.ts`
3. Mirror the type file to **both** `mobile/src/types/supabase.ts` **and** `mobile-saas/src/types/supabase.ts`
4. Add a SQLite migration file (`NNN_*.sql` + register in `migrations/index.ts`) in:
   - `web/src/db/sqlite/migrations/` (SaaS)
   - `mobile-saas/src/db/sqlite/migrations/` (SaaS)
   - `mobile/src/db/sqlite/migrations/` (Classic — only if Classic needs the column)
5. Update `COLUMN_TYPES` + `PRIMARY_KEYS` (`column-types.ts` / `sync/tables.ts`) in each app you migrated
6. For SaaS sync: add the table to the `supabase_realtime` publication + `REPLICA IDENTITY FULL`
7. `npx tsc --noEmit` in shared, then each touched app

---

## 4. Dates

Always use helpers from `lib/date.ts`:
- `getTodayKey()` — YYYY-MM-DD in local timezone
- `toLocalDateKey(d)` — Date → YYYY-MM-DD local
- `addDays(dateKey, n)` — DST-safe day arithmetic
- `formatDateDisplay(dateKey)` — "April 22, 2026"
- `formatDateShort`, `getGreeting`, `getDayOfWeek`, `getMonthKey`, `getMonthLabel`

**Never** `.toISOString().slice(0,10)` — UTC-offset drift near midnight.

---

## 5. Scoring & ranks

Three distinct rank concepts — don't unify them.

### Daily Titan Score (0-100) — `lib/scoring-v2.ts`
`calculateWeightedTitanScore(perEngine, archetype)` — archetype-weighted average of 4 engine scores.

### Daily Letter Grade (D/C/B/A/S/SS) — `db/gamification.ts`
`getDailyRank(percent)` — SS ≥ 95, S ≥ 85, A ≥ 70, B ≥ 50, C ≥ 30, D ≥ 0.

### XP-Level Tier (Initiate → Titan) — `db/gamification.ts`
`getRankForLevel(level)` — 6 tiers: Initiate(1) / Operator(2) / Specialist(4) / Vanguard(8) / Sentinel(15) / Titan(31). `XP_PER_LEVEL = 500`.

---

## 6. Static data

`data/*.json` + `data/*.ts` — achievement definitions, boss challenges, field ops, mission templates, quest templates, skill trees, titles, exercises, archetype stories, identity quiz, starter missions.

These files are **duplicated in both mobile apps** (`mobile/src/data/` and `mobile-saas/src/data/`) so neither needs to import from shared. Keep bit-identical copies across all three; a CI-style diff check is a nice-to-have.

---

## 7. Dependencies

| Dependency | Where | Role |
|---|---|---|
| `@supabase/supabase-js` | peer + dev | `lib/supabase.ts` — DB client + auth |
| `zod` | dep | `lib/schemas.ts` — validation |

No React. No React Query. No UI.

---

## 8. Rules

- Never hand-edit `types/supabase.ts`. Always regenerate via MCP.
- Never use `.toISOString().slice(0,10)` for dates. Use `lib/date.ts`.
- No UI components. Data, types, and pure logic only.
- No React hooks, no React Query, no auth context — each app owns its own.
- After any schema change: regenerate types, mirror to mobile, add migration files to both mobile and web, update sync/tables in both. See §3.

---

## 9. Commands

```bash
npx tsc --noEmit    # Typecheck (should pass clean)
```

CI: `.github/workflows/ci.yml` runs `tsc --noEmit` on every push + PR to `main` (Node 20). No unit-test runner yet — tests for the pure-logic files (`scoring-v2`, `date`, `srs`, `xp-rewards`) are a planned follow-up.
