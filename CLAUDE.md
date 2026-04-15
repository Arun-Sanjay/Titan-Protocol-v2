# Titan Protocol — Android App

> Mobile-first gamified "personal OS" app. Expo SDK 55, RN 0.83, React 19, Hermes + New Architecture. Ship target: Google Play (freemium, solo dev).
>
> **Architecture: Supabase-first, single data layer.** Every screen reads from React Query hooks, writes through typed service functions. No MMKV stores for user data.

---

## 1. Architecture — Single Stack

**Every piece of user data lives in Supabase.** There is ONE read path (React Query hook) and ONE write path (service function → Supabase client). No dual-stack, no migration gate, no cloud-sync bridge.

```
Component → useXxx() hook → xxxService.ts → supabase client → Supabase DB
    ↑                                                              |
    └──── React Query cache (optimistic updates) ←─────────────────┘
```

**MMKV is ONLY for device-local preferences:**
- Sound/voice toggle
- Dev flags (dev_day_offset)
- Story flags (cinematic played state)
- UI mode (titan/focus)
- Theme preferences

**If a value should sync across devices, it goes in Supabase. Period.**

---

## 2. Tech Stack

| Area | Package | Version |
|---|---|---|
| Runtime | `expo` | `~55.0.12` |
| | `react-native` | `0.83.4` |
| | `react` | `19.2.0` |
| Routing | `expo-router` | `~55.0.11` |
| Language | `typescript` | `5.9` strict |
| Cloud state | `@tanstack/react-query` | `^5.96.2` |
| DB client | `@supabase/supabase-js` | `^2.101` |
| Local prefs | `react-native-mmkv` | `^4.3` (device-local only) |
| Session store | `@react-native-async-storage/async-storage` | `2.2` |
| Animation | `react-native-reanimated` | `4.2.1` |
| Gestures | `react-native-gesture-handler` | `~2.30` |
| Canvas | `@shopify/react-native-skia` | `2.4.18` |
| 3D | `@react-three/fiber` `^9.5` + `three` `^0.183` |
| Lists | `@shopify/flash-list` | `2.0.2` |
| Validation | `zod` | `^4.3` |
| Audio | `expo-av` `^16.0.8` + `expo-speech` `~55` |
| Fonts | `@expo-google-fonts/jetbrains-mono` |
| Tests | `jest` + `jest-expo` (pure logic only) |

No NativeWind, no styled-components, no Redux, no SWR, no Zustand for user data.

---

## 3. Supabase

**Project ref:** `rmvodrpgaffxeultskst` (region `ap-south-1`)

The database has 27 tables with RLS policies on every one. All tables follow:
- `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `created_at timestamptz NOT NULL DEFAULT now()`
- RLS enabled + 4 policies (SELECT/INSERT/UPDATE/DELETE) scoped to `auth.uid() = user_id`

**Key tables:** `profiles`, `tasks`, `completions`, `habits`, `habit_logs`, `protocol_sessions`, `rank_up_events`, `budgets`, `weight_logs`, `sleep_logs`, `money_transactions`, `journal_entries`, `achievements`, `titan_mode`, `progression`, `field_ops`, `skill_progress`, `narrative_logs`

Use the Supabase MCP tools for all schema work. See the skill file for the workflow.

---

## 4. Data Layer Pattern (for every new feature)

### Service (`src/services/xxx.ts`)
```typescript
import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

export type Xxx = Tables<"xxx">;

export async function listXxx(): Promise<Xxx[]> {
  const { data, error } = await supabase.from("xxx").select("*");
  if (error) throw error;
  return data ?? [];
}
```

### Hook (`src/hooks/queries/useXxx.ts`)
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/useAuthStore";
import { listXxx } from "../services/xxx";

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
- Services **throw** on error. Hooks catch via `onError`.
- Mutations are **optimistic**: `onMutate → snapshot → setQueryData → onError rollback → onSettled invalidate`
- Query keys are **tuple-typed** with `as const`
- All reads have `enabled: Boolean(userId)` to prevent 401s before auth hydrates
- **Never** read from or write to MMKV for user data

---

## 5. Golden Rules

1. **One data layer.** Supabase + React Query. No MMKV stores for user data. No Zustand stores for cloud-bound data.
2. **Services throw, hooks catch.** Service functions throw on Supabase error. Hooks handle via mutation callbacks.
3. **Optimistic mutations.** Every write follows `onMutate → snapshot → apply → onError rollback → onSettled invalidate`.
4. **`enabled: Boolean(userId)`** on every query. Prevents 401s during auth hydration.
5. **Every `withRepeat(-1)` has `cancelAnimation()` in cleanup.** Prevents Reanimated OOM on Android.
6. **Android shadows only via `theme/shadows.ts`.** Caps elevation to prevent GPU compositor OOM.
7. **No inline hex/rgba.** Use `colors.*` from `theme/colors.ts`.
8. **Dates via `lib/date.ts`.** Never `.toISOString().slice(0,10)` — not DST-safe.
9. **Batch inserts for onboarding.** Use `supabase.from("x").insert([...array])`, not N individual mutations.
10. **Auth store is the single auth source.** Login screens update it directly via `useAuthStore.setState()` for instant redirect.

---

## 6. File Structure

```
titan-android/
├── app/                     Expo Router screens
│   ├── _layout.tsx          Root layout + overlay orchestration
│   ├── (auth)/              Login, signup, verify, email-login
│   ├── (tabs)/              HQ, engines, track, hub, profile
│   ├── (modals)/            add-task modal
│   ├── hub/                 Sub-trackers (workout, sleep, budget, etc.)
│   ├── engine/[id].tsx      Per-engine mission detail
│   └── protocol.tsx         Morning/evening session
├── src/
│   ├── components/
│   │   ├── ui/              46 primitives (Panel, MissionRow, XPBar, etc.)
│   │   └── v2/              Onboarding, story cinematics, celebrations
│   ├── services/            Supabase service functions (TO BUILD)
│   ├── hooks/queries/       React Query hooks (TO BUILD)
│   ├── lib/                 Pure business logic (scoring, ranks, dates, audio)
│   ├── db/                  gamification.ts (pure), schema.ts (types)
│   ├── data/                Static JSON (achievements, bosses, quests, titles)
│   ├── theme/               colors, typography, spacing, shadows
│   └── types/               supabase.ts (auto-generated)
├── assets/audio/protocol/   138 voice-line MP3s
├── android/                 Native Android project (tracked)
└── .claude/                 Claude Code config, skills
```

---

## 7. What Needs Building (Phase 1)

The UI, cinematics, theme, and game logic are complete. What's missing is the data layer wiring:

1. **`src/lib/supabase.ts`** — Supabase client with AsyncStorage persistence
2. **`src/lib/query-client.ts`** — React Query client with MMKV persister
3. **`src/types/supabase.ts`** — Regenerated from the existing schema
4. **`src/stores/useAuthStore.ts`** — Auth state (Zustand, minimal)
5. **Services + hooks** for every domain (tasks, habits, profile, protocol, etc.)
6. **Rewire every screen** to read from hooks instead of dead store imports

---

## 8. Commands

```bash
npm run start              # expo start
npm run android            # expo run:android
npm test                   # jest (pure logic tests)
npx tsc --noEmit           # typecheck
```

**Supabase project ref:** `rmvodrpgaffxeultskst`
**Signing key:** `titan-release.jks` — do NOT regenerate.
