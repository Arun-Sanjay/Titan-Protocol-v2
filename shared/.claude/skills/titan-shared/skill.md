---
name: titan-shared
description: Titan shared data layer — pure logic, static data, Supabase client factory, types. Services + hooks + auth-context have been deleted; see ../ROADMAP.md Phase 6.
---

# Titan Shared Skill

> Patterns and workflows for the `@titan/shared` package after the Phase 6 trim.
>
> **Footprint:** Supabase client factory, Supabase `Database` types, pure logic (scoring, date, SRS, XP, quotes, schemas, gamification), static game data JSON/TS, and game-domain types. Nothing else.

---

## S1. ⚠️ Post-shrink reality

The following **no longer exist in this package** (check `../ROADMAP.md` Phase 6 for the migration record):
- `services/` — both apps have their own SQLite-backed service layer
- `hooks/queries/` — both apps have their own React Query hooks
- `lib/auth-context.tsx` — deleted; each app owns its own auth state
- `lib/query-client.ts` — deleted; each app builds its own `QueryClient`
- `lib/mutation-hooks.ts` — deleted; never wired up

If you're tempted to add a service or hook here, **don't** — add it to the consumer (web or mobile) instead. Shared exists to hold things that are genuinely platform-neutral.

---

## S2. Supabase MCP workflow

Project ref: **`rmvodrpgaffxeultskst`** (region `ap-south-1`).

```
# List tables
mcp__claude_ai_Supabase__list_tables({ project_id: "rmvodrpgaffxeultskst", schemas: ["public"] })

# Apply a migration (CREATE, ALTER, policies)
mcp__claude_ai_Supabase__apply_migration({ project_id: "rmvodrpgaffxeultskst", name: "snake_case_name", query: "SQL" })

# Read-only query (SELECT only)
mcp__claude_ai_Supabase__execute_sql({ project_id: "rmvodrpgaffxeultskst", query: "SELECT ..." })

# Regenerate types → overwrite types/supabase.ts
mcp__claude_ai_Supabase__generate_typescript_types({ project_id: "rmvodrpgaffxeultskst" })

# Security audit
mcp__claude_ai_Supabase__get_advisors({ project_id: "rmvodrpgaffxeultskst", type: "security" })
```

### Every-table checklist
- `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` (or composite PK, documented)
- `created_at timestamptz NOT NULL DEFAULT now()`
- `ENABLE ROW LEVEL SECURITY`
- 4 policies: SELECT / INSERT / UPDATE / DELETE — all `USING (auth.uid() = user_id)`
- Never hand-edit `types/supabase.ts` — always regenerate

---

## S3. Adding a column or table (schema change)

1. **Schema** — `apply_migration` via Supabase MCP
2. **Types** — `generate_typescript_types` → overwrite `shared/types/supabase.ts`
3. **Mirror to mobile:**
   - Copy regenerated types to `mobile/src/types/supabase.ts`
   - Add migration file at `mobile/src/db/sqlite/migrations/NNN_*.sql`
   - Register in `mobile/src/db/sqlite/migrations/index.ts`
   - Add to `COLUMN_TYPES` in `mobile/src/db/sqlite/column-types.ts`
   - Add to `PRIMARY_KEYS` in `mobile/src/sync/tables.ts`
4. **Mirror to web:**
   - Copy migration file to `web/src/db/sqlite/migrations/NNN_*.sql`
   - Register in `web/src/db/sqlite/migrations/index.ts`
   - Add to `COLUMN_TYPES` in `web/src/db/sqlite/column-types.ts`
   - Add to `PRIMARY_KEYS` in `web/src/sync/tables.ts`
5. **Typecheck** — `npx tsc --noEmit` in shared, mobile, web (all three)
6. **Security audit** — `get_advisors type=security` — zero new findings

---

## S4. Dates

```typescript
import {
  getTodayKey, toLocalDateKey, addDays,
  formatDateDisplay, formatDateShort,
  getGreeting, getMonthKey, getMonthLabel,
} from "./lib/date";
```

Never `.toISOString().slice(0,10)` — UTC-offset drift near midnight.

---

## S5. Scoring & ranks

### Daily Titan Score (0-100)
```typescript
import { calculateWeightedTitanScore } from "./lib/scoring-v2";
// Archetype-weighted average of 4 engine scores
```

### Daily Letter Grade (D/C/B/A/S/SS)
```typescript
import { getDailyRank } from "./db/gamification";
// SS≥95, S≥85, A≥70, B≥50, C≥30, D≥0
```

### XP-Level Tier (Initiate → Titan)
```typescript
import { getRankForLevel, RANKS } from "./db/gamification";
// 6 tiers (level = floor(xp/500) + 1)
// Initiate(1) / Operator(2) / Specialist(4) / Vanguard(8) / Sentinel(15) / Titan(31)
```

---

## S6. Dependencies

| Dep | Role |
|---|---|
| `@supabase/supabase-js` (peer + dev) | `lib/supabase.ts` — client + auth |
| `zod` (dep) | `lib/schemas.ts` — validation |

No React. No React Query. No UI. No platform-specific imports.

---

## S7. Rules

- No services, no hooks, no React context. Those live in the consumer apps.
- No UI components ever.
- Pure-logic files stay platform-neutral — no `window`, no `process`, no `expo-*`, no `react-native`.
- Any schema change touches **three** places (shared types + mobile + web) — see §S3.
- Static data duplication is accepted: `mobile/src/data/*` mirrors `shared/data/*` because mobile deliberately doesn't import shared. Keep them bit-identical.

---

## S8. Growth rule

Add to this skill when you solve a non-trivial problem. Every entry earns its place by saving a future session a grep or a mistake.
